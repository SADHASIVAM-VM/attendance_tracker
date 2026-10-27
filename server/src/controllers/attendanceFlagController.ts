import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  attendanceFlags,
  siteAssignments,
  siteAssignmentWorkers,
  worksites,
  users,
  attendanceSessions,
  leaveRequests,
  leaveTypes,
  notifications,
  attendanceAdjustmentRequests,
  approvalActions,
} from '../database/schema.js';
import { eq, ne, and, or, sql, inArray, lte } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
import { getOrgCurrentMonth, isCurrentCalendarMonth, getOrgTimezone } from '../utils/dateUtils.js';

const flagDecisionSchema = z.object({
  flagStatus: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  status: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  reason: z.string().max(100).optional(),
  note: z.string().optional(),
}).refine((data) => data.flagStatus !== undefined || data.status !== undefined, {
  message: 'Must provide either flagStatus or status as PENDING_REVIEW, APPROVED, or REJECTED',
});

/**
 * Format minutes elapsed into human-readable duration (e.g. "45m elapsed", "2h 15m elapsed")
 */
function formatElapsed(elapsedMinutes: number): string {
  if (elapsedMinutes <= 0) return 'Just started';
  const hours = Math.floor(elapsedMinutes / 60);
  const mins = elapsedMinutes % 60;
  if (hours === 0) return `${mins}m elapsed`;
  if (mins === 0) return `${hours}h elapsed`;
  return `${hours}h ${mins}m elapsed`;
}

/**
 * GET /attendance/missing-clock-ins
 * Evaluates published shifts past scheduled start + grace period.
 * Identifies workers who have not clocked in and have no approved leave.
 */
export async function getMissingClockIns(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const todayStr = new Date().toISOString().split('T')[0];
  const dateParam = String(req.query.date || todayStr);
  const worksiteIdParam = req.query.worksiteId ? String(req.query.worksiteId) : undefined;
  const assignmentIdParam = req.query.assignmentId ? String(req.query.assignmentId) : undefined;
  const includeYesterday = req.query.includeYesterday === 'true' || req.query.unresolved === 'true';

  const d = new Date(dateParam);
  d.setDate(d.getDate() - 1);
  const yesterdayStr = d.toISOString().split('T')[0];

  const targetDates = includeYesterday ? [yesterdayStr, dateParam] : [dateParam];

  // 1. Fetch published assignments for target dates or carried forward
  const allAssignments = await db
    .select({
      id: siteAssignments.id,
      worksiteId: siteAssignments.worksiteId,
      supervisorId: siteAssignments.supervisorId,
      workDate: siteAssignments.workDate,
      shiftName: siteAssignments.shiftName,
      shiftStartTime: siteAssignments.shiftStartTime,
      shiftEndTime: siteAssignments.shiftEndTime,
      carryForward: siteAssignments.carryForward,
      status: siteAssignments.status,
      cancelledAt: siteAssignments.cancelledAt,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      worksiteAddress: worksites.address,
      supervisorName: users.fullName,
      supervisorEmail: users.email,
    })
    .from(siteAssignments)
    .innerJoin(worksites, eq(siteAssignments.worksiteId, worksites.id))
    .innerJoin(users, eq(siteAssignments.supervisorId, users.id))
    .where(
      and(
        eq(siteAssignments.orgId, orgId),
        eq(siteAssignments.status, 'PUBLISHED'),
        or(
          inArray(siteAssignments.workDate, targetDates),
          and(
            eq(siteAssignments.carryForward, true),
            lte(siteAssignments.workDate, dateParam)
          )
        )
      )
    );

  // Filter for supervisor assignments or specific worksite/assignment
  const targetAssignments = allAssignments.filter((a) => {
    const matchesSite = !worksiteIdParam || a.worksiteId === worksiteIdParam;
    const matchesAssignment = !assignmentIdParam || a.id === assignmentIdParam;
    const matchesSupervisor = isSuperOrAdmin || a.supervisorId === user.id || matchesSite;
    return matchesSite && matchesAssignment && matchesSupervisor;
  });

  const assignmentIds = targetAssignments.map((a) => a.id);

  // 2. Fetch assigned workers for these assignments
  const assignedWorkers = assignmentIds.length > 0
    ? await db
        .select({
          assignmentId: siteAssignmentWorkers.assignmentId,
          workerId: users.id,
          fullName: users.fullName,
          employeeCode: users.employeeCode,
          email: users.email,
          phone: users.phone,
          photoUrl: users.photoUrl,
          employmentType: users.employmentType,
        })
        .from(siteAssignmentWorkers)
        .innerJoin(users, eq(siteAssignmentWorkers.workerId, users.id))
        .where(inArray(siteAssignmentWorkers.assignmentId, assignmentIds))
    : [];

  // 3. Fetch existing attendance sessions for target dates
  const sessions = await db
    .select({
      id: attendanceSessions.id,
      assignmentId: attendanceSessions.assignmentId,
      workerId: attendanceSessions.workerId,
      workDate: attendanceSessions.workDate,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      status: attendanceSessions.status,
    })
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        sql`DATE(${attendanceSessions.workDate})::text IN (${sql.join(targetDates.map((dt) => sql`${dt}`), sql`, `)})`
      )
    );

  const sessionMap = new Map<string, any>(); // key: `${assignmentId}_${workerId}_${workDate}`
  for (const s of sessions) {
    const wDate = String(s.workDate).split('T')[0];
    sessionMap.set(`${s.assignmentId}_${s.workerId}_${wDate}`, s);
    sessionMap.set(`${s.assignmentId}_${s.workerId}`, s);
  }

  // 4. Fetch leave requests covering target dates
  const minDate = includeYesterday ? yesterdayStr : dateParam;
  const leaves = await db
    .select({
      id: leaveRequests.id,
      userId: leaveRequests.userId,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      status: leaveRequests.status,
      reason: leaveRequests.reason,
      leaveTypeName: leaveTypes.name,
    })
    .from(leaveRequests)
    .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .where(
      and(
        eq(leaveRequests.orgId, orgId),
        sql`${leaveRequests.status} IN ('PENDING', 'APPROVED')`,
        sql`${leaveRequests.startDate} <= ${dateParam} AND ${leaveRequests.endDate} >= ${minDate}`
      )
    );

  // 5. Fetch existing attendanceFlags for target dates and assignments
  const existingFlagsQuery = db
    .select({
      id: attendanceFlags.id,
      orgId: attendanceFlags.orgId,
      assignmentId: attendanceFlags.assignmentId,
      workerId: attendanceFlags.workerId,
      supervisorId: attendanceFlags.supervisorId,
      workDate: attendanceFlags.workDate,
      shiftName: attendanceFlags.shiftName,
      shiftStartTime: attendanceFlags.shiftStartTime,
      gracePeriodMinutes: attendanceFlags.gracePeriodMinutes,
      gracePeriodExpiresAt: attendanceFlags.gracePeriodExpiresAt,
      flagStatus: attendanceFlags.flagStatus,
      reason: attendanceFlags.reason,
      note: attendanceFlags.note,
      reviewedBy: attendanceFlags.reviewedBy,
      reviewedAt: attendanceFlags.reviewedAt,
      resolvedByClockIn: attendanceFlags.resolvedByClockIn,
      resolvedAt: attendanceFlags.resolvedAt,
      createdAt: attendanceFlags.createdAt,
      updatedAt: attendanceFlags.updatedAt,
      reviewerName: users.fullName,
      reviewerEmail: users.email,
    })
    .from(attendanceFlags)
    .leftJoin(users, eq(attendanceFlags.reviewedBy, users.id))
    .where(
      and(
        eq(attendanceFlags.orgId, orgId),
        sql`${attendanceFlags.workDate}::text IN (${sql.join(targetDates.map((dt) => sql`${dt}`), sql`, `)})`
      )
    );

  const existingFlags = await existingFlagsQuery;
  const flagMap = new Map<string, any>(); // key: `${assignmentId}_${workerId}_${workDate}`
  for (const f of existingFlags) {
    const fDate = String(f.workDate).split('T')[0];
    flagMap.set(`${f.assignmentId}_${f.workerId}_${fDate}`, f);
    if (fDate === dateParam) {
      flagMap.set(`${f.assignmentId}_${f.workerId}`, f);
    }
  }

  const now = new Date();
  const cases: any[] = [];
  const handledCaseIds = new Set<string>();
  const defaultGraceMinutes = 15;

  for (const targetDateStr of targetDates) {
    const isYesterday = targetDateStr === yesterdayStr;

    for (const aw of assignedWorkers) {
      const assignment = targetAssignments.find((a) => a.id === aw.assignmentId);
      if (!assignment) continue;

      // Assignment validity check for this date
      if (assignment.workDate !== targetDateStr && !assignment.carryForward) {
        continue;
      }

      const specificSessionKey = `${aw.assignmentId}_${aw.workerId}_${targetDateStr}`;
      const session = sessionMap.get(specificSessionKey) || sessionMap.get(`${aw.assignmentId}_${aw.workerId}`);
      const specificFlagKey = `${aw.assignmentId}_${aw.workerId}_${targetDateStr}`;
      const existingFlag = flagMap.get(specificFlagKey);

      // Check leave covering targetDateStr
      const leave = leaves.find(
        (l) => l.userId === aw.workerId && String(l.startDate) <= targetDateStr && String(l.endDate) >= targetDateStr
      );

      // Rule 1: If worker has approved leave, exclude from missing clock-in unless flag specifically exists
      if (leave && leave.status === 'APPROVED' && !existingFlag) {
        continue;
      }

      // Determine shift start timestamp
      const shiftParts = (assignment.shiftStartTime || '08:00').split(':');
      const shiftStartHour = parseInt(shiftParts[0] || '8', 10);
      const shiftStartMin = parseInt(shiftParts[1] || '0', 10);

      const shiftStartDate = new Date(`${targetDateStr}T00:00:00`);
      shiftStartDate.setHours(shiftStartHour, shiftStartMin, 0, 0);

      const gracePeriodMinutes = existingFlag?.gracePeriodMinutes || defaultGraceMinutes;
      const graceExpiresAt = new Date(shiftStartDate.getTime() + gracePeriodMinutes * 60 * 1000);

      const isPastGrace = now.getTime() >= graceExpiresAt.getTime() || targetDateStr < todayStr;
      const elapsedMinutes = Math.max(0, Math.round((now.getTime() - shiftStartDate.getTime()) / 60000));

      // If worker clocked in on that date before flag or without flag ever created, they are NOT missing
      if (session && !existingFlag) {
        continue;
      }

      // Only create/show missing clock-in if shift start + grace period has expired, or if case already exists
      if (!isPastGrace && !existingFlag) {
        continue;
      }

      // If yesterday's record and flag already resolved, keep if not strictly filtering unresolved
      if (isYesterday && existingFlag && existingFlag.flagStatus !== 'PENDING_REVIEW' && req.query.unresolvedOnly === 'true') {
        continue;
      }

      // If case does not exist in DB yet and worker has no session, persist it atomically
      let currentFlag = existingFlag;
      if (!currentFlag && !session) {
        try {
          const [inserted] = await db
            .insert(attendanceFlags)
            .values({
              orgId,
              assignmentId: assignment.id,
              workerId: aw.workerId,
              supervisorId: assignment.supervisorId,
              workDate: targetDateStr,
              shiftName: assignment.shiftName,
              shiftStartTime: assignment.shiftStartTime,
              gracePeriodMinutes,
              gracePeriodExpiresAt: graceExpiresAt,
              flagStatus: 'PENDING_REVIEW',
            })
            .onConflictDoNothing()
            .returning();

          currentFlag = inserted || (await db
            .select()
            .from(attendanceFlags)
            .where(
              and(
                eq(attendanceFlags.assignmentId, assignment.id),
                eq(attendanceFlags.workerId, aw.workerId),
                eq(attendanceFlags.workDate, targetDateStr)
              )
            )
            .limit(1)
            .then((rows) => rows[0]));
        } catch (insertErr) {
          console.warn('Flag auto-creation conflict:', insertErr);
        }
      }

      if (!currentFlag) continue;
      if (handledCaseIds.has(currentFlag.id)) continue;
      handledCaseIds.add(currentFlag.id);

      // Leave Status
      let leaveStatus: 'NONE' | 'PENDING_LEAVE' | 'APPROVED_LEAVE' = 'NONE';
      let leaveSummary = null;
      if (leave) {
        leaveStatus = leave.status === 'APPROVED' ? 'APPROVED_LEAVE' : 'PENDING_LEAVE';
        leaveSummary = {
          id: leave.id,
          leaveTypeName: leave.leaveTypeName || 'Leave Request',
          status: leave.status,
          reason: leave.reason,
        };
      }

      cases.push({
        id: currentFlag.id,
        assignmentId: assignment.id,
        workerId: aw.workerId,
        workerName: aw.fullName || 'Field Worker',
        employeeCode: aw.employeeCode || '',
        avatar: aw.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(aw.fullName || 'Worker')}&background=0D8ABC&color=fff`,
        employmentType: aw.employmentType || 'full-time',
        worksiteId: assignment.worksiteId,
        worksiteName: assignment.worksiteName,
        worksiteCode: assignment.worksiteCode,
        worksiteAddress: assignment.worksiteAddress,
        shiftName: assignment.shiftName,
        shiftStartTime: assignment.shiftStartTime,
        shiftEndTime: assignment.shiftEndTime,
        scheduledShiftStart: shiftStartDate.toISOString(),
        gracePeriodMinutes,
        gracePeriodExpiresAt: graceExpiresAt.toISOString(),
        timeElapsedMinutes: elapsedMinutes,
        timeElapsedFormatted: formatElapsed(elapsedMinutes),
        lastKnownStatus: session?.clockInTime ? 'CLOCKED_IN_LATER' : 'NOT_CLOCKED_IN',
        clockInTime: session?.clockInTime || null,
        leaveStatus,
        leaveSummary,
        flagStatus: currentFlag.flagStatus, // 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
        reason: currentFlag.reason,
        note: currentFlag.note,
        reviewedBy: currentFlag.reviewedBy,
        reviewerName: currentFlag.reviewerName || null,
        reviewedAt: currentFlag.reviewedAt || null,
        resolvedByClockIn: currentFlag.resolvedByClockIn || (session?.clockInTime ? true : false),
        resolvedAt: currentFlag.resolvedAt || session?.clockInTime || null,
        createdAt: currentFlag.createdAt,
        updatedAt: currentFlag.updatedAt,
        workDate: targetDateStr,
        isYesterday,
      });
    }
  }

  // Also include any standalone unresolved flags from yesterday that were not part of currently fetched assignments
  if (includeYesterday) {
    const unresolvedYesterdayFlags = existingFlags.filter(
      (f) => String(f.workDate).split('T')[0] === yesterdayStr && f.flagStatus === 'PENDING_REVIEW' && !handledCaseIds.has(f.id)
    );

    if (unresolvedYesterdayFlags.length > 0) {
      const workerIds = unresolvedYesterdayFlags.map((f) => f.workerId);
      const userRows = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          employeeCode: users.employeeCode,
          photoUrl: users.photoUrl,
          employmentType: users.employmentType,
        })
        .from(users)
        .where(inArray(users.id, workerIds));
      const userMap = new Map(userRows.map((u) => [u.id, u]));

      for (const uf of unresolvedYesterdayFlags) {
        const u = userMap.get(uf.workerId);
        cases.push({
          id: uf.id,
          assignmentId: uf.assignmentId,
          workerId: uf.workerId,
          workerName: u?.fullName || 'Field Worker',
          employeeCode: u?.employeeCode || '',
          avatar: u?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.fullName || 'Worker')}&background=0D8ABC&color=fff`,
          employmentType: u?.employmentType || 'full-time',
          worksiteId: worksiteIdParam || '',
          worksiteName: 'Assigned Worksite',
          worksiteCode: 'SITE',
          worksiteAddress: '',
          shiftName: uf.shiftName || 'Scheduled Shift',
          shiftStartTime: uf.shiftStartTime || '08:00',
          shiftEndTime: '17:00',
          scheduledShiftStart: `${yesterdayStr}T${uf.shiftStartTime || '08:00'}:00`,
          gracePeriodMinutes: uf.gracePeriodMinutes || 15,
          gracePeriodExpiresAt: uf.gracePeriodExpiresAt ? new Date(uf.gracePeriodExpiresAt).toISOString() : '',
          timeElapsedMinutes: 1440,
          timeElapsedFormatted: 'Over 24h elapsed',
          lastKnownStatus: 'NOT_CLOCKED_IN',
          clockInTime: null,
          leaveStatus: 'NONE',
          leaveSummary: null,
          flagStatus: uf.flagStatus,
          reason: uf.reason,
          note: uf.note,
          reviewedBy: uf.reviewedBy,
          reviewerName: uf.reviewerName || null,
          reviewedAt: uf.reviewedAt || null,
          resolvedByClockIn: uf.resolvedByClockIn,
          resolvedAt: uf.resolvedAt || null,
          createdAt: uf.createdAt,
          updatedAt: uf.updatedAt,
          workDate: yesterdayStr,
          isYesterday: true,
        });
      }
    }
  }

  // Sort: Pending review first, then yesterday first, then by elapsed time descending
  cases.sort((a, b) => {
    if (a.flagStatus === 'PENDING_REVIEW' && b.flagStatus !== 'PENDING_REVIEW') return -1;
    if (a.flagStatus !== 'PENDING_REVIEW' && b.flagStatus === 'PENDING_REVIEW') return 1;
    if (a.isYesterday && !b.isYesterday) return -1;
    if (!a.isYesterday && b.isYesterday) return 1;
    return b.timeElapsedMinutes - a.timeElapsedMinutes;
  });

  return res.json({
    date: dateParam,
    yesterdayDate: yesterdayStr,
    includesYesterday: includeYesterday,
    gracePeriodMinutes: defaultGraceMinutes,
    totalCases: cases.length,
    pendingCasesCount: cases.filter((c) => c.flagStatus === 'PENDING_REVIEW').length,
    yesterdayPendingCount: cases.filter((c) => c.isYesterday && c.flagStatus === 'PENDING_REVIEW').length,
    cases,
  });
}

/**
 * POST /attendance/missing-clock-ins/:id/flag
 * POST /attendance/missing-clock-ins/:id/resolve
 *
 * Supervisor Attendance Exception Management:
 * Handles resolving missing attendance exceptions:
 * - Mark Present: Verifies attendance was genuine, records/updates attendance session
 *   on original work date with status APPROVED and supervisor input/shift hours.
 * - Mark Absent: Confirms worker did not report to work, records absence with mandatory reason.
 * - Keep Pending: Keeps unverified case in pending exception list so yesterday's records carry over.
 *
 * Enforces:
 * - Rule 1: Missing attendance is an unresolved exception until handled.
 * - Rule 2: Resulting record belongs to original work date (e.g. yesterday).
 * - Rule 3: Present and Absent require a mandatory reason.
 * - Rule 4: Keep unverified cases pending.
 * - Rule 5: Preserves existing workflows.
 * - Supervisor restricted to current calendar month only.
 */
export async function applyAttendanceFlag(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const {
    flagStatus,
    status,
    action,
    decision,
    reason,
    note,
    clockInTime,
    clockOutTime,
  } = req.body || {};

  // Normalize decision / action
  let normalizedDecision: 'PRESENT' | 'ABSENT' | 'PENDING' = 'PENDING';
  if (
    decision === 'PRESENT' ||
    action === 'MARK_PRESENT' ||
    flagStatus === 'PRESENT' ||
    flagStatus === 'APPROVED' ||
    status === 'PRESENT' ||
    status === 'APPROVED' ||
    (flagStatus === 'APPROVED' && (!action || action === 'MARK_PRESENT'))
  ) {
    normalizedDecision = 'PRESENT';
  } else if (
    decision === 'ABSENT' ||
    action === 'MARK_ABSENT' ||
    flagStatus === 'ABSENT' ||
    flagStatus === 'REJECTED' ||
    status === 'ABSENT' ||
    status === 'REJECTED' ||
    (flagStatus === 'REJECTED' && (!action || action === 'MARK_ABSENT'))
  ) {
    normalizedDecision = 'ABSENT';
  } else if (
    decision === 'PENDING' ||
    action === 'KEEP_PENDING' ||
    flagStatus === 'PENDING_REVIEW' ||
    status === 'PENDING' ||
    status === 'PENDING_REVIEW'
  ) {
    normalizedDecision = 'PENDING';
  }

  // Validate mandatory reason for PRESENT and ABSENT
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (normalizedDecision !== 'PENDING' && trimmedReason.length < 3) {
    return res.status(400).json({
      error: 'REASON_REQUIRED',
      message: `A mandatory, meaningful reason (minimum 3 characters) is required when marking a worker as ${normalizedDecision === 'PRESENT' ? 'Present' : 'Absent'}.`,
    });
  }

  const db = await getDb();

  // 1. Fetch flag record and related assignment details
  const [flagRecord] = await db
    .select({
      id: attendanceFlags.id,
      orgId: attendanceFlags.orgId,
      assignmentId: attendanceFlags.assignmentId,
      workerId: attendanceFlags.workerId,
      supervisorId: attendanceFlags.supervisorId,
      workDate: attendanceFlags.workDate,
      shiftName: attendanceFlags.shiftName,
      shiftStartTime: attendanceFlags.shiftStartTime,
      flagStatus: attendanceFlags.flagStatus,
      reason: attendanceFlags.reason,
      note: attendanceFlags.note,
      resolvedByClockIn: attendanceFlags.resolvedByClockIn,
      worksiteId: siteAssignments.worksiteId,
      shiftEndTime: siteAssignments.shiftEndTime,
    })
    .from(attendanceFlags)
    .leftJoin(siteAssignments, eq(attendanceFlags.assignmentId, siteAssignments.id))
    .where(and(eq(attendanceFlags.id as any, id as any), eq(attendanceFlags.orgId as any, orgId as any)))
    .limit(1);

  if (!flagRecord) {
    return res.status(404).json({ error: 'FLAG_NOT_FOUND', message: 'Missing clock-in flag record not found' });
  }

  // Resolve valid worksiteId and assignmentId fallback if needed
  let effectiveWorksiteId = flagRecord.worksiteId;
  if (!effectiveWorksiteId) {
    const [firstWs] = await db.select({ id: worksites.id }).from(worksites).where(eq(worksites.orgId, orgId)).limit(1);
    effectiveWorksiteId = firstWs?.id;
  }
  let effectiveAssignmentId = flagRecord.assignmentId;
  if (!effectiveAssignmentId || effectiveAssignmentId === '00000000-0000-0000-0000-000000000000') {
    const [firstAsg] = await db.select({ id: siteAssignments.id }).from(siteAssignments).where(eq(siteAssignments.orgId, orgId)).limit(1);
    if (firstAsg) effectiveAssignmentId = firstAsg.id;
  }

  // 2. Permission check: Must be assigned supervisor, or supervisor for this worksite, or ADMIN
  const isAssignedSupervisor = flagRecord.supervisorId === user.id;
  if (!isSuperOrAdmin && !isAssignedSupervisor) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You are not authorized to handle missing clock-in flags for this assignment',
    });
  }

  // Requirement: Supervisors are allowed to edit only the current month's records
  const flagWorkDate = String(flagRecord.workDate).split('T')[0];
  if (!isSuperOrAdmin) {
    const orgTz = await getOrgTimezone(db, orgId);
    const { monthStr } = getOrgCurrentMonth(orgTz);
    if (!isCurrentCalendarMonth(flagWorkDate, orgTz)) {
      return res.status(403).json({
        error: 'CURRENT_MONTH_ONLY',
        message: `Supervisors are allowed to edit only the current month's records (${monthStr}). Flag date (${flagWorkDate}) falls outside the current calendar month; please use the Worker Regularisation or Admin Attendance Correction workflow.`,
      });
    }
  }

  const beforeValues = {
    flagStatus: flagRecord.flagStatus,
    reason: flagRecord.reason,
    note: flagRecord.note,
  };

  const now = new Date();
  const finalReason = trimmedReason || flagRecord.reason || 'Missing attendance reviewed by supervisor';
  const finalNote = typeof note === 'string' && note.trim() ? note.trim() : null;

  let sessionResult: any = null;

  // ── SCENARIO A: MARK PRESENT ────────────────────────────────────────────────
  if (normalizedDecision === 'PRESENT') {
    // Determine start and end timestamps on the original work date
    const startParts = (flagRecord.shiftStartTime || '08:00').split(':');
    const endParts = (flagRecord.shiftEndTime || '17:00').split(':');

    let inDate: Date;
    if (clockInTime) {
      if (clockInTime.includes('T')) {
        inDate = new Date(clockInTime);
      } else {
        const [h, m] = clockInTime.split(':');
        inDate = new Date(`${flagWorkDate}T00:00:00`);
        inDate.setHours(parseInt(h || '8', 10), parseInt(m || '0', 10), 0, 0);
      }
    } else {
      inDate = new Date(`${flagWorkDate}T00:00:00`);
      inDate.setHours(parseInt(startParts[0] || '8', 10), parseInt(startParts[1] || '0', 10), 0, 0);
    }

    let outDate: Date;
    if (clockOutTime) {
      if (clockOutTime.includes('T')) {
        outDate = new Date(clockOutTime);
      } else {
        const [h, m] = clockOutTime.split(':');
        outDate = new Date(`${flagWorkDate}T00:00:00`);
        outDate.setHours(parseInt(h || '17', 10), parseInt(m || '0', 10), 0, 0);
      }
    } else {
      outDate = new Date(`${flagWorkDate}T00:00:00`);
      outDate.setHours(parseInt(endParts[0] || '17', 10), parseInt(endParts[1] || '0', 10), 0, 0);
    }

    // Ensure valid duration
    const durSec = Math.max(3600, Math.round((outDate.getTime() - inDate.getTime()) / 1000));

    // Check if session exists on this work date
    const [existingSession] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.orgId, orgId),
          eq(attendanceSessions.workerId, flagRecord.workerId),
          sql`${attendanceSessions.workDate} = ${flagWorkDate}::date`
        )
      )
      .limit(1);

    if (existingSession) {
      const [updatedSession] = await db
        .update(attendanceSessions)
        .set({
          status: 'APPROVED',
          notes: finalReason,
          actionBy: user.id,
          clockInTime: inDate,
          clockOutTime: outDate,
          totalDurationSeconds: durSec,
          netWorkingSeconds: durSec,
          approvalSource: 'SUPERVISOR_ASSISTED',
          clockOutSource: 'SUPERVISOR_ASSISTED',
          approvedAt: now,
          rejectionReason: null,
          currentApproverId: user.id,
          supervisorSnapshotId: user.id,
          updatedAt: now,
        })
        .where(eq(attendanceSessions.id, existingSession.id))
        .returning();
      sessionResult = updatedSession;
    } else {
      const [createdSession] = await db
        .insert(attendanceSessions)
        .values({
          orgId,
          assignmentId: effectiveAssignmentId,
          workerId: flagRecord.workerId,
          supervisorSnapshotId: user.id,
          currentApproverId: user.id,
          actionBy: user.id,
          notes: finalReason,
          worksiteSnapshotId: effectiveWorksiteId,
          workDate: flagWorkDate as any,
          status: 'APPROVED',
          idempotencyKey: `EXCEPTION_RESOLVE_${flagRecord.id}_${Date.now()}`,
          clockInTime: inDate,
          clockOutTime: outDate,
          totalDurationSeconds: durSec,
          netWorkingSeconds: durSec,
          approvalSource: 'SUPERVISOR_ASSISTED',
          clockOutSource: 'SUPERVISOR_ASSISTED',
          approvedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      sessionResult = createdSession;
    }

    // Record immutable audit history
    if (sessionResult) {
      await db.insert(approvalActions).values({
        sessionId: sessionResult.id,
        workerId: flagRecord.workerId,
        workDate: flagRecord.workDate,
        previousStatus: existingSession?.status || 'MISSING',
        newStatus: 'APPROVED',
        action: 'EXCEPTION_RESOLVED_PRESENT',
        actionType: 'EXCEPTION_RESOLVED_PRESENT',
        reviewerId: user.id,
        actorRole: user.roles[0] || 'SUPERVISOR',
        note: finalReason,
        reason: finalReason,
        performedAt: now,
      });
    }

    // Update flag to APPROVED / Resolved
    const [updatedFlag] = await db
      .update(attendanceFlags)
      .set({
        flagStatus: 'APPROVED',
        reason: finalReason,
        note: finalNote,
        reviewedBy: user.id,
        reviewedAt: now,
        resolvedByClockIn: true,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(attendanceFlags.id as any, id as any))
      .returning();

    // Log audit event
    await logAuditEvent({
      orgId,
      actorId: user.id,
      actorNameSnapshot: user.fullName,
      actorRole: user.roles[0],
      action: 'ATTENDANCE_EXCEPTION_RESOLVED_PRESENT',
      entityType: 'ATTENDANCE_FLAG',
      entityId: id,
      reason: finalReason,
      beforeValues,
      afterValues: {
        decision: 'PRESENT',
        flagStatus: 'APPROVED',
        workDate: flagWorkDate,
        clockInTime: inDate.toISOString(),
        clockOutTime: outDate.toISOString(),
        sessionId: sessionResult?.id,
        reason: finalReason,
        note: finalNote,
      },
      ipAddress: req.ip as any,
      userAgent: req.headers['user-agent'] as any,
      req,
    });

    // Notify worker
    await db.insert(notifications).values({
      userId: flagRecord.workerId,
      title: 'Attendance Exception Resolved: Present',
      message: `Supervisor ${user.fullName} confirmed your attendance as Present for ${flagWorkDate}. Reason: ${finalReason}`,
      type: 'ATTENDANCE_FLAG',
      entityType: 'ATTENDANCE_FLAG',
      entityId: id as any,
    });

    return res.json({
      success: true,
      message: `Missing attendance on ${flagWorkDate} resolved: Marked Present.`,
      flag: updatedFlag,
      session: sessionResult,
    });
  }

  // ── SCENARIO B: MARK ABSENT ─────────────────────────────────────────────────
  if (normalizedDecision === 'ABSENT') {
    // Check if session exists on this work date, and mark REJECTED
    const [existingSession] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.orgId, orgId),
          eq(attendanceSessions.workerId, flagRecord.workerId),
          sql`${attendanceSessions.workDate} = ${flagWorkDate}::date`
        )
      )
      .limit(1);

    let sessionResult: any = null;
    if (existingSession) {
      const [updatedSession] = await db
        .update(attendanceSessions)
        .set({
          status: 'ABSENT',
          notes: finalReason,
          actionBy: user.id,
          currentApproverId: user.id,
          rejectionReason: finalReason,
          updatedAt: now,
        })
        .where(eq(attendanceSessions.id, existingSession.id))
        .returning();
      sessionResult = updatedSession;
    } else {
      const [createdSession] = await db
        .insert(attendanceSessions)
        .values({
          orgId,
          assignmentId: effectiveAssignmentId,
          workerId: flagRecord.workerId,
          supervisorSnapshotId: user.id,
          currentApproverId: user.id,
          actionBy: user.id,
          notes: finalReason,
          worksiteSnapshotId: effectiveWorksiteId,
          workDate: flagWorkDate as any,
          status: 'ABSENT',
          idempotencyKey: `EXCEPTION_RESOLVE_ABSENT_${flagRecord.id}_${Date.now()}`,
          clockInTime: null,
          clockOutTime: null,
          totalDurationSeconds: 0,
          netWorkingSeconds: 0,
          approvalSource: 'SUPERVISOR_ASSISTED',
          clockOutSource: 'SUPERVISOR_ASSISTED',
          rejectionReason: finalReason,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      sessionResult = createdSession;
    }

    if (sessionResult) {
      await db.insert(approvalActions).values({
        sessionId: sessionResult.id,
        workerId: flagRecord.workerId,
        workDate: flagRecord.workDate,
        previousStatus: existingSession?.status || 'MISSING',
        newStatus: 'ABSENT',
        action: 'CONFIRM_ABSENT',
        actionType: 'CONFIRM_ABSENT',
        reviewerId: user.id,
        actorRole: user.roles[0] || 'SUPERVISOR',
        note: finalReason,
        reason: finalReason,
        performedAt: now,
      });
    }

    // Update flag to REJECTED / Absent
    const [updatedFlag] = await db
      .update(attendanceFlags)
      .set({
        flagStatus: 'REJECTED',
        reason: finalReason,
        note: finalNote,
        reviewedBy: user.id,
        reviewedAt: now,
        resolvedByClockIn: false,
        resolvedAt: null,
        updatedAt: now,
      })
      .where(eq(attendanceFlags.id as any, id as any))
      .returning();

    // Log audit event
    await logAuditEvent({
      orgId,
      actorId: user.id,
      actorNameSnapshot: user.fullName,
      actorRole: user.roles[0],
      action: 'ATTENDANCE_EXCEPTION_RESOLVED_ABSENT',
      entityType: 'ATTENDANCE_FLAG',
      entityId: id,
      reason: finalReason,
      beforeValues,
      afterValues: {
        decision: 'ABSENT',
        flagStatus: 'REJECTED',
        workDate: flagWorkDate,
        sessionId: sessionResult?.id,
        reason: finalReason,
        note: finalNote,
      },
      ipAddress: req.ip as any,
      userAgent: req.headers['user-agent'] as any,
      req,
    });

    // Notify worker
    await db.insert(notifications).values({
      userId: flagRecord.workerId,
      title: 'Attendance Exception Resolved: Absent',
      message: `Supervisor ${user.fullName} confirmed your absence for ${flagWorkDate}. Reason: ${finalReason}`,
      type: 'ATTENDANCE_FLAG',
      entityType: 'ATTENDANCE_FLAG',
      entityId: id as any,
    });

    return res.json({
      success: true,
      message: `Missing attendance on ${flagWorkDate} resolved: Marked Absent.`,
      flag: updatedFlag,
      session: sessionResult,
    });
  }

  // ── SCENARIO C: KEEP PENDING ────────────────────────────────────────────────
  const [updatedFlag] = await db
    .update(attendanceFlags)
    .set({
      flagStatus: 'PENDING_REVIEW',
      reason: finalReason,
      note: finalNote,
      reviewedBy: user.id,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceFlags.id as any, id as any))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: user.id,
    actorNameSnapshot: user.fullName,
    actorRole: user.roles[0],
    action: 'ATTENDANCE_EXCEPTION_KEPT_PENDING',
    entityType: 'ATTENDANCE_FLAG',
    entityId: id,
    reason: finalReason,
    beforeValues,
    afterValues: {
      decision: 'PENDING',
      flagStatus: 'PENDING_REVIEW',
      workDate: flagWorkDate,
      reason: finalReason,
      note: finalNote,
    },
    ipAddress: req.ip as any,
    userAgent: req.headers['user-agent'] as any,
    req,
  });

  return res.json({
    success: true,
    message: `Attendance exception on ${flagWorkDate} remains Pending Review.`,
    flag: updatedFlag,
  });
}

/**
 * POST /attendance/missing-clock-ins/flag-worker
 * Section 3: Supervisor submits missing-attendance flag for an assigned worker/date
 * Requires mandatory, meaningful reason; prevents duplicate active flags.
 */
const createFlagSchema = z.object({
  workerId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  reason: z
    .string()
    .trim()
    .min(5, 'A meaningful, mandatory reason of at least 5 characters is required'),
  note: z.string().trim().optional(),
  flagStatus: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']).default('PENDING_REVIEW'),
});

export async function createMissingAttendanceFlag(req: Request, res: Response): Promise<any> {
  const parseResult = createFlagSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid flag data',
      details: parseResult.error.issues,
    });
  }

  const { workerId, workDate, reason, note, flagStatus } = parseResult.data;
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  // 1. Check if worker has approved leave on this date
  const [approvedLeave] = await db
    .select({ id: leaveRequests.id, leaveTypeName: leaveTypes.name })
    .from(leaveRequests)
    .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .where(
      and(
        eq(leaveRequests.orgId, orgId),
        eq(leaveRequests.userId, workerId),
        eq(leaveRequests.status, 'APPROVED'),
        sql`${leaveRequests.startDate} <= ${workDate}::date AND ${leaveRequests.endDate} >= ${workDate}::date`
      )
    )
    .limit(1);

  if (approvedLeave) {
    return res.status(400).json({
      error: 'APPROVED_LEAVE_EXISTS',
      message: `Worker is on approved leave (${approvedLeave.leaveTypeName || 'Approved Leave'}) for ${workDate} and cannot be flagged as missing.`,
    });
  }

  // 2. Check if worker already clocked in
  const [existingSession] = await db
    .select({ id: attendanceSessions.id, clockInTime: attendanceSessions.clockInTime })
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        eq(attendanceSessions.workerId, workerId),
        sql`${attendanceSessions.workDate} = ${workDate}::date`
      )
    )
    .limit(1);

  if (existingSession?.clockInTime) {
    return res.status(400).json({
      error: 'WORKER_ALREADY_CLOCKED_IN',
      message: `Worker has an existing clock-in record on ${workDate}.`,
    });
  }

  // 3. Check for existing active flag for this worker and date (prevent duplicates)
  const [existingFlag] = await db
    .select({ id: attendanceFlags.id, flagStatus: attendanceFlags.flagStatus })
    .from(attendanceFlags)
    .where(
      and(
        eq(attendanceFlags.orgId, orgId),
        eq(attendanceFlags.workerId, workerId),
        eq(attendanceFlags.workDate, workDate)
      )
    )
    .limit(1);

  if (existingFlag) {
    return res.status(409).json({
      error: 'DUPLICATE_FLAG_NOT_ALLOWED',
      message: `An active missing-attendance flag already exists for this worker on ${workDate}. You can update the existing flag instead.`,
      flagId: existingFlag.id,
    });
  }

  // 4. Resolve assignment for this worker and date
  let [assignment] = await db
    .select({
      id: siteAssignments.id,
      shiftName: siteAssignments.shiftName,
      shiftStartTime: siteAssignments.shiftStartTime,
      supervisorId: siteAssignments.supervisorId,
    })
    .from(siteAssignmentWorkers)
    .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
    .where(
      and(
        eq(siteAssignmentWorkers.workerId, workerId),
        sql`${siteAssignments.workDate} = ${workDate}::date`,
        ne(siteAssignments.status, 'CANCELLED')
      )
    )
    .limit(1);

  if (!assignment) {
    const [fallbackAssignment] = await db
      .select({
        id: siteAssignments.id,
        shiftName: siteAssignments.shiftName,
        shiftStartTime: siteAssignments.shiftStartTime,
        supervisorId: siteAssignments.supervisorId,
      })
      .from(siteAssignments)
      .where(and(eq(siteAssignments.orgId, orgId), ne(siteAssignments.status, 'CANCELLED')))
      .limit(1);
    assignment = fallbackAssignment;
  }

  // If supervisor is not admin, ensure supervisor scope
  if (!isSuperOrAdmin && assignment && assignment.supervisorId !== user.id) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_SCOPE',
      message: 'You are not authorized to flag missing attendance for workers outside your assigned sites.',
    });
  }

  const now = new Date();
  const shiftStartTime = assignment?.shiftStartTime || '08:00';
  const shiftParts = shiftStartTime.split(':');
  const shiftStartDate = new Date(`${workDate}T00:00:00`);
  shiftStartDate.setHours(parseInt(shiftParts[0] || '8', 10), parseInt(shiftParts[1] || '0', 10), 0, 0);

  const [createdFlag] = await db
    .insert(attendanceFlags)
    .values({
      orgId,
      assignmentId: assignment?.id || '00000000-0000-0000-0000-000000000000',
      workerId,
      supervisorId: assignment?.supervisorId || user.id,
      workDate,
      shiftName: assignment?.shiftName || 'Scheduled Shift',
      shiftStartTime,
      gracePeriodMinutes: 15,
      gracePeriodExpiresAt: new Date(shiftStartDate.getTime() + 15 * 60 * 1000),
      flagStatus,
      reason,
      note: note || undefined,
      reviewedBy: user.id,
      reviewedAt: now,
    })
    .returning();

  await logAuditEvent({
    orgId,
    actorId: user.id,
    actorNameSnapshot: user.fullName,
    actorRole: user.roles[0],
    action: 'CREATE_MISSING_ATTENDANCE_FLAG',
    entityType: 'ATTENDANCE_FLAG',
    entityId: createdFlag.id,
    reason,
    afterValues: { workerId, workDate, flagStatus, reason, note },
    req,
  });

  if (flagStatus === 'REJECTED') {
    const [existingSession] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.orgId, orgId),
          eq(attendanceSessions.workerId, workerId),
          sql`${attendanceSessions.workDate} = ${workDate}::date`
        )
      )
      .limit(1);

    let sessionResult: any = null;
    if (existingSession) {
      const [updated] = await db
        .update(attendanceSessions)
        .set({
          status: 'ABSENT',
          notes: reason,
          actionBy: user.id,
          currentApproverId: user.id,
          rejectionReason: reason,
          updatedAt: now,
        })
        .where(eq(attendanceSessions.id, existingSession.id))
        .returning();
      sessionResult = updated;
    } else {
      let resolvedWorksiteId = assignment?.worksiteId;
      if (!resolvedWorksiteId) {
        const [ws] = await db.select({ id: worksites.id }).from(worksites).where(eq(worksites.orgId, orgId)).limit(1);
        resolvedWorksiteId = ws?.id;
      }
      let resolvedAssignmentId = assignment?.id;
      if (!resolvedAssignmentId) {
        const [asg] = await db.select({ id: siteAssignments.id }).from(siteAssignments).where(eq(siteAssignments.orgId, orgId)).limit(1);
        resolvedAssignmentId = asg?.id;
      }

      if (resolvedAssignmentId && resolvedWorksiteId) {
        const [created] = await db
          .insert(attendanceSessions)
          .values({
            orgId,
            assignmentId: resolvedAssignmentId,
            workerId,
            supervisorSnapshotId: assignment?.supervisorId || user.id,
            currentApproverId: user.id,
            actionBy: user.id,
            notes: reason,
            worksiteSnapshotId: resolvedWorksiteId,
            workDate: workDate as any,
            status: 'ABSENT',
            idempotencyKey: `FLAG_WORKER_ABSENT_${createdFlag.id}_${Date.now()}`,
            clockInTime: null,
            clockOutTime: null,
            totalDurationSeconds: 0,
            netWorkingSeconds: 0,
            approvalSource: 'SUPERVISOR_ASSISTED',
            clockOutSource: 'SUPERVISOR_ASSISTED',
            rejectionReason: reason,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        sessionResult = created;
      }
    }

    if (sessionResult) {
      await db.insert(approvalActions).values({
        sessionId: sessionResult.id,
        workerId,
        workDate: workDate as any,
        previousStatus: existingSession?.status || 'MISSING',
        newStatus: 'ABSENT',
        action: 'CONFIRM_ABSENT',
        actionType: 'CONFIRM_ABSENT',
        reviewerId: user.id,
        actorRole: user.roles[0] || 'SUPERVISOR',
        note: reason,
        reason,
        performedAt: now,
      });
    }
  }

  await db.insert(notifications).values({
    userId: workerId,
    title: 'Missing Attendance Flagged',
    message: `Supervisor ${user.fullName} logged a missing-attendance follow-up for ${workDate}. Reason: ${reason}. Awaiting regularization or review.`,
    type: 'ATTENDANCE_FLAG',
    entityType: 'ATTENDANCE_FLAG',
    entityId: createdFlag.id as any,
  });

  return res.status(201).json({
    success: true,
    message: 'Missing attendance flag recorded successfully',
    flag: createdFlag,
  });
}

/**
 * GET /attendance/exceptions/summary
 * Provides total and category exception counts for Attendance Exceptions section:
 * - Missing Attendance (yesterday unresolved + today)
 * - Pending Regularisation
 * - Rejected Regularisation
 */
export async function getAttendanceExceptionsSummary(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // 1. Missing Attendance count (unresolved PENDING_REVIEW flags for yesterday and today)
  const missingConditions = [
    eq(attendanceFlags.orgId, orgId),
    eq(attendanceFlags.flagStatus, 'PENDING_REVIEW'),
    sql`${attendanceFlags.workDate}::text IN (${yesterdayStr}, ${todayStr})`,
  ];
  if (!isSuperOrAdmin) {
    missingConditions.push(eq(attendanceFlags.supervisorId, user.id));
  }

  const [missingRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attendanceFlags)
    .where(and(...missingConditions));

  const missingAttendanceCount = Number(missingRes?.count || 0);

  // 2. Pending Regularisation count
  const pendingRegConditions = [
    eq(attendanceSessions.orgId, orgId),
    eq(attendanceAdjustmentRequests.status, 'PENDING'),
  ];
  if (!isSuperOrAdmin) {
    pendingRegConditions.push(
      or(
        eq(attendanceSessions.supervisorSnapshotId, user.id),
        eq(attendanceAdjustmentRequests.currentApproverId, user.id)
      )!
    );
  }

  const [pendingRegRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attendanceAdjustmentRequests)
    .innerJoin(attendanceSessions, eq(attendanceAdjustmentRequests.sessionId, attendanceSessions.id))
    .where(and(...pendingRegConditions));

  const pendingRegularisationCount = Number(pendingRegRes?.count || 0);

  // 3. Rejected Regularisation count (yesterday & today / recent unresolved)
  const rejectedRegConditions = [
    eq(attendanceSessions.orgId, orgId),
    eq(attendanceAdjustmentRequests.status, 'REJECTED'),
    sql`${attendanceAdjustmentRequests.workDate} >= ${yesterdayStr}::date`,
  ];
  if (!isSuperOrAdmin) {
    rejectedRegConditions.push(
      or(
        eq(attendanceSessions.supervisorSnapshotId, user.id),
        eq(attendanceAdjustmentRequests.currentApproverId, user.id)
      )!
    );
  }

  const [rejectedRegRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attendanceAdjustmentRequests)
    .innerJoin(attendanceSessions, eq(attendanceAdjustmentRequests.sessionId, attendanceSessions.id))
    .where(and(...rejectedRegConditions));

  const rejectedRegularisationCount = Number(rejectedRegRes?.count || 0);
  const totalExceptionsCount = missingAttendanceCount + pendingRegularisationCount + rejectedRegularisationCount;

  return res.json({
    missingAttendanceCount,
    pendingRegularisationCount,
    rejectedRegularisationCount,
    totalExceptionsCount,
    yesterdayDate: yesterdayStr,
    todayDate: todayStr,
  });
}

