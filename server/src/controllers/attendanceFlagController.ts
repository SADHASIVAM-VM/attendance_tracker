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
} from '../database/schema.js';
import { eq, and, or, sql, inArray, lte } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';

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

  // 1. Fetch published assignments for this date or carried forward
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
          eq(siteAssignments.workDate, dateParam),
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

  if (targetAssignments.length === 0) {
    return res.json({
      date: dateParam,
      gracePeriodMinutes: 15,
      cases: [],
    });
  }

  const assignmentIds = targetAssignments.map((a) => a.id);

  // 2. Fetch assigned workers for these assignments
  const assignedWorkers = await db
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
    .where(inArray(siteAssignmentWorkers.assignmentId, assignmentIds));

  // 3. Fetch existing attendance sessions for this date
  const sessions = await db
    .select({
      id: attendanceSessions.id,
      assignmentId: attendanceSessions.assignmentId,
      workerId: attendanceSessions.workerId,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      status: attendanceSessions.status,
    })
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        sql`DATE(${attendanceSessions.workDate}) = ${dateParam}`
      )
    );

  const sessionMap = new Map<string, any>(); // key: `${assignmentId}_${workerId}`
  for (const s of sessions) {
    sessionMap.set(`${s.assignmentId}_${s.workerId}`, s);
  }

  // 4. Fetch leave requests covering this date
  const leaves = await db
    .select({
      id: leaveRequests.id,
      userId: leaveRequests.userId,
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
        sql`${leaveRequests.startDate} <= ${dateParam} AND ${leaveRequests.endDate} >= ${dateParam}`
      )
    );

  const leaveByUserId = new Map<string, any>();
  for (const l of leaves) {
    leaveByUserId.set(l.userId, l);
  }

  // 5. Fetch existing attendanceFlags for this date and assignments
  const existingFlags = await db
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
        eq(attendanceFlags.workDate, dateParam),
        inArray(attendanceFlags.assignmentId, assignmentIds)
      )
    );

  const flagMap = new Map<string, any>(); // key: `${assignmentId}_${workerId}`
  for (const f of existingFlags) {
    flagMap.set(`${f.assignmentId}_${f.workerId}`, f);
  }

  const now = new Date();
  const cases: any[] = [];
  const defaultGraceMinutes = 15;

  for (const aw of assignedWorkers) {
    const assignment = targetAssignments.find((a) => a.id === aw.assignmentId);
    if (!assignment) continue;

    const sessionKey = `${aw.assignmentId}_${aw.workerId}`;
    const session = sessionMap.get(sessionKey);
    const existingFlag = flagMap.get(sessionKey);
    const leave = leaveByUserId.get(aw.workerId);

    // Rule 1: If worker has approved leave, exclude from missing clock-in
    if (leave && leave.status === 'APPROVED' && !existingFlag) {
      continue;
    }

    // Determine shift start timestamp
    // assignment.shiftStartTime is "HH:mm", e.g. "08:00"
    const shiftParts = (assignment.shiftStartTime || '08:00').split(':');
    const shiftStartHour = parseInt(shiftParts[0] || '8', 10);
    const shiftStartMin = parseInt(shiftParts[1] || '0', 10);

    const shiftStartDate = new Date(`${dateParam}T00:00:00`);
    shiftStartDate.setHours(shiftStartHour, shiftStartMin, 0, 0);

    const gracePeriodMinutes = existingFlag?.gracePeriodMinutes || defaultGraceMinutes;
    const graceExpiresAt = new Date(shiftStartDate.getTime() + gracePeriodMinutes * 60 * 1000);

    const isPastGrace = now.getTime() >= graceExpiresAt.getTime() || dateParam < todayStr;
    const elapsedMinutes = Math.max(0, Math.round((now.getTime() - shiftStartDate.getTime()) / 60000));

    // If worker clocked in before flag or without flag ever created, they are NOT missing clock-in
    if (session && !existingFlag) {
      continue;
    }

    // Only create/show missing clock-in if shift start + grace period has expired, or if case already exists
    if (!isPastGrace && !existingFlag) {
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
            workDate: dateParam,
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
              eq(attendanceFlags.workDate, dateParam)
            )
          )
          .limit(1)
          .then((rows) => rows[0]));
      } catch (insertErr) {
        console.warn('Flag auto-creation conflict:', insertErr);
      }
    }

    if (!currentFlag) continue;

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
    });
  }

  // Sort: Pending review first, then by elapsed time descending
  cases.sort((a, b) => {
    if (a.flagStatus === 'PENDING_REVIEW' && b.flagStatus !== 'PENDING_REVIEW') return -1;
    if (a.flagStatus !== 'PENDING_REVIEW' && b.flagStatus === 'PENDING_REVIEW') return 1;
    return b.timeElapsedMinutes - a.timeElapsedMinutes;
  });

  return res.json({
    date: dateParam,
    gracePeriodMinutes: defaultGraceMinutes,
    totalCases: cases.length,
    pendingCasesCount: cases.filter((c) => c.flagStatus === 'PENDING_REVIEW').length,
    cases,
  });
}

/**
 * POST /attendance/missing-clock-ins/:id/flag
 * Applies supervisor decision (Approved, Rejected, Pending Review) with reason & notes.
 * Strictly decoupled from attendance sessions (does NOT mark worker present or fabricate clock-ins).
 */
export async function applyAttendanceFlag(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const parseResult = flagDecisionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { flagStatus, status, reason, note } = parseResult.data;
  const finalStatus = (flagStatus || status)!;
  const db = await getDb();

  // 1. Fetch flag record
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
    })
    .from(attendanceFlags)
    .innerJoin(siteAssignments, eq(attendanceFlags.assignmentId, siteAssignments.id))
    .where(and(eq(attendanceFlags.id as any, id as any), eq(attendanceFlags.orgId as any, orgId as any)))
    .limit(1);

  if (!flagRecord) {
    return res.status(404).json({ error: 'FLAG_NOT_FOUND', message: 'Missing clock-in flag record not found' });
  }

  // 2. Permission check: Must be assigned supervisor, or supervisor for this worksite, or ADMIN
  const isAssignedSupervisor = flagRecord.supervisorId === user.id;
  if (!isSuperOrAdmin && !isAssignedSupervisor) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You are not authorized to handle missing clock-in flags for this assignment',
    });
  }

  const beforeValues = {
    flagStatus: flagRecord.flagStatus,
    reason: flagRecord.reason,
    note: flagRecord.note,
  };

  const now = new Date();

  // 3. Update flag record
  const [updated] = await db
    .update(attendanceFlags)
    .set({
      flagStatus: finalStatus,
      reason: reason || null,
      note: note || null,
      reviewedBy: user.id,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceFlags.id as any, id as any))
    .returning();

  // 4. Log audit event
  await logAuditEvent({
    orgId,
    actorId: user.id,
    action: 'ATTENDANCE_FLAG_APPLIED',
    entityType: 'ATTENDANCE_FLAG',
    entityId: id,
    beforeValues,
    afterValues: { flagStatus, reason, note },
    ipAddress: req.ip as any,
    userAgent: req.headers['user-agent'] as any,
  });

  // 5. Notify worker
  await db.insert(notifications).values({
    userId: flagRecord.workerId,
    title: 'Attendance Flag Decision',
    message: `Supervisor ${user.fullName} updated your missing clock-in follow-up for shift ${flagRecord.shiftName}: Decision is ${finalStatus}.`,
    type: 'ATTENDANCE_FLAG',
    entityType: 'ATTENDANCE_FLAG',
    entityId: id as any,
  });

  return res.json({
    success: true,
    message: `Attendance flag successfully marked as ${finalStatus}`,
    flag: updated,
  });
}
