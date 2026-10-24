import { getDb } from '../database/db.js';
import { attendanceSessions, siteAssignments } from '../database/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';

export interface OvertimePolicy {
  standardHoursMinutes: number; // default: 540 (9 hours)
  defaultBreakMinutes: number;   // default: 0 unless specified or shift rule
  policyVersion: string;         // 'v1.0'
}

export const DEFAULT_OVERTIME_POLICY: OvertimePolicy = {
  standardHoursMinutes: 540, // 9 hours standard per workday
  defaultBreakMinutes: 0,
  policyVersion: 'v1.0',
};

export interface OvertimeCalculationResult {
  grossDurationMinutes: number;
  breakDurationMinutes: number;
  netWorkingMinutes: number;
  standardHoursMinutes: number;
  calculatedOtMinutes: number;
  isIncomplete: boolean;
  otStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  policyVersion: string;
}

/**
 * Pure calculation engine for overtime on a single session or timespan.
 * Duration is always computed in integer minutes.
 * - Standard working hours = 9 hours (540 mins)
 * - Net worked hours = gross worked duration minus unpaid breaks
 * - Daily OT = max(0, net worked hours - standard hours)
 * - If clock-out is missing or incomplete, calculated OT is 0.
 * - If session is rejected, net worked hours and OT are 0.
 */
export function calculateSessionOvertime(
  clockInTime: Date | string | null | undefined,
  clockOutTime: Date | string | null | undefined,
  sessionStatus: string = 'PENDING',
  customBreakMinutes: number = 0,
  policy: OvertimePolicy = DEFAULT_OVERTIME_POLICY
): OvertimeCalculationResult {
  const standardHours = policy.standardHoursMinutes ?? DEFAULT_OVERTIME_POLICY.standardHoursMinutes;
  const policyVersion = policy.policyVersion ?? DEFAULT_OVERTIME_POLICY.policyVersion;

  // Incomplete session (missing clock-in or clock-out)
  if (!clockInTime || !clockOutTime) {
    return {
      grossDurationMinutes: 0,
      breakDurationMinutes: 0,
      netWorkingMinutes: 0,
      standardHoursMinutes: standardHours,
      calculatedOtMinutes: 0,
      isIncomplete: true,
      otStatus: 'NONE',
      policyVersion,
    };
  }

  // If rejected, worked time and OT do not count
  if (sessionStatus === 'REJECTED') {
    return {
      grossDurationMinutes: 0,
      breakDurationMinutes: 0,
      netWorkingMinutes: 0,
      standardHoursMinutes: standardHours,
      calculatedOtMinutes: 0,
      isIncomplete: false,
      otStatus: 'NONE',
      policyVersion,
    };
  }

  const start = new Date(clockInTime).getTime();
  const end = new Date(clockOutTime).getTime();

  if (isNaN(start) || isNaN(end) || end <= start) {
    return {
      grossDurationMinutes: 0,
      breakDurationMinutes: 0,
      netWorkingMinutes: 0,
      standardHoursMinutes: standardHours,
      calculatedOtMinutes: 0,
      isIncomplete: false,
      otStatus: 'NONE',
      policyVersion,
    };
  }

  // Duration in exact integer minutes (floored)
  const grossMinutes = Math.floor((end - start) / (1000 * 60));
  const breakMinutes = Math.max(0, customBreakMinutes || policy.defaultBreakMinutes || 0);

  // Net worked minutes = gross worked duration minus applicable unpaid breaks
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);

  // Daily OT = max(0, net worked hours - standard hours)
  const otMinutes = Math.max(0, netMinutes - standardHours);

  const otStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' = otMinutes > 0 ? 'PENDING' : 'NONE';

  return {
    grossDurationMinutes: grossMinutes,
    breakDurationMinutes: breakMinutes,
    netWorkingMinutes: netMinutes,
    standardHoursMinutes: standardHours,
    calculatedOtMinutes: otMinutes,
    isIncomplete: false,
    otStatus,
    policyVersion,
  };
}

/**
 * Recalculate overtime for a session stored in the database.
 * Does not overwrite if isPayrollLocked is true.
 */
export async function updateSessionOvertime(
  sessionId: string,
  options?: {
    breakMinutes?: number;
    forcePolicyVersion?: string;
    actorId?: string;
    reason?: string;
  }
): Promise<{ success: boolean; session?: any; error?: string }> {
  const db = await getDb();

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.id as any, sessionId as any))
    .limit(1);

  if (!session) {
    return { success: false, error: 'SESSION_NOT_FOUND' };
  }

  // Prevent modifying payroll-locked sessions
  if (session.isPayrollLocked) {
    return {
      success: false,
      error: 'PAYROLL_LOCKED',
    };
  }

  const breakMinutes = options?.breakMinutes ?? session.breakDurationMinutes ?? 0;
  const policy: OvertimePolicy = {
    standardHoursMinutes: session.standardHoursMinutes || DEFAULT_OVERTIME_POLICY.standardHoursMinutes,
    defaultBreakMinutes: breakMinutes,
    policyVersion: options?.forcePolicyVersion || session.policyVersionSnapshot || DEFAULT_OVERTIME_POLICY.policyVersion,
  };

  const calc = calculateSessionOvertime(
    session.clockInTime,
    session.clockOutTime,
    session.status,
    breakMinutes,
    policy
  );

  // Preserve existing approved OT if already approved and calculated OT is still valid
  let nextOtStatus = session.otStatus;
  let nextApprovedOt = session.approvedOtMinutes;

  if (calc.calculatedOtMinutes === 0) {
    nextOtStatus = 'NONE';
    nextApprovedOt = 0;
  } else if (session.otStatus === 'APPROVED') {
    // Keep approved status, cap approved OT to new calculated OT if reduced
    nextApprovedOt = Math.min(session.approvedOtMinutes, calc.calculatedOtMinutes);
  } else if (session.otStatus === 'REJECTED') {
    nextOtStatus = 'REJECTED';
    nextApprovedOt = 0;
  } else {
    nextOtStatus = 'PENDING';
    nextApprovedOt = 0;
  }

  const [updated] = await db
    .update(attendanceSessions)
    .set({
      breakDurationMinutes: calc.breakDurationMinutes,
      netWorkingSeconds: calc.netWorkingMinutes * 60,
      totalDurationSeconds: calc.grossDurationMinutes * 60,
      calculatedOtMinutes: calc.calculatedOtMinutes,
      approvedOtMinutes: nextApprovedOt,
      otStatus: nextOtStatus,
      policyVersionSnapshot: calc.policyVersion,
      updatedAt: new Date(),
    })
    .where(eq(attendanceSessions.id as any, sessionId as any))
    .returning();

  if (options?.actorId) {
    await logAuditEvent({
      orgId: session.orgId,
      actorId: options.actorId,
      action: 'RECALCULATE_OVERTIME',
      entityType: 'ATTENDANCE_SESSION',
      entityId: sessionId,
      reason: options.reason || 'Attendance or break duration updated',
      beforeValues: {
        calculatedOtMinutes: session.calculatedOtMinutes,
        approvedOtMinutes: session.approvedOtMinutes,
        otStatus: session.otStatus,
      },
      afterValues: {
        calculatedOtMinutes: calc.calculatedOtMinutes,
        approvedOtMinutes: nextApprovedOt,
        otStatus: nextOtStatus,
      },
    });
  }

  return { success: true, session: updated };
}

/**
 * Format integer minutes to a human-readable display string.
 * Example: 60 -> "1h 00m", 90 -> "1h 30m", 0 -> "0m"
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}
