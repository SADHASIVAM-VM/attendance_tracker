import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  leaveTypes,
  leaveRequests,
  users,
  notifications,
  userRoles,
  siteAssignments,
  siteAssignmentWorkers,
  attendanceSessions,
  attendanceExceptions,
  organizations,
} from '../database/schema.js';
import { eq, and, sql, desc, or, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { logAuditEvent } from '../utils/audit.js';
import { getOrgCurrentMonth } from '../utils/dateUtils.js';

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

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

const revokeSchema = z.object({
  revocationReason: z
    .string({ required_error: 'Revocation reason is required' })
    .trim()
    .min(3, 'Revocation reason must be at least 3 characters'),
});

/**
 * Checks if a worker is assigned to a supervisor via active/published site assignments
 * or if the supervisor is explicitly recorded as currentApproverId.
 */
export async function isSupervisorAuthorizedForWorker(
  db: any,
  workerId: string,
  supervisorId: string,
  orgId: string,
  currentApproverId?: string | null
): Promise<boolean> {
  if (currentApproverId && currentApproverId === supervisorId) {
    return true;
  }

  const [row] = await db
    .select({ id: siteAssignmentWorkers.id })
    .from(siteAssignmentWorkers)
    .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
    .where(
      and(
        eq(siteAssignments.orgId, orgId),
        eq(siteAssignmentWorkers.workerId, workerId),
        or(
          eq(siteAssignments.supervisorId, supervisorId),
          eq(siteAssignments.fallbackSupervisorId, supervisorId)
        )
      )
    )
    .limit(1);

  return !!row;
}

/**
 * Retrieves the set of worker IDs assigned to a supervisor across all their site assignments.
 */
export async function getSupervisorAssignedWorkerIds(
  db: any,
  supervisorId: string,
  orgId: string
): Promise<string[]> {
  const rows = await db
    .select({ workerId: siteAssignmentWorkers.workerId })
    .from(siteAssignmentWorkers)
    .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
    .where(
      and(
        eq(siteAssignments.orgId, orgId),
        or(
          eq(siteAssignments.supervisorId, supervisorId),
          eq(siteAssignments.fallbackSupervisorId, supervisorId)
        )
      )
    );

  return Array.from(new Set(rows.map((r: any) => r.workerId)));
}

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

  // Resolve worker's assigned supervisor
  const [assignmentRow] = await db
    .select({ supervisorId: siteAssignments.supervisorId })
    .from(siteAssignmentWorkers)
    .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
    .where(eq(siteAssignmentWorkers.workerId, userId))
    .orderBy(desc(siteAssignments.createdAt))
    .limit(1);

  // Check if attendance session already exists on requested dates (conflict detection)
  const [existingAttendance] = await db
    .select({ id: attendanceSessions.id, workDate: attendanceSessions.workDate })
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.workerId, userId),
        sql`DATE(${attendanceSessions.workDate}) >= ${data.startDate} AND DATE(${attendanceSessions.workDate}) <= ${data.endDate}`
      )
    )
    .limit(1);

  const initialConflictStatus = existingAttendance ? 'PENDING_ATTENDANCE_CONFLICT' : 'NONE';
  const initialConflictDetails = existingAttendance
    ? `Worker already clocked in on ${existingAttendance.workDate} for which leave was requested.`
    : null;

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
      currentApproverId: assignmentRow?.supervisorId || null,
      conflictStatus: initialConflictStatus,
      conflictDetails: initialConflictDetails,
    })
    .returning();

  // If conflict detected, also log exception
  if (existingAttendance) {
    await db.insert(attendanceExceptions).values({
      orgId,
      workerId: userId,
      sessionId: existingAttendance.id,
      leaveRequestId: request.id,
      workDate: String(existingAttendance.workDate).split('T')[0],
      exceptionType: 'LEAVE_ATTENDANCE_CONFLICT',
      severity: 'MEDIUM',
      status: 'OPEN',
      primarySupervisorId: assignmentRow?.supervisorId || null,
      currentApproverId: assignmentRow?.supervisorId || null,
      escalationReason: initialConflictDetails,
    });
  }

  await logAuditEvent({
    orgId,
    actorId: userId,
    actorNameSnapshot: req.user!.fullName,
    actorRole: req.user!.roles[0],
    action: 'CREATE_LEAVE_REQUEST',
    entityType: 'LEAVE_REQUEST',
    entityId: request.id,
    reason: data.reason,
    afterValues: request,
    req,
  });

  return res.status(201).json(request);
}

export async function getMyLeaveRequests(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const userId = req.user!.id;
  const revokerUsers = alias(users, 'revoker_users');

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
      revokedBy: leaveRequests.revokedBy,
      revokedAt: leaveRequests.revokedAt,
      revocationReason: leaveRequests.revocationReason,
      revokedByName: revokerUsers.fullName,
      createdAt: leaveRequests.createdAt,
      leaveTypeName: leaveTypes.name,
      leaveTypeCode: leaveTypes.code,
    })
    .from(leaveRequests)
    .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .leftJoin(revokerUsers, eq(leaveRequests.revokedBy, revokerUsers.id))
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
      userId: leaveRequests.userId,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      isHalfDay: leaveRequests.isHalfDay,
      halfDayPeriod: leaveRequests.halfDayPeriod,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      currentApproverId: leaveRequests.currentApproverId,
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

  // Deduplicate by request ID (in case user has multiple role assignments)
  const uniquePending = Array.from(new Map(allPending.map((item) => [item.id, item])).values());

  // If reviewer is a SUPERVISOR:
  // - Worker leave requests go to supervisor for approval
  // - Supervisor does NOT review other supervisors' leaves (those go to Admin)
  // - Supervisor CANNOT review leaves outside their assigned site workers
  if (isSupervisor) {
    const assignedWorkerIds = await getSupervisorAssignedWorkerIds(db, reviewer.id, orgId);
    const workerPending = uniquePending.filter((r) => {
      if (r.requesterRole === 'SUPERVISOR' || r.requesterRole === 'ADMIN') return false;
      if (r.workerId === reviewer.id) return false;
      return assignedWorkerIds.includes(r.workerId) || r.currentApproverId === reviewer.id;
    });
    return res.json(workerPending);
  }

  // If reviewer is ADMIN or SUPER_ADMIN:
  return res.json(uniquePending);
}

export async function getTeamLeaveRequests(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const reviewer = req.user!;
  const isSuperOrAdmin = reviewer.roles.includes('SUPER_ADMIN') || reviewer.roles.includes('ADMIN');

  const revokerUsers = alias(users, 'revoker_users');
  const reviewerUsers = alias(users, 'reviewer_users');
  const reviewerRoleRecord = alias(userRoles, 'reviewer_roles');

  const allTeamLeaves = await db
    .select({
      id: leaveRequests.id,
      userId: leaveRequests.userId,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      isHalfDay: leaveRequests.isHalfDay,
      halfDayPeriod: leaveRequests.halfDayPeriod,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      reviewerId: leaveRequests.reviewerId,
      decisionNote: leaveRequests.decisionNote,
      decidedAt: leaveRequests.decidedAt,
      revokedBy: leaveRequests.revokedBy,
      revokedAt: leaveRequests.revokedAt,
      revocationReason: leaveRequests.revocationReason,
      currentApproverId: leaveRequests.currentApproverId,
      createdAt: leaveRequests.createdAt,
      workerId: users.id,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      workerEmail: users.email,
      workerPhoto: users.photoUrl,
      requesterRole: userRoles.role,
      leaveTypeName: leaveTypes.name,
      leaveTypeCode: leaveTypes.code,
      revokedByName: revokerUsers.fullName,
      reviewerName: reviewerUsers.fullName,
      reviewerRole: reviewerRoleRecord.role,
    })
    .from(leaveRequests)
    .innerJoin(users, eq(leaveRequests.userId, users.id))
    .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(revokerUsers, eq(leaveRequests.revokedBy, revokerUsers.id))
    .leftJoin(reviewerUsers, eq(leaveRequests.reviewerId, reviewerUsers.id))
    .leftJoin(reviewerRoleRecord, eq(leaveRequests.reviewerId, reviewerRoleRecord.userId))
    .where(eq(leaveRequests.orgId, orgId))
    .orderBy(desc(leaveRequests.createdAt));

  const uniqueTeamLeaves = Array.from(new Map(allTeamLeaves.map((item) => [item.id, item])).values());

  if (!isSuperOrAdmin) {
    const assignedWorkerIds = await getSupervisorAssignedWorkerIds(db, reviewer.id, orgId);
    const filtered = uniqueTeamLeaves.filter((r) => {
      // Exclude leaves of other supervisors or admins
      if (r.requesterRole === 'SUPERVISOR' || r.requesterRole === 'ADMIN') return false;
      // Exclude supervisor's own leaves
      if (r.workerId === reviewer.id) return false;
      return assignedWorkerIds.includes(r.workerId) || r.currentApproverId === reviewer.id;
    });
    return res.json(filtered);
  }

  return res.json(uniqueTeamLeaves);
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

  // Rule: Workers & supervisors CANNOT approve their own leave request
  if (request.userId === reviewer.id) {
    return res.status(403).json({
      error: 'CANNOT_APPROVE_OWN_LEAVE',
      message: 'You cannot approve your own leave request',
    });
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

  // Site assignment authorization check for supervisors
  if (isSupervisorReviewer) {
    const isAuthorized = await isSupervisorAuthorizedForWorker(
      db,
      request.userId,
      reviewer.id,
      reviewer.orgId,
      request.currentApproverId
    );
    if (!isAuthorized) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not authorized to decide leave requests for workers outside your site assignments',
      });
    }
  }

  const reviewerTitle = isSupervisorReviewer ? 'Supervisor' : 'Administrator';
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
  const isSupervisorReviewer = reviewer.roles.includes('SUPERVISOR') && !reviewer.roles.includes('ADMIN') && !reviewer.roles.includes('SUPER_ADMIN');
  const reviewerTitle = isSupervisorReviewer ? 'Supervisor' : 'Administrator';
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

  // Rule: Workers & supervisors CANNOT decide their own leave request
  if (request.userId === reviewer.id) {
    return res.status(403).json({
      error: 'CANNOT_REJECT_OWN_LEAVE',
      message: 'You cannot decide your own leave request',
    });
  }

  // Rejection requires a mandatory reason
  if (!parseResult.success || !parseResult.data.decisionNote || parseResult.data.decisionNote.trim().length < 3) {
    return res.status(400).json({
      error: 'REJECTION_REASON_REQUIRED',
      message: 'A mandatory decisionNote / reason (at least 3 characters) is required to reject a leave request',
    });
  }

  // Check requester's role
  const [requesterRoleRecord] = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, request.userId))
    .limit(1);

  const requesterRole = requesterRoleRecord?.role || 'WORKER';

  // Supervisor's leave request MUST go to Admin for approval
  if (requesterRole === 'SUPERVISOR' && isSupervisorReviewer) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: "Supervisor's leave request must be rejected by an Administrator.",
    });
  }

  // Site assignment authorization check for supervisors
  if (isSupervisorReviewer) {
    const isAuthorized = await isSupervisorAuthorizedForWorker(
      db,
      request.userId,
      reviewer.id,
      reviewer.orgId,
      request.currentApproverId
    );
    if (!isAuthorized) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not authorized to decide leave requests for workers outside your site assignments',
      });
    }
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

  const cancelReason = (req.body as any)?.cancellationReason || (req.body as any)?.reason || 'Cancelled by requester';
  const now = new Date();

  const [updated] = await db
    .update(leaveRequests)
    .set({
      status: 'CANCELLED',
      cancellationReason: cancelReason,
      cancelledAt: now,
      cancelledBy: userId,
      updatedAt: now,
    })
    .where(eq(leaveRequests.id as any, id as any))
    .returning();

  await logAuditEvent({
    orgId: request.orgId,
    actorId: userId,
    actorNameSnapshot: req.user!.fullName,
    actorRole: req.user!.roles[0],
    action: 'CANCEL_LEAVE_REQUEST',
    entityType: 'LEAVE_REQUEST',
    entityId: id,
    reason: cancelReason,
    beforeValues: { status: 'PENDING' },
    afterValues: { status: 'CANCELLED', cancellationReason: cancelReason },
    req,
  });

  return res.json({ success: true, message: 'Leave request cancelled', request: updated });
}

/**
 * POST /leave/requests/:id/revoke
 * Complete workflow allowing an authorized site supervisor (or admin) to revoke
 * approved future leave for an assigned worker.
 */
export async function revokeLeaveRequest(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = revokeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'A revocation reason of at least 3 characters is required',
      details: parseResult.error.issues,
    });
  }

  const { revocationReason } = parseResult.data;
  const db = await getDb();
  const reviewer = req.user!;
  const orgId = reviewer.orgId;
  const isSuperOrAdmin = reviewer.roles.includes('SUPER_ADMIN') || reviewer.roles.includes('ADMIN');

  // 1. Fetch leave request scoped to caller organization
  const [request] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.id, id), eq(leaveRequests.orgId, orgId)))
    .limit(1);

  if (!request) {
    return res.status(404).json({
      error: 'REQUEST_NOT_FOUND',
      message: 'Leave request not found in your organization',
    });
  }

  // 2. Supervisor worker assignment scoping check
  // Admin bypasses assignment check, but supervisor MUST have authorization over worker
  if (!isSuperOrAdmin) {
    const isAssigned = await isSupervisorAuthorizedForWorker(
      db,
      request.userId,
      reviewer.id,
      orgId,
      request.currentApproverId
    );
    if (!isAssigned) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not authorized to revoke leave requests for workers outside your site assignments',
      });
    }
  }

  // 3. Status checks:
  // - Conflict if already revoked
  if (request.status === 'REVOKED') {
    return res.status(409).json({
      error: 'ALREADY_REVOKED',
      message: 'This leave request has already been revoked',
    });
  }

  // - Bad request if not approved (e.g. PENDING, REJECTED, CANCELLED)
  if (request.status !== 'APPROVED') {
    return res.status(400).json({
      error: 'INVALID_STATUS',
      message: `Only APPROVED leave requests can be revoked. Current status is ${request.status}.`,
    });
  }

  // 4. Timezone & date checks
  const [org] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const orgTz = org?.timezone || 'Asia/Kolkata';
  const { monthStr, todayStr } = getOrgCurrentMonth(orgTz);

  // Leave has not started: start date is strictly later than today in org timezone
  if (request.startDate <= todayStr) {
    return res.status(400).json({
      error: 'LEAVE_ALREADY_STARTED',
      message: `Cannot revoke leave that has already started or starts today (${todayStr} in org timezone). Start date is ${request.startDate}.`,
    });
  }

  const startMonth = request.startDate.substring(0, 7);
  const endMonth = request.endDate.substring(0, 7);

  // Block cross-month leave completely
  if (startMonth !== endMonth) {
    return res.status(400).json({
      error: 'CROSS_MONTH_REVOCATION_NOT_SUPPORTED',
      message: 'Supervisor revocation is not supported for cross-month requests in this phase. The request spans across month boundaries.',
    });
  }

  // Both dates must belong to current calendar month in org timezone
  if (startMonth !== monthStr || endMonth !== monthStr) {
    return res.status(400).json({
      error: 'NOT_CURRENT_MONTH',
      message: `Supervisor revocation is restricted to the current calendar month (${monthStr}). Leave dates ${request.startDate} to ${request.endDate} are outside the current month.`,
    });
  }

  // 5. Atomic state transition with transaction & conditional update
  try {
    const updated = await db.transaction(async (tx) => {
      const now = new Date();

      // Conditional update ensures only APPROVED request can transition to REVOKED
      const [updatedRow] = await tx
        .update(leaveRequests)
        .set({
          status: 'REVOKED',
          revokedBy: reviewer.id,
          revokedAt: now,
          revocationReason,
          updatedAt: now,
        })
        .where(
          and(
            eq(leaveRequests.id, request.id),
            eq(leaveRequests.status, 'APPROVED')
          )
        )
        .returning();

      if (!updatedRow) {
        throw new ConflictError('Leave request was modified concurrently and is no longer approved');
      }

      // Notify the affected worker
      const reviewerTitle = isSuperOrAdmin ? 'Administrator' : 'Site Supervisor';
      await tx.insert(notifications).values({
        userId: request.userId,
        title: 'Leave Request Revoked',
        message: `Your approved leave for ${request.startDate} to ${request.endDate} has been revoked by ${reviewerTitle} (${reviewer.fullName}). Reason: ${revocationReason}`,
        type: 'LEAVE_REVOKED',
        entityType: 'LEAVE_REQUEST',
        entityId: request.id,
      });

      // Audit trail logging within transaction
      await logAuditEvent({
        tx,
        orgId,
        actorId: reviewer.id,
        actorNameSnapshot: reviewer.fullName,
        actorRole: reviewer.roles[0],
        action: 'REVOKE_LEAVE_REQUEST',
        entityType: 'LEAVE_REQUEST',
        entityId: request.id,
        reason: revocationReason,
        beforeValues: {
          status: 'APPROVED',
          startDate: request.startDate,
          endDate: request.endDate,
          reviewerId: request.reviewerId,
          decisionNote: request.decisionNote,
          decidedAt: request.decidedAt,
        },
        afterValues: {
          status: 'REVOKED',
          revokedAt: now,
          revokedBy: reviewer.id,
          revocationReason,
        },
        req,
      });

      return updatedRow;
    });

    return res.json({
      success: true,
      message: 'Leave request revoked successfully',
      request: updated,
    });
  } catch (error: any) {
    if (error instanceof ConflictError || error.message?.includes('concurrently')) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'Leave request was modified concurrently and is no longer approved',
      });
    }
    console.error('Revoke leave error:', error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to revoke leave request',
    });
  }
}

