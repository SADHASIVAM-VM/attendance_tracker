import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  attendanceSessions,
  attendanceExceptions,
  leaveRequests,
  attendanceAdjustmentRequests,
  siteAssignments,
  users,
  worksites,
  auditLogs,
  approvalActions,
} from '../database/schema.js';
import { eq, and, desc, sql, count, inArray, or } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
import {
  runMissingAttendanceCheck,
  runMissingClockOutCheck,
  runOverdueEscalationCheck,
} from '../services/escalationService.js';
import {
  applyAttendanceStatusTransition,
  CanonicalAttendanceStatus,
  CANONICAL_ATTENDANCE_STATUSES,
  validateMandatoryNote,
} from '../services/attendanceStatusService.js';

/**
 * GET /admin/exceptions/summary
 * Overview KPI metrics for the Admin Exception & Audit Dashboard
 */
export async function getAdminExceptionSummary(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  // 1. Pending attendance approvals
  const [pendingAtt] = await db
    .select({ count: count() })
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.orgId, orgId), eq(attendanceSessions.status, 'PENDING')));

  // 2. Pending leave requests
  const [pendingLeave] = await db
    .select({ count: count() })
    .from(leaveRequests)
    .where(and(eq(leaveRequests.orgId, orgId), eq(leaveRequests.status, 'PENDING')));

  // 3. Open missing-attendance exceptions
  const [missingAtt] = await db
    .select({ count: count() })
    .from(attendanceExceptions)
    .where(
      and(
        eq(attendanceExceptions.orgId, orgId),
        eq(attendanceExceptions.exceptionType, 'MISSING_CLOCK_IN'),
        sql`${attendanceExceptions.status} IN ('OPEN', 'INVESTIGATING')`
      )
    );

  // 4. Missing clock-outs
  const [missingClockOut] = await db
    .select({ count: count() })
    .from(attendanceExceptions)
    .where(
      and(
        eq(attendanceExceptions.orgId, orgId),
        eq(attendanceExceptions.exceptionType, 'MISSING_CLOCK_OUT'),
        sql`${attendanceExceptions.status} IN ('OPEN', 'INVESTIGATING')`
      )
    );

  // 5. Pending correction requests
  const [pendingCorrections] = await db
    .select({ count: count() })
    .from(attendanceAdjustmentRequests)
    .where(eq(attendanceAdjustmentRequests.status, 'PENDING'));

  // 6. Overdue approvals / Escalated requests
  const [escalatedAtt] = await db
    .select({ count: count() })
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        eq(attendanceSessions.isEscalated, true),
        eq(attendanceSessions.status, 'PENDING')
      )
    );

  const [escalatedLeaves] = await db
    .select({ count: count() })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.orgId, orgId),
        eq(leaveRequests.isEscalated, true),
        eq(leaveRequests.status, 'PENDING')
      )
    );

  // 7. Awaiting admin reassignment (escalated with no currentApproverId)
  const [awaitingReassignment] = await db
    .select({ count: count() })
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        eq(attendanceSessions.isEscalated, true),
        eq(attendanceSessions.status, 'PENDING'),
        sql`${attendanceSessions.currentApproverId} IS NULL`
      )
    );

  return res.json({
    pendingAttendance: Number(pendingAtt?.count || 0),
    pendingLeave: Number(pendingLeave?.count || 0),
    missingAttendance: Number(missingAtt?.count || 0),
    missingClockOuts: Number(missingClockOut?.count || 0),
    pendingCorrections: Number(pendingCorrections?.count || 0),
    escalatedRequests: Number(escalatedAtt?.count || 0) + Number(escalatedLeaves?.count || 0),
    awaitingAdminReassignment: Number(awaitingReassignment?.count || 0),
  });
}

/**
 * GET /admin/exceptions
 * List all attendance exceptions with filtering & pagination
 */
export async function getAdminExceptionsList(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  const {
    startDate,
    endDate,
    worksiteId,
    workerId,
    exceptionType,
    status,
    severity,
  } = req.query as Record<string, string>;

  const query = db
    .select({
      id: attendanceExceptions.id,
      workerId: attendanceExceptions.workerId,
      worksiteId: attendanceExceptions.worksiteId,
      assignmentId: attendanceExceptions.assignmentId,
      sessionId: attendanceExceptions.sessionId,
      leaveRequestId: attendanceExceptions.leaveRequestId,
      workDate: attendanceExceptions.workDate,
      exceptionType: attendanceExceptions.exceptionType,
      severity: attendanceExceptions.severity,
      status: attendanceExceptions.status,
      primarySupervisorId: attendanceExceptions.primarySupervisorId,
      currentApproverId: attendanceExceptions.currentApproverId,
      isEscalated: attendanceExceptions.isEscalated,
      escalatedAt: attendanceExceptions.escalatedAt,
      escalationReason: attendanceExceptions.escalationReason,
      resolutionType: attendanceExceptions.resolutionType,
      resolutionNote: attendanceExceptions.resolutionNote,
      resolvedAt: attendanceExceptions.resolvedAt,
      createdAt: attendanceExceptions.createdAt,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      workerPhoto: users.photoUrl,
      worksiteName: worksites.name,
      sessionStatus: attendanceSessions.status,
    })
    .from(attendanceExceptions)
    .innerJoin(users, eq(attendanceExceptions.workerId, users.id))
    .leftJoin(worksites, eq(attendanceExceptions.worksiteId, worksites.id))
    .leftJoin(attendanceSessions, eq(attendanceExceptions.sessionId, attendanceSessions.id))
    .where(
      and(
        eq(attendanceExceptions.orgId, orgId),
        exceptionType ? eq(attendanceExceptions.exceptionType, exceptionType) : sql`1=1`,
        status ? eq(attendanceExceptions.status, status) : sql`1=1`,
        severity ? eq(attendanceExceptions.severity, severity) : sql`1=1`,
        workerId ? eq(attendanceExceptions.workerId, workerId) : sql`1=1`,
        worksiteId ? eq(attendanceExceptions.worksiteId, worksiteId) : sql`1=1`,
        startDate ? sql`${attendanceExceptions.workDate} >= ${startDate}` : sql`1=1`,
        endDate ? sql`${attendanceExceptions.workDate} <= ${endDate}` : sql`1=1`
      )
    )
    .orderBy(desc(attendanceExceptions.createdAt));

  const list = await query;

  // Resolve supervisor names
  const supervisorIds = list.map((i) => i.primarySupervisorId).filter(Boolean) as string[];
  const approverIds = list.map((i) => i.currentApproverId).filter(Boolean) as string[];
  const allUserIds = [...new Set([...supervisorIds, ...approverIds])];

  const nameMap: Record<string, string> = {};
  if (allUserIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, allUserIds));

    for (const u of userRows) {
      nameMap[u.id] = u.fullName;
    }
  }

  const enriched = list.map((item) => ({
    ...item,
    primarySupervisorName: item.primarySupervisorId ? nameMap[item.primarySupervisorId] || 'Unassigned' : 'Unassigned',
    currentApproverName: item.currentApproverId ? nameMap[item.currentApproverId] || 'Admin Queue' : 'Admin Queue',
  }));

  return res.json(enriched);
}

/**
 * GET /admin/exceptions/:id
 * Full case detail with routing timeline, related session, and audit events
 */
export async function getAdminExceptionDetail(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [exception] = await db
    .select({
      id: attendanceExceptions.id,
      workerId: attendanceExceptions.workerId,
      worksiteId: attendanceExceptions.worksiteId,
      assignmentId: attendanceExceptions.assignmentId,
      sessionId: attendanceExceptions.sessionId,
      leaveRequestId: attendanceExceptions.leaveRequestId,
      workDate: attendanceExceptions.workDate,
      exceptionType: attendanceExceptions.exceptionType,
      severity: attendanceExceptions.severity,
      status: attendanceExceptions.status,
      primarySupervisorId: attendanceExceptions.primarySupervisorId,
      currentApproverId: attendanceExceptions.currentApproverId,
      isEscalated: attendanceExceptions.isEscalated,
      escalatedAt: attendanceExceptions.escalatedAt,
      escalationReason: attendanceExceptions.escalationReason,
      resolutionType: attendanceExceptions.resolutionType,
      resolutionNote: attendanceExceptions.resolutionNote,
      resolvedAt: attendanceExceptions.resolvedAt,
      resolvedBy: attendanceExceptions.resolvedBy,
      createdAt: attendanceExceptions.createdAt,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      workerPhoto: users.photoUrl,
      worksiteName: worksites.name,
      worksiteAddress: worksites.address,
    })
    .from(attendanceExceptions)
    .innerJoin(users, eq(attendanceExceptions.workerId, users.id))
    .leftJoin(worksites, eq(attendanceExceptions.worksiteId, worksites.id))
    .where(and(eq(attendanceExceptions.id as any, id as any), eq(attendanceExceptions.orgId, orgId)))
    .limit(1);

  if (!exception) {
    return res.status(404).json({ error: 'EXCEPTION_NOT_FOUND', message: 'Exception record not found' });
  }

  // Related attendance session
  let session = null;
  if (exception.sessionId) {
    const [s] = await db
      .select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.id, exception.sessionId))
      .limit(1);
    session = s || null;
  }

  // Related leave request
  let leave = null;
  if (exception.leaveRequestId) {
    const [l] = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, exception.leaveRequestId))
      .limit(1);
    leave = l || null;
  }

  // Related audit logs
  const relatedLogs = await db
    .select()
    .from(auditLogs)
    .where(
      or(
        eq(auditLogs.entityId, String(id)),
        exception.sessionId ? eq(auditLogs.entityId, exception.sessionId) : sql`1=0`,
        exception.leaveRequestId ? eq(auditLogs.entityId, exception.leaveRequestId) : sql`1=0`
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(25);

  return res.json({
    exception,
    session,
    leave,
    auditHistory: relatedLogs,
  });
}

/**
 * POST /admin/exceptions/:id/reassign
 * Reassign an escalated request or exception to an authorized supervisor or admin
 */
const reassignSchema = z.object({
  targetApproverId: z.string().uuid(),
  reason: z.string().min(5, 'Reassignment reason is mandatory'),
});

export async function reassignException(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = reassignSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { targetApproverId, reason } = parseResult.data;
  const db = await getDb();
  const adminUser = req.user!;
  const now = new Date();

  // Verify target user exists
  const [targetUser] = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, targetApproverId))
    .limit(1);

  if (!targetUser) {
    return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Target approver not found' });
  }

  const [exception] = await db
    .select()
    .from(attendanceExceptions)
    .where(eq(attendanceExceptions.id as any, id as any))
    .limit(1);

  if (!exception) {
    return res.status(404).json({ error: 'EXCEPTION_NOT_FOUND' });
  }

  const [updated] = await db
    .update(attendanceExceptions)
    .set({
      currentApproverId: targetApproverId,
      isEscalated: true,
      escalatedAt: now,
      escalationReason: `Admin reassigned to ${targetUser.fullName}: ${reason}`,
      updatedAt: now,
    })
    .where(eq(attendanceExceptions.id as any, id as any))
    .returning();

  // If tied to a session, update session currentApproverId as well
  if (exception.sessionId) {
    await db
      .update(attendanceSessions)
      .set({
        currentApproverId: targetApproverId,
        isEscalated: true,
        escalatedAt: now,
        escalationReason: `Admin reassigned to ${targetUser.fullName}: ${reason}`,
        updatedAt: now,
      })
      .where(eq(attendanceSessions.id, exception.sessionId));
  }

  await logAuditEvent({
    orgId: adminUser.orgId,
    actorId: adminUser.id,
    actorNameSnapshot: adminUser.fullName,
    actorRole: adminUser.roles[0],
    action: 'ADMIN_REASSIGN_REQUEST',
    entityType: 'ATTENDANCE_EXCEPTION',
    entityId: id,
    reason,
    beforeValues: { currentApproverId: exception.currentApproverId },
    afterValues: { currentApproverId: targetApproverId, reassignedTo: targetUser.fullName },
    req,
  });

  return res.json({ success: true, message: `Reassigned to ${targetUser.fullName}`, exception: updated });
}

/**
 * POST /admin/attendance/:id/override
 * Administrative override for attendance status with mandatory justification and audit logging
 */
const overrideSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'ABSENT', 'MISSING', 'PENDING', 'LEAVE']),
  reason: z.string().trim().min(3, 'Mandatory administrative justification of at least 3 characters is required'),
  clockInTime: z.string().datetime().optional().nullable(),
  clockOutTime: z.string().datetime().optional().nullable(),
});

export async function administrativeAttendanceOverride(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = overrideSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid input data',
      details: parseResult.error.issues,
    });
  }

  const { status, reason, clockInTime, clockOutTime } = parseResult.data;
  const db = await getDb();
  const admin = req.user!;

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, admin.orgId as any)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  // Recalculate working duration if timestamps provided
  const finalIn = clockInTime ? new Date(clockInTime) : session.clockInTime;
  const finalOut = clockOutTime ? new Date(clockOutTime) : session.clockOutTime;
  let durSec = session.totalDurationSeconds || 0;
  if (finalIn && finalOut) {
    durSec = Math.max(0, Math.round((new Date(finalOut).getTime() - new Date(finalIn).getTime()) / 1000));
  }

  const { updatedSession } = await applyAttendanceStatusTransition({
    db,
    session,
    targetStatus: status as CanonicalAttendanceStatus,
    actorId: admin.id,
    actorRole: admin.roles[0] || 'ADMIN',
    actorNameSnapshot: admin.fullName,
    note: reason,
    actionType: 'ADMIN_OVERRIDE',
    clockInTime: finalIn,
    clockOutTime: finalOut,
    totalDurationSeconds: durSec,
    netWorkingSeconds: durSec,
    approvalSource: 'ADMIN_OVERRIDE',
    req,
  });

  return res.json({
    success: true,
    message: 'Administrative attendance override applied successfully',
    session: updatedSession,
  });
}

/**
 * POST /admin/escalation/run
 * Manual trigger for background escalation & missing attendance checks
 */
export async function triggerEscalationRun(req: Request, res: Response): Promise<any> {
  const orgId = req.user!.orgId;
  const overrideHours = req.body?.deadlineHours ? Number(req.body.deadlineHours) : undefined;

  const missingAttendanceCreated = await runMissingAttendanceCheck(orgId);
  const missingClockOutsCreated = await runMissingClockOutCheck(orgId);
  const overdueResults = await runOverdueEscalationCheck(orgId, overrideHours);

  return res.json({
    success: true,
    message: 'Escalation and missing attendance detection run executed',
    summary: {
      missingAttendanceCreated,
      missingClockOutsCreated,
      ...overdueResults,
    },
  });
}
