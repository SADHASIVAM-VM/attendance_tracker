import { z } from 'zod';
import { getDb } from '../database/db.js';
import { leaveTypes, leaveRequests, users, notifications } from '../database/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
const leaveRequestSchema = z.object({
    leaveTypeId: z.string().uuid(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isHalfDay: z.boolean().default(false),
    halfDayPeriod: z.enum(['FIRST_HALF', 'SECOND_HALF']).optional(),
    reason: z.string().min(5, 'Reason must be at least 5 characters'),
});
const decisionSchema = z.object({
    decisionNote: z.string().optional(),
});
export async function getLeaveTypes(req, res) {
    const db = await getDb();
    const orgId = req.user.orgId;
    const types = await db
        .select()
        .from(leaveTypes)
        .where(and(eq(leaveTypes.orgId, orgId), eq(leaveTypes.isActive, true)));
    return res.json(types);
}
export async function createLeaveRequest(req, res) {
    const parseResult = leaveRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
    }
    const data = parseResult.data;
    const db = await getDb();
    const userId = req.user.id;
    const orgId = req.user.orgId;
    // Validate dates
    if (data.endDate < data.startDate) {
        return res.status(400).json({
            error: 'INVALID_DATE_RANGE',
            message: 'End date cannot be earlier than start date',
        });
    }
    // Check overlapping existing pending or approved leave requests
    const overlapping = await db
        .select()
        .from(leaveRequests)
        .where(and(eq(leaveRequests.userId, userId), sql `${leaveRequests.status} IN ('PENDING', 'APPROVED')`, sql `${leaveRequests.startDate} <= ${data.endDate} AND ${leaveRequests.endDate} >= ${data.startDate}`))
        .limit(1);
    if (overlapping.length > 0) {
        return res.status(409).json({
            error: 'OVERLAPPING_LEAVE_REQUEST',
            message: 'You already have a pending or approved leave request covering these dates',
        });
    }
    const [request] = await db
        .insert(leaveRequests)
        .values({
        orgId,
        userId,
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        isHalfDay: data.isHalfDay,
        halfDayPeriod: data.halfDayPeriod,
        reason: data.reason,
        status: 'PENDING',
    })
        .returning();
    await logAuditEvent({
        orgId,
        actorId: userId,
        action: 'CREATE_LEAVE_REQUEST',
        entityType: 'LEAVE_REQUEST',
        entityId: request.id,
        afterValues: request,
        ipAddress: req.ip,
    });
    return res.status(201).json(request);
}
export async function getMyLeaveRequests(req, res) {
    const db = await getDb();
    const userId = req.user.id;
    const requests = await db
        .select({
        id: leaveRequests.id,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        isHalfDay: leaveRequests.isHalfDay,
        halfDayPeriod: leaveRequests.halfDayPeriod,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        decisionNote: leaveRequests.decisionNote,
        decidedAt: leaveRequests.decidedAt,
        createdAt: leaveRequests.createdAt,
        leaveTypeName: leaveTypes.name,
        leaveTypeCode: leaveTypes.code,
    })
        .from(leaveRequests)
        .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
        .where(eq(leaveRequests.userId, userId))
        .orderBy(desc(leaveRequests.createdAt));
    return res.json(requests);
}
export async function getPendingLeaveRequests(req, res) {
    const db = await getDb();
    const orgId = req.user.orgId;
    // Leave requests route strictly to Admin / Super Admin
    const requests = await db
        .select({
        id: leaveRequests.id,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        isHalfDay: leaveRequests.isHalfDay,
        halfDayPeriod: leaveRequests.halfDayPeriod,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        createdAt: leaveRequests.createdAt,
        workerId: users.id,
        workerName: users.fullName,
        employeeCode: users.employeeCode,
        workerEmail: users.email,
        leaveTypeName: leaveTypes.name,
        leaveTypeCode: leaveTypes.code,
    })
        .from(leaveRequests)
        .innerJoin(users, eq(leaveRequests.userId, users.id))
        .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
        .where(and(eq(leaveRequests.orgId, orgId), eq(leaveRequests.status, 'PENDING')))
        .orderBy(desc(leaveRequests.createdAt));
    return res.json(requests);
}
export async function approveLeaveRequest(req, res) {
    const { id } = req.params;
    const parseResult = decisionSchema.safeParse(req.body);
    const decisionNote = parseResult.success ? parseResult.data.decisionNote : undefined;
    const db = await getDb();
    const reviewer = req.user;
    const [request] = await db
        .select()
        .from(leaveRequests)
        .where(and(eq(leaveRequests.id, id), eq(leaveRequests.orgId, reviewer.orgId)))
        .limit(1);
    if (!request || request.status !== 'PENDING') {
        return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Pending leave request not found' });
    }
    const now = new Date();
    const [updated] = await db
        .update(leaveRequests)
        .set({
        status: 'APPROVED',
        reviewerId: reviewer.id,
        decisionNote,
        decidedAt: now,
        updatedAt: now,
    })
        .where(eq(leaveRequests.id, id))
        .returning();
    // Notify worker
    await db.insert(notifications).values({
        userId: request.userId,
        title: 'Leave Request Approved',
        message: `Your leave request for ${request.startDate} to ${request.endDate} has been approved.`,
        type: 'LEAVE_APPROVED',
        entityType: 'LEAVE_REQUEST',
        entityId: request.id,
    });
    await logAuditEvent({
        orgId: reviewer.orgId,
        actorId: reviewer.id,
        action: 'APPROVE_LEAVE_REQUEST',
        entityType: 'LEAVE_REQUEST',
        entityId: id,
        beforeValues: { status: 'PENDING' },
        afterValues: { status: 'APPROVED', decisionNote },
        ipAddress: req.ip,
    });
    return res.json({ success: true, message: 'Leave request approved', request: updated });
}
export async function rejectLeaveRequest(req, res) {
    const { id } = req.params;
    const parseResult = decisionSchema.safeParse(req.body);
    const decisionNote = parseResult.success ? parseResult.data.decisionNote : 'Rejected by administrator';
    const db = await getDb();
    const reviewer = req.user;
    const [request] = await db
        .select()
        .from(leaveRequests)
        .where(and(eq(leaveRequests.id, id), eq(leaveRequests.orgId, reviewer.orgId)))
        .limit(1);
    if (!request || request.status !== 'PENDING') {
        return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Pending leave request not found' });
    }
    const now = new Date();
    const [updated] = await db
        .update(leaveRequests)
        .set({
        status: 'REJECTED',
        reviewerId: reviewer.id,
        decisionNote,
        decidedAt: now,
        updatedAt: now,
    })
        .where(eq(leaveRequests.id, id))
        .returning();
    // Notify worker
    await db.insert(notifications).values({
        userId: request.userId,
        title: 'Leave Request Rejected',
        message: `Your leave request for ${request.startDate} to ${request.endDate} was rejected. Note: ${decisionNote}`,
        type: 'LEAVE_REJECTED',
        entityType: 'LEAVE_REQUEST',
        entityId: request.id,
    });
    await logAuditEvent({
        orgId: reviewer.orgId,
        actorId: reviewer.id,
        action: 'REJECT_LEAVE_REQUEST',
        entityType: 'LEAVE_REQUEST',
        entityId: id,
        beforeValues: { status: 'PENDING' },
        afterValues: { status: 'REJECTED', decisionNote },
        ipAddress: req.ip,
    });
    return res.json({ success: true, message: 'Leave request rejected', request: updated });
}
export async function cancelLeaveRequest(req, res) {
    const { id } = req.params;
    const db = await getDb();
    const userId = req.user.id;
    const [request] = await db
        .select()
        .from(leaveRequests)
        .where(and(eq(leaveRequests.id, id), eq(leaveRequests.userId, userId)))
        .limit(1);
    if (!request) {
        return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Leave request not found' });
    }
    if (request.status !== 'PENDING') {
        return res.status(400).json({ error: 'CANNOT_CANCEL', message: 'Only pending leave requests can be cancelled' });
    }
    const [updated] = await db
        .update(leaveRequests)
        .set({
        status: 'CANCELLED',
        updatedAt: new Date(),
    })
        .where(eq(leaveRequests.id, id))
        .returning();
    return res.json({ success: true, message: 'Leave request cancelled', request: updated });
}
