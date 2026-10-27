import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  attendanceSessions,
  attendanceEvents,
  siteAssignments,
  siteAssignmentWorkers,
  users,
  worksites,
  leaveRequests,
  leaveTypes,
  attendanceAdjustmentRequests,
  attendanceExceptions,
  notifications,
  approvalActions,
} from '../database/schema.js';
import { eq, and, or, sql, desc, inArray } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
import { isSupervisorAuthorizedForSession } from './attendanceController.js';

/**
 * Format milliseconds into human readable age (e.g. "4h 20m ago", "1d 2h ago")
 */
function formatAge(date: Date | string): string {
  const diffMs = Math.max(0, Date.now() - new Date(date).getTime());
  const totalMins = Math.floor(diffMs / (1000 * 60));
  if (totalMins < 60) return `${totalMins}m ago`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours < 24) return `${hours}h ${mins}m ago`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h ago`;
}

/**
 * GET /supervisor/queues
 * Centralized Supervisor Queues:
 * - pendingAttendance
 * - pendingLeave
 * - exceptions
 * - escalated
 */
export async function getSupervisorQueues(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const {
    section,
    startDate,
    endDate,
    worksiteId,
    workerId,
    status,
    exceptionType,
  } = req.query as Record<string, string>;

  // 1. Resolve supervisor's authorized worksites / assignments
  let authorizedAssignmentIds: string[] = [];
  let authorizedWorksiteIds: string[] = [];

  if (!isSuperOrAdmin) {
    const supervisorAssignments = await db
      .select({
        id: siteAssignments.id,
        worksiteId: siteAssignments.worksiteId,
        fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
      })
      .from(siteAssignments)
      .where(
        and(
          eq(siteAssignments.orgId, orgId),
          or(
            eq(siteAssignments.supervisorId, user.id),
            eq(siteAssignments.fallbackSupervisorId, user.id)
          )
        )
      );

    authorizedAssignmentIds = supervisorAssignments.map((a) => a.id);
    authorizedWorksiteIds = supervisorAssignments.map((a) => a.worksiteId);
  }

  // Helper authorization filter for sessions:
  const canAccessSession = (s: any) => {
    if (isSuperOrAdmin) return true;
    if (s.supervisorSnapshotId === user.id) return true;
    if (s.currentApproverId === user.id) return true;
    if (authorizedAssignmentIds.includes(s.assignmentId)) return true;
    if (authorizedWorksiteIds.includes(s.worksiteId)) return true;
    return false;
  };

  // ─── A. PENDING ATTENDANCE ──────────────────────────────────────────────────
  const fetchPendingAttendance = async () => {
    const query = db
      .select({
        id: attendanceSessions.id,
        sessionId: attendanceSessions.id,
        workDate: attendanceSessions.workDate,
        status: attendanceSessions.status,
        clockInTime: attendanceSessions.clockInTime,
        clockOutTime: attendanceSessions.clockOutTime,
        totalDurationSeconds: attendanceSessions.totalDurationSeconds,
        netWorkingSeconds: attendanceSessions.netWorkingSeconds,
        isAutoApproved: attendanceSessions.isAutoApproved,
        isEscalated: attendanceSessions.isEscalated,
        escalatedAt: attendanceSessions.escalatedAt,
        escalationReason: attendanceSessions.escalationReason,
        exceptionStatus: attendanceSessions.exceptionStatus,
        supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
        currentApproverId: attendanceSessions.currentApproverId,
        createdAt: attendanceSessions.createdAt,
        workerId: users.id,
        workerName: users.fullName,
        employeeCode: users.employeeCode,
        workerPhoto: users.photoUrl,
        worksiteId: worksites.id,
        worksiteName: worksites.name,
        worksiteCode: worksites.code,
        shiftName: siteAssignments.shiftName,
        shiftStartTime: siteAssignments.shiftStartTime,
        shiftEndTime: siteAssignments.shiftEndTime,
        fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
        assignmentId: siteAssignments.id,
      })
      .from(attendanceSessions)
      .innerJoin(users, eq(attendanceSessions.workerId, users.id))
      .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
      .innerJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
      .where(
        and(
          eq(attendanceSessions.orgId, orgId),
          eq(attendanceSessions.status, 'PENDING'),
          // Exclude supervisor's own attendance from their own queue
          sql`${attendanceSessions.workerId} != ${user.id}`
        )
      )
      .orderBy(desc(attendanceSessions.createdAt));

    const records = await query;

    // Fetch latest clock-in event for GPS/geofence photo & distance
    const sessionIds = records.map((r) => r.id);
    let eventMap: Record<string, any> = {};
    if (sessionIds.length > 0) {
      const events = await db
        .select()
        .from(attendanceEvents)
        .where(inArray(attendanceEvents.sessionId, sessionIds));

      for (const ev of events) {
        if (ev.eventType === 'CLOCK_IN' || !eventMap[ev.sessionId]) {
          eventMap[ev.sessionId] = ev;
        }
      }
    }

    return records
      .filter((r) => canAccessSession(r))
      .filter((r) => !workerId || r.workerId === workerId)
      .filter((r) => !worksiteId || r.worksiteId === worksiteId)
      .filter((r) => !startDate || String(r.workDate) >= startDate)
      .filter((r) => !endDate || String(r.workDate) <= endDate)
      .map((r) => {
        const ev = eventMap[r.id];
        const clockInDate = r.clockInTime ? new Date(r.clockInTime) : null;
        const clockOutDate = r.clockOutTime ? new Date(r.clockOutTime) : null;
        const netDurationSec = r.netWorkingSeconds || (clockInDate && clockOutDate ? Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 1000) : 0);

        return {
          ...r,
          requestAge: formatAge(r.createdAt),
          isWithinGeofence: ev ? ev.isWithinGeofence : true,
          isLocationBypassed: ev ? ev.isLocationBypassed : false,
          calculatedDistanceMeters: ev ? ev.calculatedDistanceMeters : 0,
          reportedAccuracyMeters: ev ? ev.reportedAccuracyMeters : 0,
          photoUrl: ev ? ev.photoUrl : null,
          hasMissingClockOut: !r.clockOutTime,
          netWorkingDurationFormatted: `${Math.floor(netDurationSec / 3600)}h ${Math.floor((netDurationSec % 3600) / 60)}m`,
        };
      });
  };

  // ─── B. PENDING LEAVE ───────────────────────────────────────────────────────
  const fetchPendingLeave = async () => {
    const query = db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        leaveTypeId: leaveRequests.leaveTypeId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        isHalfDay: leaveRequests.isHalfDay,
        halfDayPeriod: leaveRequests.halfDayPeriod,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        conflictStatus: leaveRequests.conflictStatus,
        conflictDetails: leaveRequests.conflictDetails,
        isEscalated: leaveRequests.isEscalated,
        escalatedAt: leaveRequests.escalatedAt,
        escalationReason: leaveRequests.escalationReason,
        currentApproverId: leaveRequests.currentApproverId,
        createdAt: leaveRequests.createdAt,
        workerName: users.fullName,
        employeeCode: users.employeeCode,
        workerPhoto: users.photoUrl,
        leaveTypeName: leaveTypes.name,
        leaveTypeCode: leaveTypes.code,
      })
      .from(leaveRequests)
      .innerJoin(users, eq(leaveRequests.userId, users.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(leaveRequests.orgId, orgId),
          eq(leaveRequests.status, 'PENDING'),
          // Exclude self approval
          sql`${leaveRequests.userId} != ${user.id}`
        )
      )
      .orderBy(desc(leaveRequests.createdAt));

    let records = await query;

    if (!isSuperOrAdmin) {
      const assignedWorkerRows = authorizedAssignmentIds.length > 0
        ? await db
            .select({ workerId: siteAssignmentWorkers.workerId })
            .from(siteAssignmentWorkers)
            .where(inArray(siteAssignmentWorkers.assignmentId, authorizedAssignmentIds))
        : [];
      const assignedWorkerIdSet = new Set(assignedWorkerRows.map((w: any) => w.workerId));
      records = records.filter((r) => assignedWorkerIdSet.has(r.userId) || r.currentApproverId === user.id);
    }

    return records
      .filter((r) => !workerId || r.userId === workerId)
      .filter((r) => !startDate || String(r.startDate) >= startDate)
      .filter((r) => !endDate || String(r.endDate) <= endDate)
      .map((r) => {
        const start = new Date(r.startDate).getTime();
        const end = new Date(r.endDate).getTime();
        const totalDays = r.isHalfDay ? 0.5 : Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

        return {
          ...r,
          durationDays: totalDays,
          requestAge: formatAge(r.createdAt),
          hasConflict: r.conflictStatus !== 'NONE',
        };
      });
  };

  // ─── C. ATTENDANCE EXCEPTIONS ──────────────────────────────────────────────
  const fetchExceptions = async () => {
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
        createdAt: attendanceExceptions.createdAt,
        workerName: users.fullName,
        employeeCode: users.employeeCode,
        workerPhoto: users.photoUrl,
        worksiteName: worksites.name,
      })
      .from(attendanceExceptions)
      .innerJoin(users, eq(attendanceExceptions.workerId, users.id))
      .leftJoin(worksites, eq(attendanceExceptions.worksiteId, worksites.id))
      .where(
        and(
          eq(attendanceExceptions.orgId, orgId),
          status ? eq(attendanceExceptions.status, status) : sql`${attendanceExceptions.status} IN ('OPEN', 'INVESTIGATING', 'ESCALATED')`,
          exceptionType ? eq(attendanceExceptions.exceptionType, exceptionType) : sql`1=1`
        )
      )
      .orderBy(desc(attendanceExceptions.createdAt));

    const records = await query;

    return records
      .filter((r) => isSuperOrAdmin || r.primarySupervisorId === user.id || r.currentApproverId === user.id || (r.worksiteId && authorizedWorksiteIds.includes(r.worksiteId)))
      .filter((r) => !workerId || r.workerId === workerId)
      .filter((r) => !worksiteId || r.worksiteId === worksiteId)
      .filter((r) => !startDate || String(r.workDate) >= startDate)
      .filter((r) => !endDate || String(r.workDate) <= endDate)
      .map((r) => ({
        ...r,
        age: formatAge(r.createdAt),
      }));
  };

  // ─── D. ESCALATED REQUESTS ─────────────────────────────────────────────────
  const fetchEscalated = async () => {
    // 1. Escalated Attendance Sessions
    const escalatedAttendance = await db
      .select({
        id: attendanceSessions.id,
        workerId: attendanceSessions.workerId,
        workDate: attendanceSessions.workDate,
        status: attendanceSessions.status,
        escalatedAt: attendanceSessions.escalatedAt,
        escalationReason: attendanceSessions.escalationReason,
        primarySupervisorId: attendanceSessions.supervisorSnapshotId,
        currentApproverId: attendanceSessions.currentApproverId,
        createdAt: attendanceSessions.createdAt,
        workerName: users.fullName,
        employeeCode: users.employeeCode,
        worksiteName: worksites.name,
      })
      .from(attendanceSessions)
      .innerJoin(users, eq(attendanceSessions.workerId, users.id))
      .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
      .where(
        and(
          eq(attendanceSessions.orgId, orgId),
          eq(attendanceSessions.isEscalated, true),
          eq(attendanceSessions.status, 'PENDING')
        )
      );

    // 2. Escalated Leave Requests
    const escalatedLeaves = await db
      .select({
        id: leaveRequests.id,
        workerId: leaveRequests.userId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        status: leaveRequests.status,
        escalatedAt: leaveRequests.escalatedAt,
        escalationReason: leaveRequests.escalationReason,
        currentApproverId: leaveRequests.currentApproverId,
        createdAt: leaveRequests.createdAt,
        workerName: users.fullName,
        employeeCode: users.employeeCode,
        leaveTypeName: leaveTypes.name,
      })
      .from(leaveRequests)
      .innerJoin(users, eq(leaveRequests.userId, users.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(leaveRequests.orgId, orgId),
          eq(leaveRequests.isEscalated, true),
          eq(leaveRequests.status, 'PENDING')
        )
      );

    // 3. Escalated Correction Requests
    const escalatedCorrections = await db
      .select({
        id: attendanceAdjustmentRequests.id,
        workerId: attendanceAdjustmentRequests.requestingUserId,
        workDate: attendanceAdjustmentRequests.workDate,
        status: attendanceAdjustmentRequests.status,
        escalatedAt: attendanceAdjustmentRequests.escalatedAt,
        escalationReason: attendanceAdjustmentRequests.escalationReason,
        currentApproverId: attendanceAdjustmentRequests.currentApproverId,
        createdAt: attendanceAdjustmentRequests.createdAt,
        reason: attendanceAdjustmentRequests.reason,
        correctionType: attendanceAdjustmentRequests.correctionType,
        workerName: users.fullName,
        employeeCode: users.employeeCode,
      })
      .from(attendanceAdjustmentRequests)
      .innerJoin(users, eq(attendanceAdjustmentRequests.requestingUserId, users.id))
      .where(
        and(
          eq(attendanceAdjustmentRequests.isEscalated, true),
          eq(attendanceAdjustmentRequests.status, 'PENDING')
        )
      );

    const items: any[] = [];

    for (const a of escalatedAttendance) {
      if (isSuperOrAdmin || a.currentApproverId === user.id || a.primarySupervisorId === user.id) {
        items.push({
          id: a.id,
          requestType: 'ATTENDANCE',
          workerId: a.workerId,
          workerName: a.workerName,
          employeeCode: a.employeeCode,
          summary: `Attendance verification on ${a.workDate} (${a.worksiteName})`,
          escalatedAt: a.escalatedAt,
          escalationReason: a.escalationReason,
          primarySupervisorId: a.primarySupervisorId,
          currentApproverId: a.currentApproverId,
          status: a.status,
          age: formatAge(a.createdAt),
        });
      }
    }

    for (const l of escalatedLeaves) {
      items.push({
        id: l.id,
        requestType: 'LEAVE',
        workerId: l.workerId,
        workerName: l.workerName,
        employeeCode: l.employeeCode,
        summary: `${l.leaveTypeName}: ${l.startDate} to ${l.endDate}`,
        escalatedAt: l.escalatedAt,
        escalationReason: l.escalationReason,
        currentApproverId: l.currentApproverId,
        status: l.status,
        age: formatAge(l.createdAt),
      });
    }

    for (const c of escalatedCorrections) {
      items.push({
        id: c.id,
        requestType: 'CORRECTION',
        workerId: c.workerId,
        workerName: c.workerName,
        employeeCode: c.employeeCode,
        summary: `Regularization (${c.correctionType}) for ${c.workDate}: ${c.reason}`,
        escalatedAt: c.escalatedAt,
        escalationReason: c.escalationReason,
        currentApproverId: c.currentApproverId,
        status: c.status,
        age: formatAge(c.createdAt),
      });
    }

    return items;
  };

  // Compile response based on section or all
  const result: any = {};

  if (!section || section === 'attendance') {
    result.pendingAttendance = await fetchPendingAttendance();
  }
  if (!section || section === 'leave') {
    result.pendingLeave = await fetchPendingLeave();
  }
  if (!section || section === 'exceptions') {
    result.exceptions = await fetchExceptions();
  }
  if (!section || section === 'escalated') {
    result.escalated = await fetchEscalated();
  }

  // Summary counts
  result.counts = {
    pendingAttendance: result.pendingAttendance ? result.pendingAttendance.length : (await fetchPendingAttendance()).length,
    pendingLeave: result.pendingLeave ? result.pendingLeave.length : (await fetchPendingLeave()).length,
    exceptions: result.exceptions ? result.exceptions.length : (await fetchExceptions()).length,
    escalated: result.escalated ? result.escalated.length : (await fetchEscalated()).length,
  };

  return res.json(result);
}

/**
 * POST /supervisor/queues/exceptions/:id/resolve
 * Resolve an attendance exception
 */
const resolveExceptionSchema = z.object({
  resolutionType: z.enum([
    'UNEXCUSED_ABSENCE',
    'APPROVED_LEAVE',
    'CONFIGURATION_ERROR',
    'CORRECTION_REQUIRED',
    'LATE_ARRIVAL',
    'EXCUSED_ABSENCE',
    'DUPLICATE_INVALID',
    'OTHER',
  ]),
  resolutionNote: z.string().min(3, 'Resolution note must be at least 3 characters'),
});

export async function resolveException(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = resolveExceptionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { resolutionType, resolutionNote } = parseResult.data;
  const db = await getDb();
  const reviewer = req.user!;

  const [exception] = await db
    .select()
    .from(attendanceExceptions)
    .where(
      and(
        eq(attendanceExceptions.id as any, id as any),
        eq(attendanceExceptions.orgId as any, reviewer.orgId as any)
      )
    )
    .limit(1);

  if (!exception) {
    return res.status(404).json({ error: 'EXCEPTION_NOT_FOUND', message: 'Attendance exception not found' });
  }

  if (exception.status === 'RESOLVED') {
    return res.status(400).json({ error: 'ALREADY_RESOLVED', message: 'This exception is already resolved' });
  }

  const now = new Date();
  const [updated] = await db
    .update(attendanceExceptions)
    .set({
      status: 'RESOLVED',
      resolutionType,
      resolutionNote,
      resolvedBy: reviewer.id,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceExceptions.id as any, id as any))
    .returning();

  // If this exception is related to a session (e.g. MISSING_CLOCK_OUT), update session exceptionStatus
  if (exception.sessionId) {
    await db
      .update(attendanceSessions)
      .set({
        exceptionStatus: `RESOLVED_${resolutionType}`,
        updatedAt: now,
      })
      .where(eq(attendanceSessions.id, exception.sessionId));
  }

  // Notify worker
  await db.insert(notifications).values({
    userId: exception.workerId,
    title: 'Attendance Exception Resolved',
    message: `Your attendance exception for ${exception.workDate} was resolved as ${resolutionType}. Note: ${resolutionNote}`,
    type: 'EXCEPTION_RESOLVED',
    entityType: 'ATTENDANCE_EXCEPTION',
    entityId: exception.id,
  });

  // Audit log
  await logAuditEvent({
    orgId: reviewer.orgId,
    actorId: reviewer.id,
    actorNameSnapshot: reviewer.fullName,
    actorRole: reviewer.roles[0],
    action: 'RESOLVE_ATTENDANCE_EXCEPTION',
    entityType: 'ATTENDANCE_EXCEPTION',
    entityId: exception.id,
    reason: resolutionNote,
    beforeValues: { status: exception.status, resolutionType: exception.resolutionType },
    afterValues: { status: 'RESOLVED', resolutionType, resolutionNote },
    req,
  });

  return res.json({ success: true, message: 'Exception resolved successfully', exception: updated });
}

/**
 * POST /supervisor/queues/:itemType/:id/escalate
 * Manually escalate a request (attendance, leave, correction, or exception)
 */
const escalateRequestSchema = z.object({
  reason: z.string().min(5, 'Escalation reason must be at least 5 characters'),
  targetApproverId: z.string().uuid().optional(),
});

export async function manualEscalateRequest(req: Request, res: Response): Promise<any> {
  const { itemType, id } = req.params;
  const parseResult = escalateRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { reason, targetApproverId } = parseResult.data;
  const db = await getDb();
  const actor = req.user!;
  const now = new Date();

  if (itemType === 'attendance') {
    const [session] = await db
      .select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.id as any, id as any))
      .limit(1);

    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' });

    await db
      .update(attendanceSessions)
      .set({
        isEscalated: true,
        escalatedAt: now,
        escalationReason: reason,
        currentApproverId: targetApproverId || null,
        updatedAt: now,
      })
      .where(eq(attendanceSessions.id as any, id as any));

    await logAuditEvent({
      orgId: actor.orgId,
      actorId: actor.id,
      actorNameSnapshot: actor.fullName,
      actorRole: actor.roles[0],
      action: 'MANUAL_ESCALATE_ATTENDANCE',
      entityType: 'ATTENDANCE_SESSION',
      entityId: id,
      reason,
      afterValues: { isEscalated: true, currentApproverId: targetApproverId, escalationReason: reason },
      req,
    });

    return res.json({ success: true, message: 'Attendance request escalated' });
  }

  if (itemType === 'leave') {
    const [leave] = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id as any, id as any))
      .limit(1);

    if (!leave) return res.status(404).json({ error: 'LEAVE_NOT_FOUND' });

    await db
      .update(leaveRequests)
      .set({
        isEscalated: true,
        escalatedAt: now,
        escalationReason: reason,
        currentApproverId: targetApproverId || null,
        updatedAt: now,
      })
      .where(eq(leaveRequests.id as any, id as any));

    await logAuditEvent({
      orgId: actor.orgId,
      actorId: actor.id,
      actorNameSnapshot: actor.fullName,
      actorRole: actor.roles[0],
      action: 'MANUAL_ESCALATE_LEAVE',
      entityType: 'LEAVE_REQUEST',
      entityId: id,
      reason,
      afterValues: { isEscalated: true, currentApproverId: targetApproverId, escalationReason: reason },
      req,
    });

    return res.json({ success: true, message: 'Leave request escalated' });
  }

  if (itemType === 'exception') {
    const [ex] = await db
      .select()
      .from(attendanceExceptions)
      .where(eq(attendanceExceptions.id as any, id as any))
      .limit(1);

    if (!ex) return res.status(404).json({ error: 'EXCEPTION_NOT_FOUND' });

    await db
      .update(attendanceExceptions)
      .set({
        status: 'ESCALATED',
        isEscalated: true,
        escalatedAt: now,
        escalationReason: reason,
        currentApproverId: targetApproverId || null,
        updatedAt: now,
      })
      .where(eq(attendanceExceptions.id as any, id as any));

    await logAuditEvent({
      orgId: actor.orgId,
      actorId: actor.id,
      actorNameSnapshot: actor.fullName,
      actorRole: actor.roles[0],
      action: 'MANUAL_ESCALATE_EXCEPTION',
      entityType: 'ATTENDANCE_EXCEPTION',
      entityId: id,
      reason,
      afterValues: { status: 'ESCALATED', isEscalated: true, currentApproverId: targetApproverId },
      req,
    });

    return res.json({ success: true, message: 'Exception escalated' });
  }

  return res.status(400).json({ error: 'INVALID_ITEM_TYPE' });
}

/**
 * POST /supervisor/queues/:itemType/:id/clarification
 * Request clarification from worker regarding an attendance or leave item
 */
const clarificationSchema = z.object({
  message: z.string().min(5, 'Clarification note must be at least 5 characters'),
});

export async function requestClarification(req: Request, res: Response): Promise<any> {
  const { itemType, id } = req.params;
  const parseResult = clarificationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { message } = parseResult.data;
  const db = await getDb();
  const actor = req.user!;

  let targetUserId: string | null = null;
  let title = 'Supervisor Clarification Requested';

  if (itemType === 'attendance') {
    const [s] = await db.select({ workerId: attendanceSessions.workerId }).from(attendanceSessions).where(eq(attendanceSessions.id as any, id as any));
    targetUserId = s?.workerId || null;
    title = 'Clarification Requested on Attendance';
  } else if (itemType === 'leave') {
    const [l] = await db.select({ userId: leaveRequests.userId }).from(leaveRequests).where(eq(leaveRequests.id as any, id as any));
    targetUserId = l?.userId || null;
    title = 'Clarification Requested on Leave';
  } else if (itemType === 'exception') {
    const [e] = await db.select({ workerId: attendanceExceptions.workerId }).from(attendanceExceptions).where(eq(attendanceExceptions.id as any, id as any));
    targetUserId = e?.workerId || null;
    title = 'Clarification Requested on Attendance Exception';
  }

  if (!targetUserId) {
    return res.status(404).json({ error: 'TARGET_NOT_FOUND', message: 'Record not found to request clarification' });
  }

  await db.insert(notifications).values({
    userId: targetUserId,
    title,
    message: `Supervisor ${actor.fullName} requested clarification: "${message}"`,
    type: 'CLARIFICATION_REQUESTED',
    entityType: itemType.toUpperCase(),
    entityId: id as any,
  });

  await logAuditEvent({
    orgId: actor.orgId,
    actorId: actor.id,
    actorNameSnapshot: actor.fullName,
    actorRole: actor.roles[0],
    action: 'REQUEST_CLARIFICATION',
    entityType: itemType.toUpperCase(),
    entityId: id,
    reason: message,
    req,
  });

  return res.json({ success: true, message: 'Clarification request sent to worker' });
}
