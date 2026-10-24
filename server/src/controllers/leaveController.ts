import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import { leaveTypes, leaveRequests, users, notifications, userRoles } from '../database/schema.js';
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

export async function getLeaveTypes(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  const types = await db
    .select()
    .from(leaveTypes)
    .where(and(eq(leaveTypes.orgId, orgId), eq(leaveTypes.isActive, true)));

  return res.json(types);
}

export async function createLeaveRequest(req: Request, res: Response): Promise<any> {
  const parseResult = leaveRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const data = parseResult.data;
  const db = await getDb();
  const userId = req.user!.id;
  const orgId = req.user!.orgId;

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
    .where(
      and(
        eq(leaveRequests.userId as any, userId as any),
        sql`${leaveRequests.status} IN ('PENDING', 'APPROVED')`,
        sql`${leaveRequests.startDate} <= ${data.endDate} AND ${leaveRequests.endDate} >= ${data.startDate}`
      )
    )
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

export async function getMyLeaveRequests(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const userId = req.user!.id;

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
    .where(eq(leaveRequests.userId as any, userId as any))
    .orderBy(desc(leaveRequests.createdAt));

  return res.json(requests);
}

export async function getPendingLeaveRequests(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const reviewer = req.user!;
  const isSupervisor = reviewer.roles.includes('SUPERVISOR') && !reviewer.roles.includes('ADMIN') && !reviewer.roles.includes('SUPER_ADMIN');

  // Query pending requests with requester role info
  const allPending = await db
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
      requesterRole: userRoles.role,
    })
    .from(leaveRequests)
    .innerJoin(users, eq(leaveRequests.userId, users.id))
    .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .where(
      and(
        eq(leaveRequests.orgId as any, orgId as any),
        eq(leaveRequests.status, 'PENDING')
      )
    )
    .orderBy(desc(leaveRequests.createdAt));

  // If reviewer is a SUPERVISOR:
  // - Worker leave requests go to supervisor for approval
  // - Supervisor does NOT review other supervisors' leaves (those go to Admin)
  if (isSupervisor) {
    const workerPending = allPending.filter(
      (r) => r.requesterRole !== 'SUPERVISOR' && r.requesterRole !== 'ADMIN'
    );
    return res.json(workerPending);
  }

  // If reviewer is ADMIN or SUPER_ADMIN:
  // - Supervisor's leave request goes to the admin for approval!
  return res.json(allPending);
}

export async function approveLeaveRequest(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = decisionSchema.safeParse(req.body);
  const decisionNote = parseResult.success ? parseResult.data.decisionNote : undefined;

  const db = await getDb();
  const reviewer = req.user!;

  const [request] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.id as any, id as any), eq(leaveRequests.orgId as any, reviewer.orgId as any)))
    .limit(1);

  if (!request || request.status !== 'PENDING') {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Pending leave request not found' });
  }

  // Check requester's role
  const [requesterRoleRecord] = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, request.userId))
    .limit(1);

  const requesterRole = requesterRoleRecord?.role || 'WORKER';
  const isSupervisorReviewer = reviewer.roles.includes('SUPERVISOR') && !reviewer.roles.includes('ADMIN') && !reviewer.roles.includes('SUPER_ADMIN');

  // Supervisor's leave request MUST go to Admin for approval
  if (requesterRole === 'SUPERVISOR' && isSupervisorReviewer) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: "Supervisor's leave request must be approved by an Administrator.",
    });
  }

  const reviewerTitle = reviewer.roles.includes('SUPERVISOR') ? 'Supervisor' : 'Administrator';
  const now = new Date();
  const [updated] = await db
    .update(leaveRequests)
    .set({
      status: 'APPROVED',
      reviewerId: reviewer.id,
      decisionNote: decisionNote || `Approved by ${reviewerTitle}`,
      decidedAt: now,
      updatedAt: now,
    })
    .where(eq(leaveRequests.id as any, id as any))
    .returning();

  // Notify requester
  await db.insert(notifications).values({
    userId: request.userId,
    title: 'Leave Request Approved',
    message: `Your leave request for ${request.startDate} to ${request.endDate} has been approved by ${reviewerTitle} (${reviewer.fullName}).`,
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
    afterValues: { status: 'APPROVED', decisionNote, reviewerTitle },
    ipAddress: req.ip,
  });

  return res.json({ success: true, message: `Leave request approved by ${reviewerTitle}`, request: updated });
}

export async function rejectLeaveRequest(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = decisionSchema.safeParse(req.body);
  const reviewer = req.user!;
  const reviewerTitle = reviewer.roles.includes('SUPERVISOR') ? 'Supervisor' : 'Administrator';
  const decisionNote = parseResult.success && parseResult.data.decisionNote ? parseResult.data.decisionNote : `Rejected by ${reviewerTitle}`;

  const db = await getDb();

  const [request] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.id as any, id as any), eq(leaveRequests.orgId as any, reviewer.orgId as any)))
    .limit(1);

  if (!request || request.status !== 'PENDING') {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Pending leave request not found' });
  }

  // Check requester's role
  const [requesterRoleRecord] = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, request.userId))
    .limit(1);

  const requesterRole = requesterRoleRecord?.role || 'WORKER';
  const isSupervisorReviewer = reviewer.roles.includes('SUPERVISOR') && !reviewer.roles.includes('ADMIN') && !reviewer.roles.includes('SUPER_ADMIN');

  // Supervisor's leave request MUST go to Admin for approval
  if (requesterRole === 'SUPERVISOR' && isSupervisorReviewer) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: "Supervisor's leave request must be rejected by an Administrator.",
    });
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
    .where(eq(leaveRequests.id as any, id as any))
    .returning();

  // Notify requester
  await db.insert(notifications).values({
    userId: request.userId,
    title: 'Leave Request Rejected',
    message: `Your leave request for ${request.startDate} to ${request.endDate} was rejected by ${reviewerTitle}. Note: ${decisionNote}`,
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
    afterValues: { status: 'REJECTED', decisionNote, reviewerTitle },
    ipAddress: req.ip,
  });

  return res.json({ success: true, message: `Leave request rejected by ${reviewerTitle}`, request: updated });
}

export async function cancelLeaveRequest(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const userId = req.user!.id;

  const [request] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.id as any, id as any), eq(leaveRequests.userId as any, userId as any)))
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
    .where(eq(leaveRequests.id as any, id as any))
    .returning();

  return res.json({ success: true, message: 'Leave request cancelled', request: updated });
}
