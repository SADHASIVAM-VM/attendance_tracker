import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  attendanceSessions,
  approvalActions,
  auditLogs,
  users,
  worksites,
  siteAssignments,
  siteAssignmentWorkers,
  organizations,
  notifications,
  attendanceAdjustmentRequests,
  attendanceFlags,
  leaveRequests,
} from '../database/schema.js';
import { eq, and, sql, desc, or, ne, inArray } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
import { calculateSessionOvertime } from '../services/overtimeService.js';
import { isSupervisorAuthorizedForSession } from './attendanceController.js';
import {
  getOrgCurrentMonth,
  isCurrentCalendarMonth,
  isPreviousCalendarMonth,
  isFutureDate,
} from '../utils/dateUtils.js';

const supervisorOverrideSchema = z.object({
  workerId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  status: z.enum(['APPROVED', 'REJECTED', 'ABSENT', 'MISSING', 'PENDING', 'LEAVE']),
  clockInTime: z.string().datetime().nullable().optional(),
  clockOutTime: z.string().datetime().nullable().optional(),
  reason: z
    .string()
    .trim()
    .min(3, 'A meaningful override reason of at least 3 characters is required'),
  remarks: z.string().trim().optional(),
});

/**
 * Helper to fetch org timezone
 */
async function getOrgTimezone(db: any, orgId: string): Promise<string> {
  const [org] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return org?.timezone || 'Asia/Kolkata';
}

/**
 * POST /attendance/supervisor/override
 * Section 2: Current-Month Attendance Override by Supervisor
 */
export async function applySupervisorAttendanceOverride(req: Request, res: Response): Promise<any> {
  const parseResult = supervisorOverrideSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_OVERRIDE_DATA',
      message: parseResult.error.issues[0]?.message || 'Invalid override input',
      details: parseResult.error.issues,
    });
  }

  const { workerId, workDate, status: newStatus, clockInTime, clockOutTime, reason, remarks } =
    parseResult.data;

  // Reject whitespace-only reasons
  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({
      error: 'REASON_REQUIRED',
      message: 'A meaningful non-empty reason of at least 5 characters is required for an attendance override',
    });
  }

  const db = await getDb();
  const supervisor = req.user!;
  const orgId = supervisor.orgId;

  // 1. Validate date against current calendar month using org timezone
  const orgTz = await getOrgTimezone(db, orgId);
  const { monthStr, todayStr } = getOrgCurrentMonth(orgTz);

  // Requirement: Allow the supervisor to edit only the current month's records
  if (!isCurrentCalendarMonth(workDate, orgTz)) {
    return res.status(403).json({
      error: 'CURRENT_MONTH_ONLY',
      message: `Supervisor overrides are restricted to the current calendar month (${monthStr}). Date ${workDate} falls outside the current calendar month; please use the Worker Regularisation or Admin Attendance Correction workflow.`,
    });
  }

  // Requirement: Do not allow future attendance dates to be overridden
  if (isFutureDate(workDate, orgTz)) {
    return res.status(400).json({
      error: 'FUTURE_DATE_NOT_ALLOWED',
      message: `Future attendance dates (${workDate}) cannot be overridden.`,
    });
  }

  // 2. Find existing attendance session
  // Requirement: An override must not silently create a normal clock-in event for a worker who never clocked in.
  let [session] = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.workerId, workerId),
        sql`${attendanceSessions.workDate} = ${workDate}::date`,
        eq(attendanceSessions.orgId, orgId)
      )
    )
    .limit(1);

  if (!session) {
    return res.status(400).json({
      error: 'NO_ATTENDANCE_SESSION',
      message: `No attendance record exists for this worker on ${workDate}. Nonexistent clock-ins cannot be silently created as normal attendance via supervisor override. Please use the Worker Regularisation or Admin Attendance Correction workflow.`,
    });
  }

  // 3. Authorization check
  // Requirement: Do not let supervisor override another site's workers unless they have explicit authorization.
  const isAuthorized = await isSupervisorAuthorizedForSession(db, session, supervisor);
  if (!isAuthorized) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_SCOPE',
      message: 'You are not authorized to override attendance for workers outside your assigned sites.',
    });
  }

  // 4. Payroll lock protection
  // Requirement: If a correction affects a finalized payroll period, require admin authorization.
  if (session.isPayrollLocked || session.payrollPeriodId) {
    return res.status(400).json({
      error: 'PAYROLL_LOCKED',
      message: 'This attendance record is part of a locked or finalized payroll period and cannot be modified by a supervisor override. Please escalate to an Administrator.',
    });
  }

  const now = new Date();
  const effectiveIn = clockInTime !== undefined ? (clockInTime ? new Date(clockInTime) : null) : session.clockInTime;
  const effectiveOut = clockOutTime !== undefined ? (clockOutTime ? new Date(clockOutTime) : null) : session.clockOutTime;

  let totalDurationSeconds = session.totalDurationSeconds || 0;
  if (effectiveIn && effectiveOut) {
    totalDurationSeconds = Math.max(0, Math.round((effectiveOut.getTime() - effectiveIn.getTime()) / 1000));
  }

  const breakMinutes = session.breakDurationMinutes || 0;
  const otCalc = calculateSessionOvertime(
    effectiveIn,
    effectiveOut,
    newStatus,
    breakMinutes,
    {
      standardHoursMinutes: session.standardHoursMinutes || 540,
      defaultBreakMinutes: breakMinutes,
      policyVersion: session.policyVersionSnapshot || 'v1.0',
    }
  );

  const beforeValues = {
    status: session.status,
    clockInTime: session.clockInTime,
    clockOutTime: session.clockOutTime,
    totalDurationSeconds: session.totalDurationSeconds,
    netWorkingSeconds: session.netWorkingSeconds,
  };

  const cleanNote = remarks ? `${remarks} (Reason: ${reason})` : reason;

  // 5. Update session atomically
  const [updatedSession] = await db
    .update(attendanceSessions)
    .set({
      status: newStatus,
      notes: cleanNote,
      actionBy: supervisor.id,
      currentApproverId: supervisor.id,
      clockInTime: effectiveIn,
      clockOutTime: effectiveOut,
      totalDurationSeconds,
      netWorkingSeconds: otCalc.netWorkingMinutes * 60,
      calculatedOtMinutes: otCalc.calculatedOtMinutes,
      approvedOtMinutes: newStatus === 'APPROVED' ? otCalc.calculatedOtMinutes : 0,
      otStatus: otCalc.otStatus,
      approvalSource: 'SUPERVISOR_OVERRIDE',
      approvedAt: newStatus === 'APPROVED' ? now : session.approvedAt,
      rejectionReason: (newStatus === 'REJECTED' || newStatus === 'ABSENT') ? reason : null,
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id, session.id))
    .returning();

  // 6. Record in approval_actions (Immutable Attendance Audit History)
  await db.insert(approvalActions).values({
    sessionId: session.id,
    workerId: session.workerId,
    workDate: session.workDate,
    previousStatus: session.status,
    newStatus,
    action: 'SUPERVISOR_OVERRIDE',
    actionType: 'SUPERVISOR_OVERRIDE',
    reviewerId: supervisor.id,
    actorRole: supervisor.roles[0] || 'SUPERVISOR',
    reason,
    note: cleanNote,
    performedAt: now,
  });

  // 7. Record immutable audit log
  await logAuditEvent({
    orgId,
    actorId: supervisor.id,
    actorNameSnapshot: supervisor.fullName,
    actorRole: supervisor.roles[0],
    action: 'SUPERVISOR_ATTENDANCE_OVERRIDE',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    reason,
    beforeValues,
    afterValues: {
      status: newStatus,
      clockInTime: effectiveIn,
      clockOutTime: effectiveOut,
      totalDurationSeconds,
      reason,
      remarks,
    },
    req,
  });

  // 8. Notify worker
  await db.insert(notifications).values({
    userId: workerId,
    title: 'Attendance Status Override',
    message: `Supervisor ${supervisor.fullName} updated your attendance for ${workDate} to ${newStatus}. Reason: ${reason}`,
    type: 'ATTENDANCE_OVERRIDE',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
  });

  return res.json({
    success: true,
    message: `Attendance for ${workDate} successfully overridden to ${newStatus}`,
    session: updatedSession,
  });
}

/**
 * GET /attendance/supervisor/overrides
 * Section 1 & 2: Historical supervisor overrides table within supervisor's scope
 */
export async function getSupervisorOverrides(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const supervisor = req.user!;
  const orgId = supervisor.orgId;
  const isSuperOrAdmin = supervisor.roles.includes('SUPER_ADMIN') || supervisor.roles.includes('ADMIN');

  // Query approval_actions of type SUPERVISOR_OVERRIDE
  const rows = await db
    .select({
      id: approvalActions.id,
      sessionId: approvalActions.sessionId,
      action: approvalActions.action,
      reason: approvalActions.reason,
      note: approvalActions.note,
      performedAt: approvalActions.performedAt,
      // Reviewer info
      reviewerId: approvalActions.reviewerId,
      supervisorName: users.fullName,
      // Session info
      workDate: attendanceSessions.workDate,
      sessionStatus: attendanceSessions.status,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      workerId: attendanceSessions.workerId,
      worksiteSnapshotId: attendanceSessions.worksiteSnapshotId,
    })
    .from(approvalActions)
    .innerJoin(attendanceSessions, eq(approvalActions.sessionId, attendanceSessions.id))
    .innerJoin(users, eq(approvalActions.reviewerId, users.id))
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        eq(approvalActions.action, 'SUPERVISOR_OVERRIDE')
      )
    )
    .orderBy(desc(approvalActions.performedAt))
    .limit(100);

  // Filter for supervisor scope if not admin
  let filtered = rows;
  if (!isSuperOrAdmin) {
    filtered = rows.filter((r) => r.reviewerId === supervisor.id);
  }

  // Enrich with worker and worksite names
  const workerIds = Array.from(new Set(filtered.map((r) => r.workerId)));
  const worksiteIds = Array.from(new Set(filtered.map((r) => r.worksiteSnapshotId)));

  const workerMap: Record<string, { name: string; employeeCode: string; photoUrl: string | null }> = {};
  if (workerIds.length > 0) {
    const workerUsers = await db
      .select({ id: users.id, fullName: users.fullName, employeeCode: users.employeeCode, photoUrl: users.photoUrl })
      .from(users)
      .where(inArray(users.id, workerIds));
    for (const u of workerUsers) {
      workerMap[u.id] = { name: u.fullName, employeeCode: u.employeeCode, photoUrl: u.photoUrl };
    }
  }

  const siteMap: Record<string, string> = {};
  if (worksiteIds.length > 0) {
    const siteRows = await db
      .select({ id: worksites.id, name: worksites.name })
      .from(worksites)
      .where(inArray(worksites.id, worksiteIds));
    for (const ws of siteRows) {
      siteMap[ws.id] = ws.name;
    }
  }

  const enriched = filtered.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    workDate: r.workDate,
    status: r.sessionStatus,
    clockInTime: r.clockInTime,
    clockOutTime: r.clockOutTime,
    reason: r.reason || r.note,
    performedAt: r.performedAt,
    supervisorName: r.supervisorName,
    workerId: r.workerId,
    workerName: workerMap[r.workerId]?.name || 'Worker',
    employeeCode: workerMap[r.workerId]?.employeeCode || '',
    workerAvatar: workerMap[r.workerId]?.photoUrl,
    worksiteName: siteMap[r.worksiteSnapshotId] || 'Assigned Worksite',
  }));

  return res.json({ overrides: enriched });
}

/**
 * GET /attendance/supervisor/summary
 * Section 1: Summary cards for Supervisor Attendance Dashboard
 */
export async function getSupervisorAttendanceSummary(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const supervisor = req.user!;
  const orgId = supervisor.orgId;
  const isSuperOrAdmin = supervisor.roles.includes('SUPER_ADMIN') || supervisor.roles.includes('ADMIN');

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const dateParam = String(req.query.date || todayStr);
  const worksiteIdParam = req.query.worksiteId ? String(req.query.worksiteId) : undefined;

  // 1. Fetch site assignments within scope
  const allAssignments = await db
    .select({
      id: siteAssignments.id,
      worksiteId: siteAssignments.worksiteId,
      supervisorId: siteAssignments.supervisorId,
      fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
      workDate: siteAssignments.workDate,
      carryForward: siteAssignments.carryForward,
      status: siteAssignments.status,
    })
    .from(siteAssignments)
    .where(
      and(
        eq(siteAssignments.orgId, orgId),
        ne(siteAssignments.status, 'CANCELLED')
      )
    );

  const targetAssignments = allAssignments.filter((a) => {
    const aDate = String(a.workDate).split('T')[0];
    const isCarry = a.carryForward !== false;
    const matchesDate = aDate === dateParam || (isCarry && aDate <= dateParam);
    const matchesSite = !worksiteIdParam || a.worksiteId === worksiteIdParam;
    const isSupervisorAuth =
      isSuperOrAdmin || a.supervisorId === supervisor.id || (a.fallbackSupervisorId && a.fallbackSupervisorId === supervisor.id);
    return matchesDate && matchesSite && isSupervisorAuth;
  });

  const assignmentIds = targetAssignments.map((a) => a.id);

  // 2. Assigned workers
  let assignedWorkerCount = 0;
  let assignedWorkerIds = new Set<string>();
  if (assignmentIds.length > 0) {
    const assignedRows = await db
      .select({ workerId: siteAssignmentWorkers.workerId })
      .from(siteAssignmentWorkers)
      .where(inArray(siteAssignmentWorkers.assignmentId, assignmentIds));
    for (const r of assignedRows) {
      assignedWorkerIds.add(r.workerId);
    }
    assignedWorkerCount = assignedWorkerIds.size;
  }

  // 3. Attendance sessions for date
  const sessions = await db
    .select({
      id: attendanceSessions.id,
      workerId: attendanceSessions.workerId,
      status: attendanceSessions.status,
      clockInTime: attendanceSessions.clockInTime,
    })
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        sql`${attendanceSessions.workDate} = ${dateParam}::date`
      )
    );

  // Filter sessions in supervisor scope
  const scopedSessions = sessions.filter((s) => isSuperOrAdmin || assignedWorkerIds.has(s.workerId));

  const approved = scopedSessions.filter((s) => s.status === 'APPROVED').length;
  const rejected = scopedSessions.filter((s) => s.status === 'REJECTED').length;
  const pendingApprovals = scopedSessions.filter((s) => s.status === 'PENDING').length;

  // 4. Missing clock-ins: Assigned workers with no clock-in and not on approved leave
  const activeLeaves = await db
    .select({ userId: leaveRequests.userId })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.orgId, orgId),
        eq(leaveRequests.status, 'APPROVED'),
        sql`${leaveRequests.startDate} <= ${dateParam}::date AND ${leaveRequests.endDate} >= ${dateParam}::date`
      )
    );
  const leaveWorkerIds = new Set(activeLeaves.map((l) => l.userId));

  const clockedInWorkerIds = new Set(scopedSessions.filter((s) => s.clockInTime).map((s) => s.workerId));

  let missingClockIns = 0;
  for (const wId of assignedWorkerIds) {
    if (!clockedInWorkerIds.has(wId) && !leaveWorkerIds.has(wId)) {
      missingClockIns++;
    }
  }

  // 5. Pending worker regularization requests
  const pendingRegRequests = await db
    .select({ count: sql<number>`count(*)` })
    .from(attendanceAdjustmentRequests)
    .innerJoin(attendanceSessions, eq(attendanceAdjustmentRequests.sessionId, attendanceSessions.id))
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        eq(attendanceAdjustmentRequests.status, 'PENDING'),
        isSuperOrAdmin
          ? sql`true`
          : or(
              eq(attendanceAdjustmentRequests.currentApproverId, supervisor.id),
              eq(attendanceSessions.supervisorSnapshotId, supervisor.id)
            )!
      )
    );
  const pendingRegularization = Number(pendingRegRequests[0]?.count || 0);

  // 6. Flagged attendance cases for this date/month
  const flagsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(attendanceFlags)
    .where(
      and(
        eq(attendanceFlags.orgId, orgId),
        sql`${attendanceFlags.workDate} = ${dateParam}::date`,
        isSuperOrAdmin ? sql`true` : eq(attendanceFlags.supervisorId, supervisor.id)
      )
    );
  const flaggedDatesCount = Number(flagsCount[0]?.count || 0);

  return res.json({
    date: dateParam,
    totalWorkers: assignedWorkerCount || scopedSessions.length,
    approved,
    rejected,
    pendingApprovals,
    missingClockIns,
    pendingRegularization,
    flaggedDatesCount,
  });
}
