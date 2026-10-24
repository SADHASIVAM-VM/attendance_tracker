import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  attendanceAdjustmentRequests,
  attendanceSessions,
  users,
  worksites,
  notifications,
  siteAssignments,
  siteAssignmentWorkers,
  payrollAdjustments,
  attendanceExceptions,
} from '../database/schema.js';
import { eq, and, desc, sql, or, ne } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
import { isSupervisorAuthorizedForSession } from './attendanceController.js';
import { calculateSessionOvertime } from '../services/overtimeService.js';

const requestSchema = z.object({
  correctionType: z.enum([
    'MISSING_CLOCK_IN',
    'MISSING_CLOCK_OUT',
    'INCORRECT_CLOCK_IN',
    'INCORRECT_CLOCK_OUT',
    'INCORRECT_SITE',
    'INCORRECT_HOURS',
    'OTHER',
  ]).default('INCORRECT_HOURS'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  proposedClockInTime: z.string().datetime().optional(),
  proposedClockOutTime: z.string().datetime().optional(),
  supportingEvidenceUrl: z.string().url().optional(),
});

const decisionSchema = z.object({
  reason: z.string().min(3, 'Decision reason is mandatory').optional(),
  reviewNote: z.string().min(3, 'Review note is mandatory').optional(),
}).refine((data) => data.reason !== undefined || data.reviewNote !== undefined, {
  message: 'Mandatory decision reason/reviewNote is required',
});

/**
 * POST /attendance/:id/regularization
 * Worker submits a correction request
 */
export async function requestRegularization(req: Request, res: Response): Promise<any> {
  const { id } = req.params; // attendance session ID
  const parseResult = requestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const {
    correctionType,
    reason,
    proposedClockInTime,
    proposedClockOutTime,
    supportingEvidenceUrl,
  } = parseResult.data;

  const db = await getDb();
  const userId = req.user!.id;
  const orgId = req.user!.orgId;

  let session: any = null;

  if (typeof id === 'string' && id.startsWith('exception_')) {
    const exId = id.replace('exception_', '');
    const [ex] = await db
      .select()
      .from(attendanceExceptions)
      .where(and(eq(attendanceExceptions.id as any, exId as any), eq(attendanceExceptions.orgId as any, orgId as any)))
      .limit(1);

    if (ex) {
      if (ex.sessionId) {
        const [existing] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id as any, ex.sessionId as any)).limit(1);
        session = existing;
      }
      if (!session) {
        const [created] = await db
          .insert(attendanceSessions)
          .values({
            orgId,
            workerId: ex.workerId,
            assignmentId: ex.assignmentId,
            worksiteSnapshotId: ex.worksiteId,
            supervisorSnapshotId: ex.primarySupervisorId || userId,
            currentApproverId: ex.currentApproverId || ex.primarySupervisorId || userId,
            workDate: ex.workDate,
            status: 'PENDING',
            exceptionStatus: 'REGULARIZATION_PENDING',
            clockInTime: proposedClockInTime ? new Date(proposedClockInTime) : null,
            clockOutTime: proposedClockOutTime ? new Date(proposedClockOutTime) : null,
            standardHoursMinutes: 540,
            breakDurationMinutes: 0,
            calculatedOtMinutes: 0,
            approvedOtMinutes: 0,
            otStatus: 'NONE',
            isLocationBypassed: true,
          })
          .returning();
        session = created;
        await db.update(attendanceExceptions).set({ sessionId: created.id, status: 'INVESTIGATING' }).where(eq(attendanceExceptions.id as any, ex.id as any));
      }
    }
  } else if (typeof id === 'string' && id.startsWith('scheduled_absent_')) {
    const targetDate = id.replace('scheduled_absent_', '');
    const [asg] = await db
      .select({
        assignmentId: siteAssignments.id,
        worksiteId: siteAssignments.worksiteId,
        supervisorId: siteAssignments.supervisorId,
      })
      .from(siteAssignmentWorkers)
      .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
      .where(
        and(
          eq(siteAssignmentWorkers.workerId, userId),
          sql`${siteAssignments.workDate} = ${targetDate}::date`,
          ne(siteAssignments.status, 'CANCELLED')
        )
      )
      .limit(1);

    const [created] = await db
      .insert(attendanceSessions)
      .values({
        orgId,
        workerId: userId,
        assignmentId: asg?.assignmentId || null,
        worksiteSnapshotId: asg?.worksiteId || null,
        supervisorSnapshotId: asg?.supervisorId || userId,
        currentApproverId: asg?.supervisorId || userId,
        workDate: targetDate,
        status: 'PENDING',
        exceptionStatus: 'REGULARIZATION_PENDING',
        clockInTime: proposedClockInTime ? new Date(proposedClockInTime) : null,
        clockOutTime: proposedClockOutTime ? new Date(proposedClockOutTime) : null,
        standardHoursMinutes: 540,
        breakDurationMinutes: 0,
        calculatedOtMinutes: 0,
        approvedOtMinutes: 0,
        otStatus: 'NONE',
        isLocationBypassed: true,
      })
      .returning();
    session = created;
  } else {
    const [found] = await db
      .select()
      .from(attendanceSessions)
      .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, orgId as any)))
      .limit(1);
    session = found;
  }

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance record not found' });
  }

  // Requester must be the worker or authorized supervisor
  if (session.workerId !== userId && session.supervisorSnapshotId !== userId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to request correction for this session' });
  }

  // Prevent duplicate pending regularization for the same session
  const [existingPending] = await db
    .select({ id: attendanceAdjustmentRequests.id })
    .from(attendanceAdjustmentRequests)
    .where(
      and(
        eq(attendanceAdjustmentRequests.sessionId as any, session.id as any),
        eq(attendanceAdjustmentRequests.status as any, 'PENDING' as any)
      )
    )
    .limit(1);

  if (existingPending) {
    return res.status(409).json({
      error: 'CORRECTION_ALREADY_PENDING',
      message: 'A correction request for this attendance session is already pending review',
    });
  }

  // Resolve assigned supervisor based on effective site/worker assignment for the session's workDate and site
  let effectiveSupervisorId = session.currentApproverId || session.supervisorSnapshotId;

  if (session.assignmentId) {
    const [assignment] = await db
      .select({
        supervisorId: siteAssignments.supervisorId,
        fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
      })
      .from(siteAssignments)
      .where(eq(siteAssignments.id, session.assignmentId))
      .limit(1);

    if (assignment?.supervisorId) {
      effectiveSupervisorId = assignment.supervisorId;
    }
  } else if (session.workerId && session.workDate) {
    const [assignmentRow] = await db
      .select({ supervisorId: siteAssignments.supervisorId })
      .from(siteAssignmentWorkers)
      .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
      .where(
        and(
          eq(siteAssignmentWorkers.workerId, session.workerId),
          sql`${siteAssignments.workDate} = ${session.workDate}::date`,
          ne(siteAssignments.status, 'CANCELLED')
        )
      )
      .orderBy(desc(siteAssignments.createdAt))
      .limit(1);

    if (assignmentRow?.supervisorId) {
      effectiveSupervisorId = assignmentRow.supervisorId;
    }
  }

  const [adjustment] = await db
    .insert(attendanceAdjustmentRequests)
    .values({
      sessionId: session.id,
      requestingUserId: userId,
      correctionType,
      workDate: session.workDate,
      reason,
      proposedClockInTime: proposedClockInTime ? new Date(proposedClockInTime) : null,
      proposedClockOutTime: proposedClockOutTime ? new Date(proposedClockOutTime) : null,
      supportingEvidenceUrl: supportingEvidenceUrl || null,
      currentApproverId: effectiveSupervisorId,
      status: 'PENDING',
    })
    .returning();

  // Notify assigned supervisor
  await db.insert(notifications).values({
    userId: effectiveSupervisorId,
    title: 'Attendance Regularization Request',
    message: `${req.user!.fullName} requested ${correctionType.replace(/_/g, ' ')} for ${session.workDate}.`,
    type: 'REGULARIZATION_PENDING',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: adjustment.id,
  });

  await logAuditEvent({
    orgId,
    actorId: userId,
    actorNameSnapshot: req.user!.fullName,
    actorRole: req.user!.roles[0],
    action: 'REQUEST_ATTENDANCE_REGULARIZATION',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: adjustment.id,
    reason,
    afterValues: {
      correctionType,
      proposedClockInTime,
      proposedClockOutTime,
      supportingEvidenceUrl,
    },
    req,
  });

  return res.status(201).json(adjustment);
}

/**
 * GET /regularization/pending
 */
export async function getPendingRegularizations(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const pending = await db
    .select({
      id: attendanceAdjustmentRequests.id,
      sessionId: attendanceAdjustmentRequests.sessionId,
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
      currentApproverId: attendanceAdjustmentRequests.currentApproverId,
      createdAt: attendanceAdjustmentRequests.createdAt,
      workerId: users.id,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      originalClockInTime: attendanceSessions.clockInTime,
      originalClockOutTime: attendanceSessions.clockOutTime,
      supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
      worksiteName: worksites.name,
    })
    .from(attendanceAdjustmentRequests)
    .innerJoin(attendanceSessions, eq(attendanceAdjustmentRequests.sessionId, attendanceSessions.id))
    .innerJoin(users, eq(attendanceAdjustmentRequests.requestingUserId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .where(
      and(
        eq(attendanceSessions.orgId as any, user.orgId as any),
        eq(attendanceAdjustmentRequests.status, 'PENDING')
      )
    )
    .orderBy(desc(attendanceAdjustmentRequests.createdAt));

  const filtered = isSuperOrAdmin
    ? pending
    : pending.filter(
        (p: any) =>
          p.supervisorSnapshotId === user.id ||
          p.currentApproverId === user.id
      );

  return res.json(filtered);
}

/**
 * POST /regularization/:id/approve
 * Approves correction, safely applies new clockIn/clockOut to attendanceSessions,
 * updates net working duration, and logs audit record.
 */
export async function approveRegularization(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = decisionSchema.safeParse(req.body);
  const decisionReason = parseResult.success
    ? parseResult.data.reason || parseResult.data.reviewNote
    : (req.body as any)?.reviewNote || (req.body as any)?.reason || 'Approved by approver';

  const db = await getDb();
  const reviewer = req.user!;

  const [adjustment] = await db
    .select()
    .from(attendanceAdjustmentRequests)
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .limit(1);

  if (!adjustment) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Regularization request not found' });
  }

  if (adjustment.status !== 'PENDING') {
    return res.status(400).json({
      error: 'ALREADY_DECIDED',
      message: `Regularization request has already been ${adjustment.status.toLowerCase()}`,
    });
  }

  // Rule: Workers & supervisors CANNOT approve their own correction requests
  if (adjustment.requestingUserId === reviewer.id) {
    return res.status(403).json({
      error: 'CANNOT_APPROVE_OWN_CORRECTION',
      message: 'You cannot approve your own attendance correction request',
    });
  }

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.id as any, adjustment.sessionId as any))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Associated attendance session not found' });
  }

  const isAuthorized = await isSupervisorAuthorizedForSession(db, session, reviewer);
  if (!isAuthorized && adjustment.currentApproverId !== reviewer.id) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_APPROVER',
      message: 'You are not authorized to approve this regularization request',
    });
  }

  const now = new Date();

  // 1. Mark adjustment as APPROVED
  await db
    .update(attendanceAdjustmentRequests)
    .set({
      status: 'APPROVED',
      reviewerId: reviewer.id,
      reviewNote: decisionReason,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceAdjustmentRequests.id as any, id as any));

  // 2. Calculate updated session timestamps and net working duration
  const newClockIn = adjustment.proposedClockInTime || session.clockInTime;
  const newClockOut = adjustment.proposedClockOutTime || session.clockOutTime;

  let totalDurationSeconds = 0;
  let netWorkingSeconds = 0;
  if (newClockIn && newClockOut) {
    totalDurationSeconds = Math.max(0, Math.round((new Date(newClockOut).getTime() - new Date(newClockIn).getTime()) / 1000));
    netWorkingSeconds = totalDurationSeconds;
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

  // If session is locked in finalized payroll, create adjustment rather than silently rewriting payroll history
  if (session.isPayrollLocked && session.payrollPeriodId) {
    const diffMinutes = otCalc.calculatedOtMinutes - (session.calculatedOtMinutes || 0);
    if (diffMinutes !== 0) {
      await db.insert(payrollAdjustments).values({
        payrollPeriodId: session.payrollPeriodId,
        workerId: session.workerId,
        adjustmentType: 'OVERTIME',
        amountOrMinutes: diffMinutes,
        reason: `Post-payroll regularization approved: ${adjustment.reason || 'Correction applied'}`,
        adjustedBy: reviewer.id,
      });
    }
  }

  const sessionUpdates: any = {
    status: 'APPROVED',
    updatedAt: now,
    exceptionStatus: 'CORRECTION_APPLIED',
  };
  if (adjustment.proposedClockInTime) sessionUpdates.clockInTime = adjustment.proposedClockInTime;
  if (adjustment.proposedClockOutTime) sessionUpdates.clockOutTime = adjustment.proposedClockOutTime;
  if (totalDurationSeconds > 0) {
    sessionUpdates.totalDurationSeconds = totalDurationSeconds;
    sessionUpdates.netWorkingSeconds = otCalc.netWorkingMinutes * 60;
  }
  // If not locked in payroll, update calculated OT and preserve/re-evaluate OT status
  if (!session.isPayrollLocked) {
    sessionUpdates.calculatedOtMinutes = otCalc.calculatedOtMinutes;
    sessionUpdates.otStatus = otCalc.otStatus;
  }

  await db
    .update(attendanceSessions)
    .set(sessionUpdates)
    .where(eq(attendanceSessions.id as any, adjustment.sessionId as any));

  // Resolve any open missing clock-in or absence exception for this worker and date
  await db
    .update(attendanceExceptions)
    .set({
      status: 'RESOLVED',
      resolutionType: 'CORRECTION_APPLIED',
      resolutionNote: `Resolved via approved attendance regularisation: ${decisionReason}`,
      resolvedBy: reviewer.id,
      resolvedAt: now,
      sessionId: session.id,
      updatedAt: now,
    })
    .where(
      and(
        eq(attendanceExceptions.workerId, session.workerId),
        sql`${attendanceExceptions.workDate} = ${session.workDate}::date`,
        ne(attendanceExceptions.status, 'RESOLVED')
      )
    );

  // 3. Notify requester
  await db.insert(notifications).values({
    userId: adjustment.requestingUserId,
    title: 'Regularization Approved',
    message: `Your attendance regularization for ${session.workDate} was approved. Official timestamps updated.`,
    type: 'REGULARIZATION_APPROVED',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: adjustment.id,
  });

  // 4. Record audit event
  await logAuditEvent({
    orgId: reviewer.orgId,
    actorId: reviewer.id,
    actorNameSnapshot: reviewer.fullName,
    actorRole: reviewer.roles[0],
    action: 'APPROVE_ATTENDANCE_REGULARIZATION',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: id,
    reason: decisionReason,
    beforeValues: {
      clockInTime: session.clockInTime,
      clockOutTime: session.clockOutTime,
      status: session.status,
    },
    afterValues: {
      clockInTime: sessionUpdates.clockInTime,
      clockOutTime: sessionUpdates.clockOutTime,
      status: 'APPROVED',
      note: decisionReason,
    },
    req,
  });

  return res.json({ success: true, message: 'Regularization approved and attendance updated' });
}

/**
 * POST /regularization/:id/reject
 * Rejects correction request with mandatory reason, preserving original records.
 */
export async function rejectRegularization(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = decisionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'REJECTION_REASON_REQUIRED',
      message: 'A mandatory reason is required to reject a regularization request',
    });
  }

  const decisionReason = parseResult.data.reason || parseResult.data.reviewNote!;
  const db = await getDb();
  const reviewer = req.user!;

  const [adjustment] = await db
    .select()
    .from(attendanceAdjustmentRequests)
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .limit(1);

  if (!adjustment) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Regularization request not found' });
  }

  if (adjustment.status !== 'PENDING') {
    return res.status(400).json({
      error: 'ALREADY_DECIDED',
      message: `Regularization request has already been ${adjustment.status.toLowerCase()}`,
    });
  }

  // Rule: Workers & supervisors CANNOT reject their own correction requests
  if (adjustment.requestingUserId === reviewer.id) {
    return res.status(403).json({
      error: 'CANNOT_REJECT_OWN_CORRECTION',
      message: 'You cannot reject your own attendance correction request',
    });
  }

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.id as any, adjustment.sessionId as any))
    .limit(1);

  if (session) {
    const isAuthorized = await isSupervisorAuthorizedForSession(db, session, reviewer);
    if (!isAuthorized && adjustment.currentApproverId !== reviewer.id) {
      return res.status(403).json({
        error: 'UNAUTHORIZED_APPROVER',
        message: 'You are not authorized to reject this regularization request',
      });
    }
  }

  const now = new Date();
  await db
    .update(attendanceAdjustmentRequests)
    .set({
      status: 'REJECTED',
      reviewerId: reviewer.id,
      reviewNote: decisionReason,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceAdjustmentRequests.id as any, id as any));

  // Notify requester
  await db.insert(notifications).values({
    userId: adjustment.requestingUserId,
    title: 'Regularization Rejected',
    message: `Your attendance regularization request was rejected. Reason: ${decisionReason}`,
    type: 'REGULARIZATION_REJECTED',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: adjustment.id,
  });

  await logAuditEvent({
    orgId: reviewer.orgId,
    actorId: reviewer.id,
    actorNameSnapshot: reviewer.fullName,
    actorRole: reviewer.roles[0],
    action: 'REJECT_ATTENDANCE_REGULARIZATION',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: id,
    reason: decisionReason,
    afterValues: { status: 'REJECTED', reviewNote: decisionReason },
    req,
  });

  return res.json({ success: true, message: 'Regularization request rejected' });
}

/**
 * POST /regularization/:id/cancel
 * Worker withdraws/cancels their own pending regularization request
 */
export async function cancelRegularization(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const userId = req.user!.id;

  const [adjustment] = await db
    .select()
    .from(attendanceAdjustmentRequests)
    .where(
      and(
        eq(attendanceAdjustmentRequests.id as any, id as any),
        eq(attendanceAdjustmentRequests.requestingUserId as any, userId as any)
      )
    )
    .limit(1);

  if (!adjustment) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Regularization request not found' });
  }

  if (adjustment.status !== 'PENDING') {
    return res.status(400).json({ error: 'CANNOT_CANCEL', message: 'Only pending regularization requests can be cancelled' });
  }

  const [updated] = await db
    .update(attendanceAdjustmentRequests)
    .set({
      status: 'CANCELLED',
      updatedAt: new Date(),
    })
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .returning();

  return res.json({ success: true, message: 'Regularization request cancelled', request: updated });
}
