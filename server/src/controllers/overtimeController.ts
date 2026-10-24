import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  attendanceSessions,
  worksites,
  siteAssignments,
  siteAssignmentWorkers,
  users,
  notifications,
  attendanceExceptions,
} from '../database/schema.js';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
import { calculateSessionOvertime, DEFAULT_OVERTIME_POLICY, formatMinutes } from '../services/overtimeService.js';

const approveOtSchema = z.object({
  approvedOtMinutes: z.number().int().min(0).optional(),
  note: z.string().optional(),
});

const rejectOtSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

/**
 * Helper to check if supervisor is authorized for a session
 */
async function isSupervisorAuthorized(db: any, session: any, user: any): Promise<boolean> {
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');
  if (isSuperOrAdmin) return true;

  if (session.supervisorSnapshotId === user.id) return true;

  // Check if supervisor is assigned to the session's assignment
  if (session.assignmentId) {
    const [asgn] = await db
      .select({ supervisorId: siteAssignments.supervisorId, worksiteId: siteAssignments.worksiteId })
      .from(siteAssignments)
      .where(eq(siteAssignments.id as any, session.assignmentId as any))
      .limit(1);

    if (asgn && asgn.supervisorId === user.id) return true;
  }

  // Check if supervisor is assigned to the worksite
  const [siteAsgn] = await db
    .select({ id: siteAssignments.id })
    .from(siteAssignments)
    .where(
      and(
        eq(siteAssignments.worksiteId as any, session.worksiteSnapshotId as any),
        eq(siteAssignments.supervisorId as any, user.id as any)
      )
    )
    .limit(1);

  if (siteAsgn) return true;

  return false;
}

/**
 * GET /attendance/me/overtime-summary
 * Provides month-scoped overtime analytics for the logged-in worker.
 */
export async function getWorkerOvertimeSummary(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const workerId = req.user!.id;

  const monthParam = typeof req.query.month === 'string' && req.query.month.match(/^\d{4}-\d{2}$/)
    ? req.query.month
    : new Date().toISOString().substring(0, 7);

  const [yearStr, monthStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Month date range (YYYY-MM-01 to end of month)
  const startDate = `${monthParam}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${monthParam}-${lastDay < 10 ? '0' : ''}${lastDay}`;

  const sessions = await db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      status: attendanceSessions.status,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      standardHoursMinutes: attendanceSessions.standardHoursMinutes,
      breakDurationMinutes: attendanceSessions.breakDurationMinutes,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      totalDurationSeconds: attendanceSessions.totalDurationSeconds,
      calculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      approvedOtMinutes: attendanceSessions.approvedOtMinutes,
      otStatus: attendanceSessions.otStatus,
      otRejectionReason: attendanceSessions.otRejectionReason,
      isPayrollLocked: attendanceSessions.isPayrollLocked,
      exceptionStatus: attendanceSessions.exceptionStatus,
      worksiteName: worksites.name,
      shiftName: siteAssignments.shiftName,
    })
    .from(attendanceSessions)
    .leftJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .leftJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
    .where(
      and(
        eq(attendanceSessions.workerId as any, workerId as any),
        gte(attendanceSessions.workDate as any, startDate as any),
        lte(attendanceSessions.workDate as any, endDate as any)
      )
    )
    .orderBy(desc(attendanceSessions.workDate));

  let totalNetWorkedMinutes = 0;
  let totalStandardHoursMinutes = 0;
  let totalCalculatedOtMinutes = 0;
  let totalApprovedOtMinutes = 0;
  let totalPendingOtMinutes = 0;
  let totalRejectedOtMinutes = 0;
  let daysWithOtCount = 0;

  const dailyBreakdown = sessions.map((s: any) => {
    const isIncomplete = !s.clockOutTime;
    const isRejected = s.status === 'REJECTED';

    let netMins = Math.floor((s.netWorkingSeconds || 0) / 60);
    // If not calculated yet or session has punches, run central calculation
    let calcOt = s.calculatedOtMinutes || 0;
    let standardMins = s.standardHoursMinutes || DEFAULT_OVERTIME_POLICY.standardHoursMinutes;
    let breakMins = s.breakDurationMinutes || 0;

    if (s.clockInTime && s.clockOutTime && !isRejected) {
      const calc = calculateSessionOvertime(s.clockInTime, s.clockOutTime, s.status, breakMins);
      netMins = calc.netWorkingMinutes;
      calcOt = calc.calculatedOtMinutes;
      standardMins = calc.standardHoursMinutes;
    }

    if (!isRejected && !isIncomplete) {
      totalNetWorkedMinutes += netMins;
      totalStandardHoursMinutes += standardMins;
      totalCalculatedOtMinutes += calcOt;

      if (calcOt > 0) {
        daysWithOtCount += 1;
      }

      if (s.otStatus === 'APPROVED') {
        totalApprovedOtMinutes += (s.approvedOtMinutes || calcOt);
      } else if (s.otStatus === 'PENDING') {
        totalPendingOtMinutes += calcOt;
      } else if (s.otStatus === 'REJECTED') {
        totalRejectedOtMinutes += calcOt;
      }
    }

    return {
      sessionId: s.id,
      workDate: typeof s.workDate === 'string' ? s.workDate.split('T')[0] : new Date(s.workDate).toISOString().split('T')[0],
      worksiteName: s.worksiteName || 'Standard Site',
      shiftName: s.shiftName || 'Regular Shift',
      clockInTime: s.clockInTime,
      clockOutTime: s.clockOutTime,
      breakDurationMinutes: breakMins,
      netWorkingMinutes: netMins,
      standardHoursMinutes: standardMins,
      calculatedOtMinutes: calcOt,
      approvedOtMinutes: s.approvedOtMinutes || 0,
      otStatus: s.otStatus,
      otRejectionReason: s.otRejectionReason,
      attendanceStatus: s.status,
      isPayrollLocked: Boolean(s.isPayrollLocked),
      isIncomplete,
      formattedNetHours: formatMinutes(netMins),
      formattedCalculatedOt: formatMinutes(calcOt),
      formattedApprovedOt: formatMinutes(s.approvedOtMinutes || 0),
    };
  });

  return res.json({
    month: monthParam,
    totalAttendanceDays: sessions.length,
    totalNetWorkedMinutes,
    totalStandardHoursMinutes,
    totalCalculatedOtMinutes,
    totalApprovedOtMinutes,
    totalPendingOtMinutes,
    totalRejectedOtMinutes,
    daysWithOtCount,
    formattedTotalNetHours: formatMinutes(totalNetWorkedMinutes),
    formattedTotalCalculatedOt: formatMinutes(totalCalculatedOtMinutes),
    formattedTotalApprovedOt: formatMinutes(totalApprovedOtMinutes),
    formattedTotalPendingOt: formatMinutes(totalPendingOtMinutes),
    dailyBreakdown,
  });
}

/**
 * GET /overtime/pending
 * Retrieve list of attendance sessions with positive overtime for supervisor / admin review
 */
export async function getPendingOvertimeReviews(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const { status, worksiteId, startDate, endDate } = req.query;

  const conditions = [
    eq(attendanceSessions.orgId as any, orgId as any),
  ];

  if (status && typeof status === 'string' && status !== 'ALL') {
    conditions.push(eq(attendanceSessions.otStatus as any, status as any));
  } else if (!status) {
    // Default to PENDING and positive OT
    conditions.push(eq(attendanceSessions.otStatus as any, 'PENDING' as any));
  }

  if (worksiteId && typeof worksiteId === 'string') {
    conditions.push(eq(attendanceSessions.worksiteSnapshotId as any, worksiteId as any));
  }

  if (startDate && typeof startDate === 'string') {
    conditions.push(gte(attendanceSessions.workDate as any, startDate as any));
  }

  if (endDate && typeof endDate === 'string') {
    conditions.push(lte(attendanceSessions.workDate as any, endDate as any));
  }

  const records = await db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      attendanceStatus: attendanceSessions.status,
      standardHoursMinutes: attendanceSessions.standardHoursMinutes,
      breakDurationMinutes: attendanceSessions.breakDurationMinutes,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      calculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      approvedOtMinutes: attendanceSessions.approvedOtMinutes,
      otStatus: attendanceSessions.otStatus,
      otReviewerId: attendanceSessions.otReviewerId,
      otReviewedAt: attendanceSessions.otReviewedAt,
      otRejectionReason: attendanceSessions.otRejectionReason,
      isPayrollLocked: attendanceSessions.isPayrollLocked,
      supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
      assignmentId: attendanceSessions.assignmentId,
      worksiteSnapshotId: attendanceSessions.worksiteSnapshotId,
      workerId: users.id,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      workerEmail: users.email,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      shiftName: siteAssignments.shiftName,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .leftJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
    .where(and(...conditions))
    .orderBy(desc(attendanceSessions.workDate), desc(attendanceSessions.createdAt));

  // Filter based on supervisor scope if not admin
  let authorizedRecords: any[] = [];
  if (isSuperOrAdmin) {
    authorizedRecords = records;
  } else {
    for (const r of records) {
      if (await isSupervisorAuthorized(db, r, user)) {
        authorizedRecords.push(r);
      }
    }
  }

  const items = authorizedRecords.map((r: any) => {
    const netMins = Math.floor((r.netWorkingSeconds || 0) / 60);
    return {
      id: r.id,
      sessionId: r.id,
      workerId: r.workerId,
      workerName: r.workerName,
      employeeCode: r.employeeCode,
      workerEmail: r.workerEmail,
      worksiteName: r.worksiteName,
      worksiteCode: r.worksiteCode,
      shiftName: r.shiftName || 'Standard Shift',
      workDate: typeof r.workDate === 'string' ? r.workDate.split('T')[0] : new Date(r.workDate).toISOString().split('T')[0],
      clockInTime: r.clockInTime,
      clockOutTime: r.clockOutTime,
      attendanceStatus: r.attendanceStatus,
      standardHoursMinutes: r.standardHoursMinutes || DEFAULT_OVERTIME_POLICY.standardHoursMinutes,
      breakDurationMinutes: r.breakDurationMinutes || 0,
      netWorkingMinutes: netMins,
      calculatedOtMinutes: r.calculatedOtMinutes,
      approvedOtMinutes: r.approvedOtMinutes,
      otStatus: r.otStatus,
      otReviewedAt: r.otReviewedAt,
      otRejectionReason: r.otRejectionReason,
      isPayrollLocked: Boolean(r.isPayrollLocked),
      formattedNetHours: formatMinutes(netMins),
      formattedCalculatedOt: formatMinutes(r.calculatedOtMinutes),
      formattedApprovedOt: formatMinutes(r.approvedOtMinutes),
      hasMissingClockOut: !r.clockOutTime,
    };
  });

  return res.json(items);
}

/**
 * POST /overtime/:id/approve
 * Supervisor / Admin approves overtime for an attendance session.
 */
export async function approveOvertime(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = approveOtSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, orgId as any)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  // Prevent modifying locked payroll
  if (session.isPayrollLocked) {
    return res.status(403).json({
      error: 'PAYROLL_LOCKED',
      message: 'This session has been finalized in payroll and its overtime cannot be modified directly.',
    });
  }

  // Authorization check
  const authorized = await isSupervisorAuthorized(db, session, user);
  if (!authorized) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_SUPERVISOR',
      message: 'You are not authorized to approve overtime for this attendance session',
    });
  }

  // Terminal decision check: prevent duplicate terminal decision
  if (session.otStatus === 'APPROVED') {
    return res.status(400).json({
      error: 'ALREADY_APPROVED',
      message: 'Overtime for this session is already approved.',
    });
  }

  if (!session.clockOutTime) {
    return res.status(400).json({
      error: 'INCOMPLETE_ATTENDANCE',
      message: 'Overtime cannot be approved for an incomplete attendance session with missing clock-out.',
    });
  }

  if (session.status === 'REJECTED') {
    return res.status(400).json({
      error: 'ATTENDANCE_REJECTED',
      message: 'Overtime cannot be approved when underlying attendance is rejected.',
    });
  }

  const calculatedOt = session.calculatedOtMinutes || 0;
  const approvedOt = parseResult.data.approvedOtMinutes !== undefined
    ? Math.min(parseResult.data.approvedOtMinutes, calculatedOt)
    : calculatedOt;

  const now = new Date();

  const [updated] = await db
    .update(attendanceSessions)
    .set({
      approvedOtMinutes: approvedOt,
      otStatus: 'APPROVED',
      otReviewerId: user.id as any,
      otReviewedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, id as any))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: user.id,
    action: 'APPROVE_OVERTIME',
    entityType: 'ATTENDANCE_SESSION',
    entityId: id,
    reason: parseResult.data.note || 'Overtime approved by supervisor',
    beforeValues: {
      calculatedOtMinutes: session.calculatedOtMinutes,
      approvedOtMinutes: session.approvedOtMinutes,
      otStatus: session.otStatus,
    },
    afterValues: {
      approvedOtMinutes: approvedOt,
      otStatus: 'APPROVED',
      reviewerId: user.id,
    },
    ipAddress: req.ip,
  });

  await db.insert(notifications).values({
    userId: session.workerId,
    title: 'Overtime Approved',
    message: `Your overtime of ${formatMinutes(approvedOt)} for ${session.workDate} has been approved.`,
    type: 'OVERTIME_APPROVED',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
  });

  return res.json({
    success: true,
    message: `Overtime approved (${formatMinutes(approvedOt)})`,
    session: updated,
  });
}

/**
 * POST /overtime/:id/reject
 * Supervisor / Admin rejects overtime for an attendance session.
 * Requires mandatory reason.
 */
export async function rejectOvertime(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = rejectOtSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, orgId as any)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  if (session.isPayrollLocked) {
    return res.status(403).json({
      error: 'PAYROLL_LOCKED',
      message: 'This session has been finalized in payroll and its overtime cannot be modified directly.',
    });
  }

  const authorized = await isSupervisorAuthorized(db, session, user);
  if (!authorized) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_SUPERVISOR',
      message: 'You are not authorized to review overtime for this attendance session',
    });
  }

  if (session.otStatus === 'REJECTED') {
    return res.status(400).json({
      error: 'ALREADY_REJECTED',
      message: 'Overtime for this session has already been rejected.',
    });
  }

  const now = new Date();
  const { reason } = parseResult.data;

  const [updated] = await db
    .update(attendanceSessions)
    .set({
      approvedOtMinutes: 0,
      otStatus: 'REJECTED',
      otReviewerId: user.id as any,
      otReviewedAt: now,
      otRejectionReason: reason,
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, id as any))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: user.id,
    action: 'REJECT_OVERTIME',
    entityType: 'ATTENDANCE_SESSION',
    entityId: id,
    reason,
    beforeValues: {
      calculatedOtMinutes: session.calculatedOtMinutes,
      approvedOtMinutes: session.approvedOtMinutes,
      otStatus: session.otStatus,
    },
    afterValues: {
      approvedOtMinutes: 0,
      otStatus: 'REJECTED',
      rejectionReason: reason,
    },
    ipAddress: req.ip,
  });

  await db.insert(notifications).values({
    userId: session.workerId,
    title: 'Overtime Rejected',
    message: `Your overtime for ${session.workDate} was rejected. Reason: ${reason}`,
    type: 'OVERTIME_REJECTED',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
  });

  return res.json({
    success: true,
    message: 'Overtime rejected successfully',
    session: updated,
  });
}
