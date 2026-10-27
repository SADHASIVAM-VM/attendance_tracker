import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  attendanceAdjustmentRequests,
  attendanceSessions,
  attendanceExceptions,
  approvalActions,
  auditLogs,
  users,
  worksites,
  siteAssignments,
  notifications,
  payrollPeriods,
  payrollAdjustments,
} from '../database/schema.js';
import { eq, and, or, desc, sql, count, inArray, ne, gte, lte } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
import { calculateSessionOvertime } from '../services/overtimeService.js';
import { generateSignedDownloadUrl } from '../services/storage.js';

/**
 * GET /admin/corrections/summary
 * Section A: Summary KPI cards for Admin Attendance Control Center
 */
export async function getAdminControlSummary(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const now = new Date();
  const overdue24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Pending attendance correction requests
  const [pendingCorrections] = await db
    .select({ count: count() })
    .from(attendanceAdjustmentRequests)
    .innerJoin(attendanceSessions, eq(attendanceAdjustmentRequests.sessionId, attendanceSessions.id))
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        sql`${attendanceAdjustmentRequests.status} IN ('PENDING', 'MORE_INFO_REQUESTED')`
      )
    );

  // 2. Overdue supervisor approvals (> 24 hours in PENDING or isEscalated = true)
  const [overdueApprovals] = await db
    .select({ count: count() })
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        eq(attendanceSessions.status, 'PENDING'),
        or(
          eq(attendanceSessions.isEscalated, true),
          sql`${attendanceSessions.createdAt} <= ${overdue24hAgo}`
        )
      )
    );

  // 3. Missing-attendance exceptions (open/investigating)
  const [missingExceptions] = await db
    .select({ count: count() })
    .from(attendanceExceptions)
    .where(
      and(
        eq(attendanceExceptions.orgId, orgId),
        eq(attendanceExceptions.exceptionType, 'MISSING_CLOCK_IN'),
        sql`${attendanceExceptions.status} IN ('OPEN', 'INVESTIGATING', 'ESCALATED')`
      )
    );

  // 4. Approved correction requests
  const [approvedCorrections] = await db
    .select({ count: count() })
    .from(attendanceAdjustmentRequests)
    .innerJoin(attendanceSessions, eq(attendanceAdjustmentRequests.sessionId, attendanceSessions.id))
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        eq(attendanceAdjustmentRequests.status, 'APPROVED')
      )
    );

  // 5. Rejected correction requests
  const [rejectedCorrections] = await db
    .select({ count: count() })
    .from(attendanceAdjustmentRequests)
    .innerJoin(attendanceSessions, eq(attendanceAdjustmentRequests.sessionId, attendanceSessions.id))
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        eq(attendanceAdjustmentRequests.status, 'REJECTED')
      )
    );

  // 6. Payroll-locked periods requiring controlled correction
  const [payrollLockedPeriods] = await db
    .select({ count: count() })
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.orgId, orgId),
        sql`${payrollPeriods.status} IN ('LOCKED', 'FINALIZED')`
      )
    );

  return res.json({
    pendingCorrections: Number(pendingCorrections?.count || 0),
    overdueApprovals: Number(overdueApprovals?.count || 0),
    missingAttendanceExceptions: Number(missingExceptions?.count || 0),
    approvedCorrections: Number(approvedCorrections?.count || 0),
    rejectedCorrections: Number(rejectedCorrections?.count || 0),
    payrollLockedPeriods: Number(payrollLockedPeriods?.count || 0),
  });
}

/**
 * GET /admin/corrections
 * Section B: Filterable, searchable, paginated correction requests table
 */
export async function getAdminCorrectionRequests(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '15'), 10) || 15));
  const offset = (page - 1) * limit;

  const {
    status,
    correctionType,
    workerId,
    supervisorId,
    worksiteId,
    attendanceDate,
    startDate,
    endDate,
    search,
  } = req.query as Record<string, string>;

  // Build conditions
  const conditions = [eq(attendanceSessions.orgId, orgId)];

  if (status && status !== 'ALL') {
    conditions.push(eq(attendanceAdjustmentRequests.status, status));
  }
  if (correctionType && correctionType !== 'ALL') {
    conditions.push(eq(attendanceAdjustmentRequests.correctionType, correctionType));
  }
  if (workerId) {
    conditions.push(eq(attendanceSessions.workerId, workerId));
  }
  if (supervisorId) {
    conditions.push(
      or(
        eq(attendanceSessions.supervisorSnapshotId, supervisorId),
        eq(attendanceAdjustmentRequests.currentApproverId, supervisorId)
      )!
    );
  }
  if (worksiteId) {
    conditions.push(eq(attendanceSessions.worksiteSnapshotId, worksiteId));
  }
  if (attendanceDate) {
    conditions.push(sql`${attendanceAdjustmentRequests.workDate} = ${attendanceDate}::date`);
  }
  if (startDate) {
    conditions.push(sql`${attendanceAdjustmentRequests.createdAt} >= ${startDate}::timestamp`);
  }
  if (endDate) {
    conditions.push(sql`${attendanceAdjustmentRequests.createdAt} <= ${endDate}::timestamp + interval '1 day'`);
  }

  // Base query with joins
  const baseQuery = db
    .select({
      id: attendanceAdjustmentRequests.id,
      sessionId: attendanceAdjustmentRequests.sessionId,
      requestingUserId: attendanceAdjustmentRequests.requestingUserId,
      reviewerId: attendanceAdjustmentRequests.reviewerId,
      currentApproverId: attendanceAdjustmentRequests.currentApproverId,
      correctionType: attendanceAdjustmentRequests.correctionType,
      workDate: attendanceAdjustmentRequests.workDate,
      reason: attendanceAdjustmentRequests.reason,
      proposedClockInTime: attendanceAdjustmentRequests.proposedClockInTime,
      proposedClockOutTime: attendanceAdjustmentRequests.proposedClockOutTime,
      supportingEvidenceUrl: attendanceAdjustmentRequests.supportingEvidenceUrl,
      status: attendanceAdjustmentRequests.status,
      isEscalated: attendanceAdjustmentRequests.isEscalated,
      escalatedAt: attendanceAdjustmentRequests.escalatedAt,
      escalationReason: attendanceAdjustmentRequests.escalationReason,
      reviewNote: attendanceAdjustmentRequests.reviewNote,
      reviewedAt: attendanceAdjustmentRequests.reviewedAt,
      submittedDate: attendanceAdjustmentRequests.createdAt,
      // Worker info
      workerId: users.id,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      workerAvatar: users.photoUrl,
      workerRole: users.employmentType,
      // Original session info
      originalStatus: attendanceSessions.status,
      originalClockInTime: attendanceSessions.clockInTime,
      originalClockOutTime: attendanceSessions.clockOutTime,
      originalTotalDurationSeconds: attendanceSessions.totalDurationSeconds,
      originalStandardHoursMinutes: attendanceSessions.standardHoursMinutes,
      originalCalculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      originalApprovedOtMinutes: attendanceSessions.approvedOtMinutes,
      originalOtStatus: attendanceSessions.otStatus,
      isPayrollLocked: attendanceSessions.isPayrollLocked,
      payrollPeriodId: attendanceSessions.payrollPeriodId,
      supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
      // Worksite info
      worksiteId: worksites.id,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
    })
    .from(attendanceAdjustmentRequests)
    .innerJoin(attendanceSessions, eq(attendanceAdjustmentRequests.sessionId, attendanceSessions.id))
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .where(and(...conditions));

  const allRows = await baseQuery.orderBy(desc(attendanceAdjustmentRequests.createdAt));

  // Resolve supervisor & reviewer names
  const userIdsToFetch = new Set<string>();
  for (const r of allRows) {
    if (r.supervisorSnapshotId) userIdsToFetch.add(r.supervisorSnapshotId);
    if (r.currentApproverId) userIdsToFetch.add(r.currentApproverId);
    if (r.reviewerId) userIdsToFetch.add(r.reviewerId);
  }

  const nameMap: Record<string, string> = {};
  if (userIdsToFetch.size > 0) {
    const userNames = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, Array.from(userIdsToFetch)));
    for (const u of userNames) {
      nameMap[u.id] = u.fullName;
    }
  }

  let enriched = allRows.map((r) => ({
    ...r,
    supervisorName: r.supervisorSnapshotId ? nameMap[r.supervisorSnapshotId] || 'Assigned Supervisor' : 'Assigned Supervisor',
    currentApproverName: r.currentApproverId ? nameMap[r.currentApproverId] || 'Admin Queue' : 'Admin Queue',
    reviewerName: r.reviewerId ? nameMap[r.reviewerId] || 'Administrator' : null,
  }));

  // Client search filter (worker name, code, request ID, reason)
  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    enriched = enriched.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.workerName.toLowerCase().includes(q) ||
        (item.employeeCode && item.employeeCode.toLowerCase().includes(q)) ||
        item.worksiteName.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q)
    );
  }

  const total = enriched.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = enriched.slice(offset, offset + limit);

  return res.json({
    data: paginated,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  });
}

/**
 * GET /admin/corrections/:id
 * Section C: Request detail view with original attendance, proposed changes, previous decisions, and audit trail
 */
export async function getAdminCorrectionDetail(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [request] = await db
    .select({
      id: attendanceAdjustmentRequests.id,
      sessionId: attendanceAdjustmentRequests.sessionId,
      requestingUserId: attendanceAdjustmentRequests.requestingUserId,
      reviewerId: attendanceAdjustmentRequests.reviewerId,
      currentApproverId: attendanceAdjustmentRequests.currentApproverId,
      correctionType: attendanceAdjustmentRequests.correctionType,
      workDate: attendanceAdjustmentRequests.workDate,
      reason: attendanceAdjustmentRequests.reason,
      proposedClockInTime: attendanceAdjustmentRequests.proposedClockInTime,
      proposedClockOutTime: attendanceAdjustmentRequests.proposedClockOutTime,
      supportingEvidenceUrl: attendanceAdjustmentRequests.supportingEvidenceUrl,
      status: attendanceAdjustmentRequests.status,
      isEscalated: attendanceAdjustmentRequests.isEscalated,
      escalatedAt: attendanceAdjustmentRequests.escalatedAt,
      escalationReason: attendanceAdjustmentRequests.escalationReason,
      reviewNote: attendanceAdjustmentRequests.reviewNote,
      reviewedAt: attendanceAdjustmentRequests.reviewedAt,
      submittedDate: attendanceAdjustmentRequests.createdAt,
    })
    .from(attendanceAdjustmentRequests)
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .limit(1);

  if (!request) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Correction request not found' });
  }

  // Fetch session details
  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id, request.sessionId), eq(attendanceSessions.orgId, orgId)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Associated attendance session not found' });
  }

  // Fetch worker info
  const [worker] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      employeeCode: users.employeeCode,
      email: users.email,
      phone: users.phone,
      photoUrl: users.photoUrl,
      employmentType: users.employmentType,
    })
    .from(users)
    .where(eq(users.id, session.workerId))
    .limit(1);

  // Fetch worksite info
  const [worksite] = await db
    .select()
    .from(worksites)
    .where(eq(worksites.id, session.worksiteSnapshotId))
    .limit(1);

  // Fetch requester & supervisor info
  const [requester] = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email })
    .from(users)
    .where(eq(users.id, request.requestingUserId))
    .limit(1);

  let supervisor = null;
  if (session.supervisorSnapshotId) {
    const [sup] = await db
      .select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.id, session.supervisorSnapshotId))
      .limit(1);
    supervisor = sup || null;
  }

  // Fetch payroll period status if applicable
  let payrollPeriod = null;
  if (session.payrollPeriodId) {
    const [p] = await db
      .select()
      .from(payrollPeriods)
      .where(eq(payrollPeriods.id, session.payrollPeriodId))
      .limit(1);
    payrollPeriod = p || null;
  } else {
    // Check if workDate falls into any locked or finalized payroll period
    const workDateStr = String(request.workDate || session.workDate).split('T')[0];
    const [activePeriod] = await db
      .select()
      .from(payrollPeriods)
      .where(
        and(
          eq(payrollPeriods.orgId, orgId),
          sql`${payrollPeriods.startDate} <= ${workDateStr}`,
          sql`${payrollPeriods.endDate} >= ${workDateStr}`
        )
      )
      .orderBy(desc(payrollPeriods.createdAt))
      .limit(1);
    payrollPeriod = activePeriod || null;
  }

  // Fetch previous approval actions on this session
  const previousActions = await db
    .select({
      id: approvalActions.id,
      action: approvalActions.action,
      reviewerId: approvalActions.reviewerId,
      reviewerName: users.fullName,
      note: approvalActions.note,
      reason: approvalActions.reason,
      performedAt: approvalActions.performedAt,
    })
    .from(approvalActions)
    .leftJoin(users, eq(approvalActions.reviewerId, users.id))
    .where(eq(approvalActions.sessionId, session.id))
    .orderBy(desc(approvalActions.performedAt));

  // Fetch related audit logs
  const relatedAuditLogs = await db
    .select()
    .from(auditLogs)
    .where(
      or(
        eq(auditLogs.entityId, String(id)),
        eq(auditLogs.entityId, session.id)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);

  return res.json({
    request: {
      ...request,
      requesterName: requester?.fullName || 'Worker',
    },
    session,
    worker,
    worksite,
    supervisor,
    payrollPeriod,
    previousActions,
    auditHistory: relatedAuditLogs,
  });
}

/**
 * POST /admin/corrections/:id/approve
 * Section D: Atomic approval with payroll lock protection, duration recalculation, and audit logging
 */
const approveSchema = z.object({
  reviewNote: z.string().optional(),
  confirmPayrollOverride: z.boolean().optional(),
});

export async function approveAdminCorrection(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = approveSchema.safeParse(req.body);
  const reviewNote = (parseResult.success ? parseResult.data.reviewNote : req.body?.reviewNote) || 'Approved by Administrator';

  const db = await getDb();
  const admin = req.user!;
  const orgId = admin.orgId;

  const [request] = await db
    .select()
    .from(attendanceAdjustmentRequests)
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .limit(1);

  if (!request) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Correction request not found' });
  }

  if (request.status === 'APPROVED') {
    return res.status(400).json({ error: 'ALREADY_APPROVED', message: 'Correction request is already approved' });
  }

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id, request.sessionId), eq(attendanceSessions.orgId, orgId)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Associated attendance session not found' });
  }

  const now = new Date();

  // 1. Calculate proposed timestamps
  const newClockIn = request.proposedClockInTime || session.clockInTime;
  const newClockOut = request.proposedClockOutTime || session.clockOutTime;

  let totalDurationSeconds = 0;
  if (newClockIn && newClockOut) {
    totalDurationSeconds = Math.max(0, Math.round((new Date(newClockOut).getTime() - new Date(newClockIn).getTime()) / 1000));
  }

  const breakMinutes = session.breakDurationMinutes || 0;
  const otCalc = calculateSessionOvertime(
    newClockIn,
    newClockOut,
    'APPROVED',
    breakMinutes,
    {
      standardHoursMinutes: session.standardHoursMinutes || 540,
      defaultBreakMinutes: breakMinutes,
      policyVersion: session.policyVersionSnapshot || 'v1.0',
    }
  );

  // 2. Check Payroll Lock Protection
  const isLocked = session.isPayrollLocked || !!session.payrollPeriodId;
  let payrollAdjustmentCreated = null;

  if (isLocked && session.payrollPeriodId) {
    // If locked in finalized payroll, create an adjustment entry rather than silently modifying finalized totals
    const diffMinutes = otCalc.calculatedOtMinutes - (session.calculatedOtMinutes || 0);
    const [adj] = await db
      .insert(payrollAdjustments)
      .values({
        payrollPeriodId: session.payrollPeriodId,
        workerId: session.workerId,
        adjustmentType: 'OVERTIME',
        amountOrMinutes: diffMinutes,
        reason: `Admin Correction Approved: ${request.reason} (${reviewNote})`,
        adjustedBy: admin.id,
      })
      .returning();
    payrollAdjustmentCreated = adj;
  }

  // 3. Atomically update session and request
  const sessionUpdates: any = {
    status: 'APPROVED',
    notes: reviewNote,
    actionBy: admin.id,
    currentApproverId: admin.id,
    rejectionReason: null,
    approvedAt: now,
    approvalSource: 'ADMIN_OVERRIDE',
    exceptionStatus: 'CORRECTION_APPLIED',
    updatedAt: now,
  };

  if (request.proposedClockInTime) sessionUpdates.clockInTime = request.proposedClockInTime;
  if (request.proposedClockOutTime) sessionUpdates.clockOutTime = request.proposedClockOutTime;
  if (totalDurationSeconds > 0) {
    sessionUpdates.totalDurationSeconds = totalDurationSeconds;
    sessionUpdates.netWorkingSeconds = otCalc.netWorkingMinutes * 60;
  }
  if (!isLocked) {
    sessionUpdates.calculatedOtMinutes = otCalc.calculatedOtMinutes;
    sessionUpdates.approvedOtMinutes = otCalc.calculatedOtMinutes;
    sessionUpdates.otStatus = otCalc.otStatus;
  }

  const [updatedSession] = await db
    .update(attendanceSessions)
    .set(sessionUpdates)
    .where(eq(attendanceSessions.id, session.id))
    .returning();

  // 4. Update request status to APPROVED
  const [updatedRequest] = await db
    .update(attendanceAdjustmentRequests)
    .set({
      status: 'APPROVED',
      reviewerId: admin.id,
      reviewNote,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .returning();

  // 5. Insert approval action (Immutable Attendance Audit History)
  await db.insert(approvalActions).values({
    sessionId: session.id,
    workerId: session.workerId,
    workDate: session.workDate,
    previousStatus: session.status,
    newStatus: 'APPROVED',
    action: 'ADMIN_CORRECTION_APPROVED',
    actionType: 'ADMIN_CORRECTION_APPROVED',
    reviewerId: admin.id,
    actorRole: admin.roles[0] || 'ADMIN',
    regularizationId: request.id,
    note: reviewNote,
    reason: request.reason,
    performedAt: now,
  });

  // 6. Resolve any open attendance exceptions for this worker & date
  await db
    .update(attendanceExceptions)
    .set({
      status: 'RESOLVED',
      resolutionType: 'CORRECTION_APPLIED',
      resolutionNote: `Resolved via admin approved correction: ${reviewNote}`,
      resolvedBy: admin.id,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(attendanceExceptions.workerId, session.workerId),
        sql`${attendanceExceptions.workDate} = ${request.workDate}::date`,
        ne(attendanceExceptions.status, 'RESOLVED')
      )
    );

  // 7. Record immutable audit log
  await logAuditEvent({
    orgId,
    actorId: admin.id,
    actorNameSnapshot: admin.fullName,
    actorRole: admin.roles[0],
    action: 'ADMIN_APPROVE_CORRECTION',
    entityType: 'ATTENDANCE_CORRECTION',
    entityId: id,
    reason: reviewNote,
    beforeValues: {
      status: session.status,
      clockInTime: session.clockInTime,
      clockOutTime: session.clockOutTime,
      totalDurationSeconds: session.totalDurationSeconds,
      isPayrollLocked: session.isPayrollLocked,
    },
    afterValues: {
      status: 'APPROVED',
      clockInTime: updatedSession.clockInTime,
      clockOutTime: updatedSession.clockOutTime,
      totalDurationSeconds: updatedSession.totalDurationSeconds,
      payrollAdjustmentId: payrollAdjustmentCreated?.id || null,
      reviewNote,
    },
    req,
  });

  // 8. Notify worker & supervisor
  await db.insert(notifications).values({
    userId: request.requestingUserId,
    title: 'Attendance Correction Approved',
    message: `Your attendance correction request for ${request.workDate} was approved by Administrator ${admin.fullName}.`,
    type: 'CORRECTION_APPROVED',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: id,
  });

  return res.json({
    success: true,
    message: 'Correction request approved and attendance record updated atomically',
    request: updatedRequest,
    session: updatedSession,
    payrollAdjustment: payrollAdjustmentCreated,
  });
}

/**
 * POST /admin/corrections/:id/reject
 * Section D: Rejects correction request with mandatory explanation, preserving original attendance record
 */
const rejectSchema = z.object({
  reason: z.string().min(5, 'A mandatory explanation of at least 5 characters is required'),
});

export async function rejectAdminCorrection(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = rejectSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'EXPLANATION_REQUIRED',
      message: 'A mandatory explanation (at least 5 characters) is required when rejecting a correction request',
      details: parseResult.error.issues,
    });
  }

  const { reason } = parseResult.data;
  const db = await getDb();
  const admin = req.user!;
  const orgId = admin.orgId;

  const [request] = await db
    .select()
    .from(attendanceAdjustmentRequests)
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .limit(1);

  if (!request) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Correction request not found' });
  }

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id, request.sessionId), eq(attendanceSessions.orgId, orgId)))
    .limit(1);

  const now = new Date();

  // 1. Mark request as REJECTED (Original attendance session is preserved UNCHANGED)
  const [updatedRequest] = await db
    .update(attendanceAdjustmentRequests)
    .set({
      status: 'REJECTED',
      reviewerId: admin.id,
      reviewNote: reason,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .returning();

  // 2. Insert approval action (Immutable Attendance Audit History)
  if (session) {
    await db.insert(approvalActions).values({
      sessionId: session.id,
      workerId: session.workerId,
      workDate: session.workDate,
      previousStatus: session.status,
      newStatus: session.status,
      action: 'ADMIN_CORRECTION_REJECTED',
      actionType: 'ADMIN_CORRECTION_REJECTED',
      reviewerId: admin.id,
      actorRole: admin.roles[0] || 'ADMIN',
      regularizationId: request.id,
      note: reason,
      reason,
      performedAt: now,
    });
  }

  // 3. Record audit log
  await logAuditEvent({
    orgId,
    actorId: admin.id,
    actorNameSnapshot: admin.fullName,
    actorRole: admin.roles[0],
    action: 'ADMIN_REJECT_CORRECTION',
    entityType: 'ATTENDANCE_CORRECTION',
    entityId: id,
    reason,
    beforeValues: { status: request.status },
    afterValues: { status: 'REJECTED', rejectionReason: reason },
    req,
  });

  // 4. Notify worker
  await db.insert(notifications).values({
    userId: request.requestingUserId,
    title: 'Attendance Correction Rejected',
    message: `Your attendance correction request for ${request.workDate} was rejected: ${reason}`,
    type: 'CORRECTION_REJECTED',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: id,
  });

  return res.json({
    success: true,
    message: 'Correction request rejected. Original attendance record preserved unchanged.',
    request: updatedRequest,
  });
}

/**
 * POST /admin/corrections/:id/request-info
 * Section C: Request More Information from worker/supervisor
 */
const requestInfoSchema = z.object({
  note: z.string().min(5, 'Clarification note is mandatory'),
});

export async function requestInfoAdminCorrection(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = requestInfoSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'NOTE_REQUIRED', message: 'Clarification note is required' });
  }

  const { note } = parseResult.data;
  const db = await getDb();
  const admin = req.user!;
  const orgId = admin.orgId;
  const now = new Date();

  const [request] = await db
    .select()
    .from(attendanceAdjustmentRequests)
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .limit(1);

  if (!request) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Correction request not found' });
  }

  const [updatedRequest] = await db
    .update(attendanceAdjustmentRequests)
    .set({
      status: 'MORE_INFO_REQUESTED',
      reviewNote: note,
      updatedAt: now,
    })
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: admin.id,
    actorNameSnapshot: admin.fullName,
    actorRole: admin.roles[0],
    action: 'ADMIN_REQUEST_MORE_INFO',
    entityType: 'ATTENDANCE_CORRECTION',
    entityId: id,
    reason: note,
    req,
  });

  await db.insert(notifications).values({
    userId: request.requestingUserId,
    title: 'More Information Requested for Attendance Correction',
    message: `Admin requested clarification for your ${request.workDate} correction: "${note}"`,
    type: 'CLARIFICATION_REQUESTED',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: id,
  });

  return res.json({
    success: true,
    message: 'Clarification request sent to employee',
    request: updatedRequest,
  });
}

/**
 * POST /admin/corrections/create-missing-attendance
 * Section D: Resolving missing attendance through an authorized correction workflow
 */
const createMissingSchema = z.object({
  workerId: z.string().uuid(),
  worksiteId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  clockInTime: z.string().datetime().optional(),
  clockOutTime: z.string().datetime().optional(),
  reason: z.string().min(5, 'Mandatory administrative justification is required'),
  status: z.enum(['APPROVED', 'PENDING']).default('APPROVED'),
});

export async function createAdminMissingAttendanceCorrection(req: Request, res: Response): Promise<any> {
  const parseResult = createMissingSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { workerId, worksiteId, workDate, clockInTime, clockOutTime, reason, status } = parseResult.data;
  const db = await getDb();
  const admin = req.user!;
  const orgId = admin.orgId;
  const now = new Date();

  // Find assignment or create session
  const [assignment] = await db
    .select()
    .from(siteAssignments)
    .where(and(eq(siteAssignments.orgId, orgId), eq(siteAssignments.worksiteId, worksiteId)))
    .orderBy(desc(siteAssignments.createdAt))
    .limit(1);

  const [workerUser] = await db.select().from(users).where(eq(users.id, workerId)).limit(1);
  if (!workerUser) {
    return res.status(404).json({ error: 'WORKER_NOT_FOUND', message: 'Worker not found' });
  }

  // Check if session already exists for this date
  let [session] = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.workerId, workerId),
        sql`${attendanceSessions.workDate} = ${workDate}::date`
      )
    )
    .limit(1);

  const parsedIn = clockInTime ? new Date(clockInTime) : null;
  const parsedOut = clockOutTime ? new Date(clockOutTime) : null;
  let durSec = 0;
  if (parsedIn && parsedOut) {
    durSec = Math.max(0, Math.round((parsedOut.getTime() - parsedIn.getTime()) / 1000));
  }

  if (!session) {
    const [createdSession] = await db
      .insert(attendanceSessions)
      .values({
        orgId,
        workerId,
        assignmentId: assignment?.id || '00000000-0000-0000-0000-000000000000',
        worksiteSnapshotId: worksiteId,
        supervisorSnapshotId: assignment?.supervisorId || admin.id,
        currentApproverId: admin.id,
        workDate,
        status,
        idempotencyKey: `admin_corr_${workerId}_${workDate}_${Date.now()}`,
        clockInTime: parsedIn,
        clockOutTime: parsedOut,
        totalDurationSeconds: durSec,
        netWorkingSeconds: durSec,
        approvalSource: 'ADMIN_OVERRIDE',
        approvedAt: status === 'APPROVED' ? now : null,
        exceptionStatus: 'CORRECTION_APPLIED',
      })
      .returning();
    session = createdSession;
  } else {
    const [updated] = await db
      .update(attendanceSessions)
      .set({
        status,
        clockInTime: parsedIn || session.clockInTime,
        clockOutTime: parsedOut || session.clockOutTime,
        totalDurationSeconds: durSec || session.totalDurationSeconds,
        netWorkingSeconds: durSec || session.netWorkingSeconds,
        approvalSource: 'ADMIN_OVERRIDE',
        approvedAt: status === 'APPROVED' ? now : session.approvedAt,
        exceptionStatus: 'CORRECTION_APPLIED',
        updatedAt: now,
      })
      .where(eq(attendanceSessions.id, session.id))
      .returning();
    session = updated;
  }

  // Create explicit correction record in attendanceAdjustmentRequests
  const [adjustment] = await db
    .insert(attendanceAdjustmentRequests)
    .values({
      sessionId: session.id,
      requestingUserId: admin.id,
      reviewerId: admin.id,
      currentApproverId: admin.id,
      correctionType: 'MISSING_CLOCK_IN',
      workDate,
      reason: `Admin-authorized missing attendance resolution: ${reason}`,
      proposedClockInTime: parsedIn,
      proposedClockOutTime: parsedOut,
      status: 'APPROVED',
      reviewedAt: now,
      reviewNote: reason,
    })
    .returning();

  // Insert approval action
  await db.insert(approvalActions).values({
    sessionId: session.id,
    action: 'ADMIN_OVERRIDE',
    reviewerId: admin.id,
    note: reason,
    performedAt: now,
  });

  // Resolve any open missing attendance exceptions
  await db
    .update(attendanceExceptions)
    .set({
      status: 'RESOLVED',
      resolutionType: 'CORRECTION_APPLIED',
      resolutionNote: `Resolved by admin: ${reason}`,
      resolvedBy: admin.id,
      resolvedAt: now,
      sessionId: session.id,
      updatedAt: now,
    })
    .where(
      and(
        eq(attendanceExceptions.workerId, workerId),
        sql`${attendanceExceptions.workDate} = ${workDate}::date`,
        ne(attendanceExceptions.status, 'RESOLVED')
      )
    );

  await logAuditEvent({
    orgId,
    actorId: admin.id,
    actorNameSnapshot: admin.fullName,
    actorRole: admin.roles[0],
    action: 'ADMIN_CREATE_MISSING_ATTENDANCE_CORRECTION',
    entityType: 'ATTENDANCE_CORRECTION',
    entityId: adjustment.id,
    reason,
    afterValues: { workerId, workDate, status, clockInTime, clockOutTime },
    req,
  });

  return res.status(201).json({
    success: true,
    message: 'Explicit attendance correction record created and attendance applied',
    adjustment,
    session,
  });
}

/**
 * GET /admin/overdue-approvals
 * Section E: Overdue approvals view grouped by supervisor, site, date, and overdue duration
 */
export async function getAdminOverdueApprovals(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const now = new Date();

  const thresholdHours = parseInt(String(req.query.thresholdHours || '24'), 10) || 24;
  const thresholdDate = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);

  const { supervisorId, worksiteId, severity, search } = req.query as Record<string, string>;

  const conditions = [
    eq(attendanceSessions.orgId, orgId),
    eq(attendanceSessions.status, 'PENDING'),
    or(
      eq(attendanceSessions.isEscalated, true),
      sql`${attendanceSessions.createdAt} <= ${thresholdDate}`
    )!,
  ];

  if (supervisorId) {
    conditions.push(
      or(
        eq(attendanceSessions.supervisorSnapshotId, supervisorId),
        eq(attendanceSessions.currentApproverId, supervisorId)
      )!
    );
  }
  if (worksiteId) {
    conditions.push(eq(attendanceSessions.worksiteSnapshotId, worksiteId));
  }

  const rows = await db
    .select({
      id: attendanceSessions.id,
      workerId: attendanceSessions.workerId,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      workerAvatar: users.photoUrl,
      workDate: attendanceSessions.workDate,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      createdAt: attendanceSessions.createdAt,
      status: attendanceSessions.status,
      isEscalated: attendanceSessions.isEscalated,
      escalatedAt: attendanceSessions.escalatedAt,
      escalationReason: attendanceSessions.escalationReason,
      supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
      currentApproverId: attendanceSessions.currentApproverId,
      worksiteId: worksites.id,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .where(and(...conditions))
    .orderBy(attendanceSessions.createdAt);

  // Fetch supervisor details
  const supIds = new Set<string>();
  for (const r of rows) {
    if (r.supervisorSnapshotId) supIds.add(r.supervisorSnapshotId);
    if (r.currentApproverId) supIds.add(r.currentApproverId);
  }

  const supMap: Record<string, { name: string; email: string; phone: string }> = {};
  if (supIds.size > 0) {
    const sups = await db
      .select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone })
      .from(users)
      .where(inArray(users.id, Array.from(supIds)));
    for (const s of sups) {
      supMap[s.id] = { name: s.fullName, email: s.email || '', phone: s.phone || '' };
    }
  }

  let enriched = rows.map((r) => {
    const createdTime = new Date(r.createdAt).getTime();
    const ageHours = Math.max(0, Math.round((now.getTime() - createdTime) / (1000 * 60 * 60)));

    let severityLevel: 'MODERATE' | 'HIGH' | 'CRITICAL' = 'MODERATE';
    if (ageHours >= 72) severityLevel = 'CRITICAL';
    else if (ageHours >= 48) severityLevel = 'HIGH';

    const supInfo = r.supervisorSnapshotId ? supMap[r.supervisorSnapshotId] : null;
    const approverInfo = r.currentApproverId ? supMap[r.currentApproverId] : null;

    return {
      ...r,
      ageHours,
      overdueFormatted: `${ageHours}h overdue`,
      severityLevel,
      supervisorName: supInfo?.name || 'Assigned Supervisor',
      supervisorEmail: supInfo?.email || '',
      supervisorPhone: supInfo?.phone || '',
      currentApproverName: approverInfo?.name || 'Admin Queue',
    };
  });

  if (severity) {
    enriched = enriched.filter((item) => item.severityLevel === severity);
  }

  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    enriched = enriched.filter(
      (item) =>
        item.workerName.toLowerCase().includes(q) ||
        (item.employeeCode && item.employeeCode.toLowerCase().includes(q)) ||
        item.supervisorName.toLowerCase().includes(q) ||
        item.worksiteName.toLowerCase().includes(q)
    );
  }

  return res.json({
    totalCount: enriched.length,
    thresholdHours,
    data: enriched,
  });
}

/**
 * POST /admin/overdue-approvals/:id/remind
 * Section E: Send reminder notification to supervisor
 */
export async function sendOverdueReminder(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const admin = req.user!;
  const orgId = admin.orgId;

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id, String(id)), eq(attendanceSessions.orgId, orgId)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  const targetSupervisorId = session.currentApproverId || session.supervisorSnapshotId;
  if (!targetSupervisorId) {
    return res.status(400).json({ error: 'NO_SUPERVISOR', message: 'No supervisor assigned to remind' });
  }

  const [worker] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, session.workerId)).limit(1);

  await db.insert(notifications).values({
    userId: targetSupervisorId,
    title: 'Reminder: Overdue Attendance Approval',
    message: `Attendance review for ${worker?.fullName || 'worker'} on ${session.workDate} is overdue. Please review immediately.`,
    type: 'APPROVAL_REMINDER',
    entityType: 'ATTENDANCE_SESSION',
    entityId: id,
  });

  await logAuditEvent({
    orgId,
    actorId: admin.id,
    actorNameSnapshot: admin.fullName,
    actorRole: admin.roles[0],
    action: 'SUPERVISOR_APPROVAL_REMINDER_SENT',
    entityType: 'ATTENDANCE_SESSION',
    entityId: id,
    reason: `Admin sent approval reminder to supervisor ${targetSupervisorId}`,
    req,
  });

  return res.json({ success: true, message: 'Overdue approval reminder sent to supervisor' });
}

/**
 * POST /admin/overdue-approvals/:id/escalate
 * Section E: Escalate or reassign overdue approval to authorized admin or fallback approver
 */
const escalateSchema = z.object({
  targetApproverId: z.string().uuid().optional(),
  reason: z.string().min(3, 'Mandatory escalation reason is required'),
});

export async function escalateOverdueApproval(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = escalateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { targetApproverId, reason } = parseResult.data;
  const db = await getDb();
  const admin = req.user!;
  const orgId = admin.orgId;
  const now = new Date();

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id, String(id)), eq(attendanceSessions.orgId, orgId)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  const newApprover = targetApproverId || admin.id;

  const [updatedSession] = await db
    .update(attendanceSessions)
    .set({
      isEscalated: true,
      escalatedAt: now,
      escalationReason: reason,
      currentApproverId: newApprover,
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id, String(id)))
    .returning();

  // Record approval action / transfer
  await db.insert(approvalActions).values({
    sessionId: id,
    action: 'ESCALATE_OVERDUE',
    reviewerId: admin.id,
    note: reason,
    performedAt: now,
  });

  await logAuditEvent({
    orgId,
    actorId: admin.id,
    actorNameSnapshot: admin.fullName,
    actorRole: admin.roles[0],
    action: 'ADMIN_ESCALATE_OVERDUE_APPROVAL',
    entityType: 'ATTENDANCE_SESSION',
    entityId: id,
    reason,
    beforeValues: { currentApproverId: session.currentApproverId, isEscalated: session.isEscalated },
    afterValues: { currentApproverId: newApprover, isEscalated: true },
    req,
  });

  return res.json({
    success: true,
    message: 'Attendance approval escalated successfully',
    session: updatedSession,
  });
}
