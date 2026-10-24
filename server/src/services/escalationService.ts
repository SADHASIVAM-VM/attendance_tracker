import { getDb } from '../database/db.js';
import {
  siteAssignments,
  siteAssignmentWorkers,
  attendanceSessions,
  attendanceExceptions,
  leaveRequests,
  attendanceAdjustmentRequests,
  users,
  worksites,
  notifications,
} from '../database/schema.js';
import { eq, and, or, sql, inArray, isNull } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';

/**
 * PHASE 2: Conflict Detection & Fallback Escalation Engine
 */

export interface EscalationSummary {
  missingClockInsCreated: number;
  missingClockOutsCreated: number;
  overdueAttendanceEscalated: number;
  overdueLeavesEscalated: number;
  overdueCorrectionsEscalated: number;
  errors: string[];
}

/**
 * 1. Check for Missing Clock-Ins
 * Respects grace period (default 15 mins).
 * Checks worker's shift, approved leave, and existing punches.
 * Idempotently creates MISSING_CLOCK_IN exceptions.
 */
export async function runMissingAttendanceCheck(orgId?: string): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let createdCount = 0;

  try {
    // 1. Fetch published assignments for today
    const assignmentQuery = db
      .select({
        id: siteAssignments.id,
        orgId: siteAssignments.orgId,
        worksiteId: siteAssignments.worksiteId,
        supervisorId: siteAssignments.supervisorId,
        fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
        workDate: siteAssignments.workDate,
        shiftName: siteAssignments.shiftName,
        shiftStartTime: siteAssignments.shiftStartTime,
        shiftEndTime: siteAssignments.shiftEndTime,
      })
      .from(siteAssignments)
      .where(
        and(
          eq(siteAssignments.status, 'PUBLISHED'),
          or(
            eq(siteAssignments.workDate, todayStr),
            and(
              eq(siteAssignments.carryForward, true),
              sql`${siteAssignments.workDate} <= ${todayStr}`
            )
          ),
          orgId ? eq(siteAssignments.orgId, orgId) : sql`1=1`
        )
      );

    const assignments = await assignmentQuery;
    if (!assignments || assignments.length === 0) return 0;

    for (const assignment of assignments) {
      // Calculate grace expiration for assignment shift start
      const [startHourStr = '8', startMinStr = '0'] = (assignment.shiftStartTime || '08:00').split(':');
      const shiftStartDate = new Date(`${todayStr}T00:00:00`);
      shiftStartDate.setHours(parseInt(startHourStr, 10), parseInt(startMinStr, 10), 0, 0);

      const graceMinutes = 15;
      const graceExpiresAt = new Date(shiftStartDate.getTime() + graceMinutes * 60 * 1000);

      // Rule: Before grace period, do NOT create missing attendance exception
      if (now.getTime() < graceExpiresAt.getTime()) {
        continue;
      }

      // Fetch workers assigned to this assignment
      const assignedWorkers = await db
        .select({ workerId: siteAssignmentWorkers.workerId })
        .from(siteAssignmentWorkers)
        .where(eq(siteAssignmentWorkers.assignmentId, assignment.id));

      for (const { workerId } of assignedWorkers) {
        // Check if worker already clocked in for this work date
        const existingSession = await db
          .select({ id: attendanceSessions.id })
          .from(attendanceSessions)
          .where(
            and(
              eq(attendanceSessions.workerId, workerId),
              sql`DATE(${attendanceSessions.workDate}) = ${todayStr}`
            )
          )
          .limit(1);

        if (existingSession.length > 0) continue; // Already clocked in

        // Check if worker has an approved leave request covering today
        const approvedLeave = await db
          .select({ id: leaveRequests.id })
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.userId, workerId),
              eq(leaveRequests.status, 'APPROVED'),
              sql`${leaveRequests.startDate} <= ${todayStr} AND ${leaveRequests.endDate} >= ${todayStr}`
            )
          )
          .limit(1);

        if (approvedLeave.length > 0) continue; // On approved leave

        // Idempotency check: see if an exception already exists for this worker & workDate
        const existingException = await db
          .select({ id: attendanceExceptions.id })
          .from(attendanceExceptions)
          .where(
            and(
              eq(attendanceExceptions.workerId, workerId),
              eq(attendanceExceptions.workDate, todayStr),
              eq(attendanceExceptions.exceptionType, 'MISSING_CLOCK_IN')
            )
          )
          .limit(1);

        if (existingException.length > 0) continue; // Already flagged

        // Create the MISSING_CLOCK_IN exception
        const [insertedEx] = await db
          .insert(attendanceExceptions)
          .values({
            orgId: assignment.orgId,
            workerId,
            worksiteId: assignment.worksiteId,
            assignmentId: assignment.id,
            workDate: todayStr,
            exceptionType: 'MISSING_CLOCK_IN',
            severity: 'MEDIUM',
            status: 'OPEN',
            primarySupervisorId: assignment.supervisorId,
            currentApproverId: assignment.supervisorId,
          })
          .returning();

        createdCount++;

        // Notify supervisor
        await db.insert(notifications).values({
          userId: assignment.supervisorId,
          title: 'Missing Clock-In Detected',
          message: `Worker did not clock in within the grace period for shift ${assignment.shiftName} on ${todayStr}.`,
          type: 'EXCEPTION_DETECTED',
          entityType: 'ATTENDANCE_EXCEPTION',
          entityId: insertedEx.id,
        });

        // Audit log with SYSTEM actor
        await logAuditEvent({
          orgId: assignment.orgId,
          actorNameSnapshot: 'Automated Escalation Service',
          actorRole: 'SYSTEM',
          action: 'DETECT_MISSING_CLOCK_IN',
          entityType: 'ATTENDANCE_EXCEPTION',
          entityId: insertedEx.id,
          afterValues: {
            workerId,
            assignmentId: assignment.id,
            workDate: todayStr,
            graceExpiresAt,
          },
        });
      }
    }
  } catch (err) {
    console.error('Error running missing attendance check:', err);
  }

  return createdCount;
}

/**
 * 2. Check for Missing Clock-Outs
 * Workers who clocked in, but shift ended + grace period passed without clock-out.
 * Marks session incomplete and creates MISSING_CLOCK_OUT exception.
 * Does NOT fabricate clock-out timestamp.
 */
export async function runMissingClockOutCheck(orgId?: string): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let createdCount = 0;

  try {
    // Find sessions that have clockInTime, but NO clockOutTime
    const uncompletedSessions = await db
      .select({
        id: attendanceSessions.id,
        orgId: attendanceSessions.orgId,
        workerId: attendanceSessions.workerId,
        assignmentId: attendanceSessions.assignmentId,
        worksiteSnapshotId: attendanceSessions.worksiteSnapshotId,
        supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
        workDate: attendanceSessions.workDate,
        clockInTime: attendanceSessions.clockInTime,
        status: attendanceSessions.status,
        exceptionStatus: attendanceSessions.exceptionStatus,
        shiftStartTime: siteAssignments.shiftStartTime,
        shiftEndTime: siteAssignments.shiftEndTime,
        shiftName: siteAssignments.shiftName,
        fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
      })
      .from(attendanceSessions)
      .innerJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
      .where(
        and(
          isNull(attendanceSessions.clockOutTime),
          sql`${attendanceSessions.clockInTime} IS NOT NULL`,
          orgId ? eq(attendanceSessions.orgId, orgId) : sql`1=1`
        )
      );

    for (const session of uncompletedSessions) {
      const sessionDateStr = String(session.workDate).split('T')[0];
      const [endHourStr = '17', endMinStr = '0'] = (session.shiftEndTime || '17:00').split(':');

      const shiftEndDate = new Date(`${sessionDateStr}T00:00:00`);
      shiftEndDate.setHours(parseInt(endHourStr, 10), parseInt(endMinStr, 10), 0, 0);

      const graceMinutes = 15;
      const graceExpiresAt = new Date(shiftEndDate.getTime() + graceMinutes * 60 * 1000);

      // Check if past shift end + grace period
      const isPastShiftEnd = now.getTime() > graceExpiresAt.getTime() || sessionDateStr < todayStr;
      if (!isPastShiftEnd) continue;

      // Idempotency: verify exception not already created
      const existingEx = await db
        .select({ id: attendanceExceptions.id })
        .from(attendanceExceptions)
        .where(
          and(
            eq(attendanceExceptions.sessionId, session.id),
            eq(attendanceExceptions.exceptionType, 'MISSING_CLOCK_OUT')
          )
        )
        .limit(1);

      if (existingEx.length > 0) continue;

      // Update session exceptionStatus
      await db
        .update(attendanceSessions)
        .set({
          exceptionStatus: 'MISSING_CLOCK_OUT',
          updatedAt: now,
        })
        .where(eq(attendanceSessions.id, session.id));

      // Create MISSING_CLOCK_OUT exception
      const [insertedEx] = await db
        .insert(attendanceExceptions)
        .values({
          orgId: session.orgId,
          workerId: session.workerId,
          worksiteId: session.worksiteSnapshotId,
          assignmentId: session.assignmentId,
          sessionId: session.id,
          workDate: sessionDateStr,
          exceptionType: 'MISSING_CLOCK_OUT',
          severity: 'HIGH',
          status: 'OPEN',
          primarySupervisorId: session.supervisorSnapshotId,
          currentApproverId: session.supervisorSnapshotId,
        })
        .returning();

      createdCount++;

      // Notify supervisor
      await db.insert(notifications).values({
        userId: session.supervisorSnapshotId,
        title: 'Missing Clock-Out Detected',
        message: `Worker has not clocked out for shift ${session.shiftName} on ${sessionDateStr}. Marked as incomplete.`,
        type: 'EXCEPTION_DETECTED',
        entityType: 'ATTENDANCE_EXCEPTION',
        entityId: insertedEx.id,
      });

      // Write audit log
      await logAuditEvent({
        orgId: session.orgId,
        actorNameSnapshot: 'Automated Escalation Service',
        actorRole: 'SYSTEM',
        action: 'DETECT_MISSING_CLOCK_OUT',
        entityType: 'ATTENDANCE_EXCEPTION',
        entityId: insertedEx.id,
        beforeValues: { clockOutTime: null, exceptionStatus: session.exceptionStatus },
        afterValues: { exceptionStatus: 'MISSING_CLOCK_OUT', incomplete: true },
      });
    }
  } catch (err) {
    console.error('Error running missing clock-out check:', err);
  }

  return createdCount;
}

/**
 * 3. Overdue Request Escalation
 * Evaluates pending attendance, leave, correction requests, and exceptions.
 * If request age exceeds escalation deadline (hours):
 *  - Reassigns to fallbackSupervisorId (if configured).
 *  - Or escalates to Admin queue (if no fallback).
 *  - Idempotent: avoids duplicate escalations.
 */
export async function runOverdueEscalationCheck(orgId?: string, overrideDeadlineHours?: number): Promise<{
  attendanceEscalated: number;
  leavesEscalated: number;
  correctionsEscalated: number;
  exceptionsEscalated: number;
}> {
  const db = await getDb();
  const now = new Date();
  let attendanceEscalated = 0;
  let leavesEscalated = 0;
  let correctionsEscalated = 0;
  let exceptionsEscalated = 0;

  try {
    // A. Pending Attendance Sessions
    const pendingSessions = await db
      .select({
        id: attendanceSessions.id,
        orgId: attendanceSessions.orgId,
        workerId: attendanceSessions.workerId,
        supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
        currentApproverId: attendanceSessions.currentApproverId,
        workDate: attendanceSessions.workDate,
        createdAt: attendanceSessions.createdAt,
        isEscalated: attendanceSessions.isEscalated,
        fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
        deadlineHours: siteAssignments.escalationDeadlineHours,
      })
      .from(attendanceSessions)
      .innerJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
      .where(
        and(
          eq(attendanceSessions.status, 'PENDING'),
          eq(attendanceSessions.isEscalated, false),
          orgId ? eq(attendanceSessions.orgId, orgId) : sql`1=1`
        )
      );

    for (const session of pendingSessions) {
      const deadline = overrideDeadlineHours ?? (session.deadlineHours || 24);
      const ageHours = (now.getTime() - new Date(session.createdAt).getTime()) / (1000 * 60 * 60);

      if (ageHours >= deadline) {
        const hasFallback = !!session.fallbackSupervisorId && session.fallbackSupervisorId !== session.supervisorSnapshotId;
        const newApproverId = hasFallback ? session.fallbackSupervisorId : null;
        const reason = hasFallback
          ? `Overdue (${Math.round(ageHours)}h >= ${deadline}h deadline): Escalated to Fallback Supervisor`
          : `Overdue (${Math.round(ageHours)}h >= ${deadline}h deadline): No fallback configured, escalated to Admin`;

        await db
          .update(attendanceSessions)
          .set({
            isEscalated: true,
            escalatedAt: now,
            escalationReason: reason,
            currentApproverId: newApproverId,
            updatedAt: now,
          })
          .where(eq(attendanceSessions.id, session.id));

        // Create or update OVERDUE_APPROVAL exception
        await db.insert(attendanceExceptions).values({
          orgId: session.orgId,
          workerId: session.workerId,
          sessionId: session.id,
          workDate: String(session.workDate).split('T')[0],
          exceptionType: 'OVERDUE_APPROVAL',
          severity: 'HIGH',
          status: 'ESCALATED',
          primarySupervisorId: session.supervisorSnapshotId,
          currentApproverId: newApproverId,
          isEscalated: true,
          escalatedAt: now,
          escalationReason: reason,
        });

        attendanceEscalated++;

        // Notify new approver if fallback exists
        if (newApproverId) {
          await db.insert(notifications).values({
            userId: newApproverId,
            title: 'Attendance Request Escalated to You',
            message: `A worker attendance record for ${session.workDate} was escalated to you due to supervisor inactivity.`,
            type: 'REQUEST_ESCALATED',
            entityType: 'ATTENDANCE_SESSION',
            entityId: session.id,
          });
        }

        await logAuditEvent({
          orgId: session.orgId,
          actorNameSnapshot: 'Automated Escalation Service',
          actorRole: 'SYSTEM',
          action: 'ESCALATE_ATTENDANCE_OVERDUE',
          entityType: 'ATTENDANCE_SESSION',
          entityId: session.id,
          reason,
          beforeValues: { isEscalated: false, currentApproverId: session.currentApproverId || session.supervisorSnapshotId },
          afterValues: { isEscalated: true, currentApproverId: newApproverId, escalationReason: reason },
        });
      }
    }

    // B. Pending Leave Requests
    const pendingLeaves = await db
      .select({
        id: leaveRequests.id,
        orgId: leaveRequests.orgId,
        userId: leaveRequests.userId,
        currentApproverId: leaveRequests.currentApproverId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        createdAt: leaveRequests.createdAt,
        isEscalated: leaveRequests.isEscalated,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.status, 'PENDING'),
          eq(leaveRequests.isEscalated, false),
          orgId ? eq(leaveRequests.orgId, orgId) : sql`1=1`
        )
      );

    for (const leave of pendingLeaves) {
      const deadline = overrideDeadlineHours ?? 24;
      const ageHours = (now.getTime() - new Date(leave.createdAt).getTime()) / (1000 * 60 * 60);

      if (ageHours >= deadline) {
        // Resolve worker's latest site assignment fallback supervisor
        const [workerAssignment] = await db
          .select({
            fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
            supervisorId: siteAssignments.supervisorId,
          })
          .from(siteAssignmentWorkers)
          .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
          .where(eq(siteAssignmentWorkers.workerId, leave.userId))
          .orderBy(sql`${siteAssignments.createdAt} DESC`)
          .limit(1);

        const hasFallback = !!workerAssignment?.fallbackSupervisorId && workerAssignment.fallbackSupervisorId !== workerAssignment.supervisorId;
        const newApproverId = hasFallback ? workerAssignment.fallbackSupervisorId : null;
        const reason = hasFallback
          ? `Overdue (${Math.round(ageHours)}h >= ${deadline}h deadline): Escalated to Fallback Supervisor`
          : `Overdue (${Math.round(ageHours)}h >= ${deadline}h deadline): No fallback configured, escalated to Admin`;

        await db
          .update(leaveRequests)
          .set({
            isEscalated: true,
            escalatedAt: now,
            escalationReason: reason,
            currentApproverId: newApproverId,
            updatedAt: now,
          })
          .where(eq(leaveRequests.id, leave.id));

        leavesEscalated++;

        if (newApproverId) {
          await db.insert(notifications).values({
            userId: newApproverId,
            title: 'Leave Request Escalated to You',
            message: `A leave request (${leave.startDate} to ${leave.endDate}) was escalated to you due to supervisor inactivity.`,
            type: 'REQUEST_ESCALATED',
            entityType: 'LEAVE_REQUEST',
            entityId: leave.id,
          });
        }

        await logAuditEvent({
          orgId: leave.orgId,
          actorNameSnapshot: 'Automated Escalation Service',
          actorRole: 'SYSTEM',
          action: 'ESCALATE_LEAVE_OVERDUE',
          entityType: 'LEAVE_REQUEST',
          entityId: leave.id,
          reason,
          afterValues: { isEscalated: true, currentApproverId: newApproverId, escalationReason: reason },
        });
      }
    }

    // C. Pending Correction Requests (Regularization)
    const pendingCorrections = await db
      .select({
        id: attendanceAdjustmentRequests.id,
        sessionId: attendanceAdjustmentRequests.sessionId,
        requestingUserId: attendanceAdjustmentRequests.requestingUserId,
        currentApproverId: attendanceAdjustmentRequests.currentApproverId,
        createdAt: attendanceAdjustmentRequests.createdAt,
        isEscalated: attendanceAdjustmentRequests.isEscalated,
        orgId: attendanceSessions.orgId,
        supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
        fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
        deadlineHours: siteAssignments.escalationDeadlineHours,
      })
      .from(attendanceAdjustmentRequests)
      .innerJoin(attendanceSessions, eq(attendanceAdjustmentRequests.sessionId, attendanceSessions.id))
      .innerJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
      .where(
        and(
          eq(attendanceAdjustmentRequests.status, 'PENDING'),
          eq(attendanceAdjustmentRequests.isEscalated, false),
          orgId ? eq(attendanceSessions.orgId, orgId) : sql`1=1`
        )
      );

    for (const correction of pendingCorrections) {
      const deadline = overrideDeadlineHours ?? (correction.deadlineHours || 24);
      const ageHours = (now.getTime() - new Date(correction.createdAt).getTime()) / (1000 * 60 * 60);

      if (ageHours >= deadline) {
        const hasFallback = !!correction.fallbackSupervisorId && correction.fallbackSupervisorId !== correction.supervisorSnapshotId;
        const newApproverId = hasFallback ? correction.fallbackSupervisorId : null;
        const reason = hasFallback
          ? `Correction request overdue (${Math.round(ageHours)}h): Escalated to Fallback Supervisor`
          : `Correction request overdue (${Math.round(ageHours)}h): Escalated to Admin`;

        await db
          .update(attendanceAdjustmentRequests)
          .set({
            isEscalated: true,
            escalatedAt: now,
            escalationReason: reason,
            currentApproverId: newApproverId,
            updatedAt: now,
          })
          .where(eq(attendanceAdjustmentRequests.id, correction.id));

        correctionsEscalated++;

        if (newApproverId) {
          await db.insert(notifications).values({
            userId: newApproverId,
            title: 'Attendance Correction Escalated to You',
            message: `A correction request was escalated to you due to primary approver inactivity.`,
            type: 'REQUEST_ESCALATED',
            entityType: 'ATTENDANCE_ADJUSTMENT',
            entityId: correction.id,
          });
        }

        await logAuditEvent({
          orgId: correction.orgId,
          actorNameSnapshot: 'Automated Escalation Service',
          actorRole: 'SYSTEM',
          action: 'ESCALATE_CORRECTION_OVERDUE',
          entityType: 'ATTENDANCE_ADJUSTMENT',
          entityId: correction.id,
          reason,
          afterValues: { isEscalated: true, currentApproverId: newApproverId, escalationReason: reason },
        });
      }
    }
  } catch (err) {
    console.error('Error running overdue escalation check:', err);
  }

  return {
    attendanceEscalated,
    leavesEscalated,
    correctionsEscalated,
    exceptionsEscalated,
  };
}

/**
 * 4. Detect and Flag Leave vs Attendance Conflicts
 * Rule:
 *  - Pending leave + clock-in: Keep leave pending, flag conflict (PENDING_ATTENDANCE_CONFLICT).
 *  - Approved leave + clock-in: Preserve leave approval, create reconciliation exception (APPROVED_ATTENDANCE_CONFLICT).
 */
export async function detectAndFlagLeaveAttendanceConflict(
  workerId: string,
  workDateStr: string,
  sessionId: string,
  orgId: string,
  supervisorId?: string
): Promise<void> {
  try {
    const db = await getDb();

    // Check for overlapping leave requests on this date
    const leaves = await db
      .select({
        id: leaveRequests.id,
        status: leaveRequests.status,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.userId, workerId),
          sql`${leaveRequests.status} IN ('PENDING', 'APPROVED')`,
          sql`${leaveRequests.startDate} <= ${workDateStr} AND ${leaveRequests.endDate} >= ${workDateStr}`
        )
      );

    for (const leave of leaves) {
      const isApproved = leave.status === 'APPROVED';
      const conflictStatus = isApproved ? 'APPROVED_ATTENDANCE_CONFLICT' : 'PENDING_ATTENDANCE_CONFLICT';
      const conflictDetails = isApproved
        ? `Worker clocked in on ${workDateStr} despite having an APPROVED leave request (${leave.startDate} to ${leave.endDate}). Requires supervisor reconciliation.`
        : `Worker clocked in on ${workDateStr} while a PENDING leave request (${leave.startDate} to ${leave.endDate}) is awaiting decision.`;

      // Update leave request conflict status
      await db
        .update(leaveRequests)
        .set({
          conflictStatus,
          conflictDetails,
          updatedAt: new Date(),
        })
        .where(eq(leaveRequests.id, leave.id));

      // Create attendance exception
      await db.insert(attendanceExceptions).values({
        orgId,
        workerId,
        sessionId,
        leaveRequestId: leave.id,
        workDate: workDateStr,
        exceptionType: 'LEAVE_ATTENDANCE_CONFLICT',
        severity: isApproved ? 'HIGH' : 'MEDIUM',
        status: 'OPEN',
        primarySupervisorId: supervisorId,
        currentApproverId: supervisorId,
        escalationReason: conflictDetails,
      });

      // Audit log
      await logAuditEvent({
        orgId,
        actorNameSnapshot: 'Attendance Validation Engine',
        actorRole: 'SYSTEM',
        action: 'DETECT_LEAVE_ATTENDANCE_CONFLICT',
        entityType: 'ATTENDANCE_EXCEPTION',
        entityId: sessionId,
        reason: conflictDetails,
        afterValues: { conflictStatus, leaveRequestId: leave.id, sessionId },
      });
    }
  } catch (err) {
    console.error('Error detecting leave-attendance conflict:', err);
  }
}
