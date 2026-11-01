import { eq, desc, and } from 'drizzle-orm';
import {
  attendanceSessions,
  approvalActions,
  auditLogs,
  users,
} from '../database/schema.js';
import { logAuditEvent } from '../utils/audit.js';

export const CANONICAL_ATTENDANCE_STATUSES = [
  'APPROVED',
  'REJECTED',
  'ABSENT',
  'MISSING',
  'PENDING',
  'LEAVE',
] as const;

export type CanonicalAttendanceStatus = typeof CANONICAL_ATTENDANCE_STATUSES[number];

/**
 * Normalizes any legacy or variant attendance status representation
 * to one of the 6 canonical statuses.
 */
export function normalizeAttendanceStatus(rawStatus?: string | null): CanonicalAttendanceStatus {
  if (!rawStatus) return 'PENDING';
  const norm = String(rawStatus).toUpperCase().trim();
  if (['APPROVED', 'PRESENT', 'EXCUSED_ABSENCE', 'ACTIVE', 'HEALTHY'].includes(norm)) {
    return 'APPROVED';
  }
  if (['REJECTED', 'CANCELLED'].includes(norm)) {
    return 'REJECTED';
  }
  if (['ABSENT', 'UNEXCUSED_ABSENCE'].includes(norm)) {
    return 'ABSENT';
  }
  if (['MISSING', 'MISSING_CLOCK_IN', 'NOT_YET_IN', 'OPEN'].includes(norm)) {
    return 'MISSING';
  }
  if (['LEAVE', 'ON_LEAVE', 'APPROVED_LEAVE'].includes(norm)) {
    return 'LEAVE';
  }
  if (['PENDING', 'PENDING_REVIEW', 'FLAGGED', 'INVESTIGATING', 'REGULARIZATION_PENDING'].includes(norm)) {
    return 'PENDING';
  }
  return 'PENDING';
}

/**
 * Validates that a note is non-empty, not whitespace-only, and meets minimum length.
 */
export function validateMandatoryNote(
  note?: string | null,
  minLengthOrContext?: number | string,
  optionalMinLength?: number
): { valid: boolean; trimmedNote: string; note: string; error?: string } {
  let minLength = 3;
  if (typeof minLengthOrContext === 'number') {
    minLength = minLengthOrContext;
  } else if (typeof optionalMinLength === 'number') {
    minLength = optionalMinLength;
  }

  if (!note || typeof note !== 'string') {
    return {
      valid: false,
      trimmedNote: '',
      note: '',
      error: `A mandatory, meaningful note of at least ${minLength} characters is required.`,
    };
  }
  const trimmed = note.trim();
  if (trimmed.length < minLength) {
    return {
      valid: false,
      trimmedNote: '',
      note: '',
      error: `Note must be at least ${minLength} characters long and cannot be whitespace-only.`,
    };
  }
  return { valid: true, trimmedNote: trimmed, note: trimmed };
}

export interface AttendanceStatusTransitionParams {
  db: any;
  session: any;
  targetStatus: CanonicalAttendanceStatus;
  actorId: string;
  actorRole?: string;
  actorNameSnapshot?: string;
  note: string;
  actionType: string;
  regularizationId?: string;
  delegationId?: string;
  clockInTime?: Date | null;
  clockOutTime?: Date | null;
  totalDurationSeconds?: number;
  netWorkingSeconds?: number;
  calculatedOtMinutes?: number;
  approvedOtMinutes?: number;
  otStatus?: string;
  approvalSource?: string;
  req?: any;
}

/**
 * Authoritative single-source-of-truth status transition for attendance records.
 * Atomically updates attendanceSessions and records append-only immutable audit history in approvalActions & auditLogs.
 */
export async function applyAttendanceStatusTransition(params: AttendanceStatusTransitionParams): Promise<{
  updatedSession: any;
  previousStatus: string;
  newStatus: CanonicalAttendanceStatus;
  auditActionId: string;
}> {
  const {
    db,
    session,
    targetStatus,
    actorId,
    actorRole = 'ADMIN',
    actorNameSnapshot,
    note,
    actionType,
    regularizationId,
    delegationId,
    clockInTime,
    clockOutTime,
    totalDurationSeconds,
    netWorkingSeconds,
    calculatedOtMinutes,
    approvedOtMinutes,
    otStatus,
    approvalSource,
    req,
  } = params;

  // 1. Validate canonical status
  if (!CANONICAL_ATTENDANCE_STATUSES.includes(targetStatus)) {
    throw new Error(`Invalid attendance status: ${targetStatus}. Must be one of: ${CANONICAL_ATTENDANCE_STATUSES.join(', ')}`);
  }

  // 2. Validate mandatory note
  const noteValidation = validateMandatoryNote(note, 3);
  if (!noteValidation.valid) {
    throw new Error(noteValidation.error);
  }
  const cleanNote = noteValidation.trimmedNote;

  const now = new Date();
  const previousStatus = normalizeAttendanceStatus(session.status);

  // 3. Prepare session updates
  const sessionUpdates: Record<string, any> = {
    status: targetStatus,
    notes: cleanNote,
    actionBy: actorId,
    currentApproverId: actorId,
    updatedAt: now,
  };

  if (approvalSource) {
    sessionUpdates.approvalSource = approvalSource;
  }

  // Handle status-specific metadata
  if (targetStatus === 'APPROVED') {
    sessionUpdates.approvedAt = now;
    sessionUpdates.rejectionReason = null; // Clear historical rejection reason so it does not persist on current record
  } else if (targetStatus === 'REJECTED') {
    sessionUpdates.rejectionReason = cleanNote;
  } else if (targetStatus === 'ABSENT') {
    sessionUpdates.rejectionReason = cleanNote;
  }

  if (clockInTime !== undefined) sessionUpdates.clockInTime = clockInTime;
  if (clockOutTime !== undefined) sessionUpdates.clockOutTime = clockOutTime;
  if (totalDurationSeconds !== undefined) sessionUpdates.totalDurationSeconds = totalDurationSeconds;
  if (netWorkingSeconds !== undefined) sessionUpdates.netWorkingSeconds = netWorkingSeconds;
  if (calculatedOtMinutes !== undefined) sessionUpdates.calculatedOtMinutes = calculatedOtMinutes;
  if (approvedOtMinutes !== undefined) sessionUpdates.approvedOtMinutes = approvedOtMinutes;
  if (otStatus !== undefined) sessionUpdates.otStatus = otStatus;

  // 4. Update the authoritative attendance session
  const [updatedSession] = await db
    .update(attendanceSessions)
    .set(sessionUpdates)
    .where(eq(attendanceSessions.id, session.id))
    .returning();

  // 5. Append immutable audit history event in approvalActions
  const [createdAudit] = await db
    .insert(approvalActions)
    .values({
      sessionId: session.id,
      workerId: session.workerId,
      workDate: session.workDate,
      previousStatus,
      newStatus: targetStatus,
      action: actionType,
      actionType,
      reviewerId: actorId,
      actorRole,
      regularizationId: regularizationId || null,
      delegationId: delegationId || null,
      note: cleanNote,
      reason: cleanNote,
      performedAt: now,
    })
    .returning();

  // 6. Record audit log entry
  await logAuditEvent({
    orgId: session.orgId,
    actorId,
    actorNameSnapshot,
    actorRole,
    action: `ATTENDANCE_STATUS_TRANSITION_${targetStatus}`,
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    reason: cleanNote,
    beforeValues: {
      status: previousStatus,
      notes: session.notes,
      actionBy: session.actionBy,
      rejectionReason: session.rejectionReason,
    },
    afterValues: {
      status: targetStatus,
      notes: cleanNote,
      actionBy: actorId,
      rejectionReason: sessionUpdates.rejectionReason ?? null,
      actionType,
    },
    req,
  });

  return {
    updatedSession,
    previousStatus,
    newStatus: targetStatus,
    auditActionId: createdAudit?.id,
  };
}

/**
 * Fetch immutable audit trail for an attendance session
 */
export async function getAttendanceSessionAuditTrail(db: any, sessionId: string): Promise<any[]> {
  const actions = await db
    .select({
      id: approvalActions.id,
      sessionId: approvalActions.sessionId,
      workerId: approvalActions.workerId,
      workDate: approvalActions.workDate,
      previousStatus: approvalActions.previousStatus,
      newStatus: approvalActions.newStatus,
      action: approvalActions.action,
      actionType: approvalActions.actionType,
      reviewerId: approvalActions.reviewerId,
      actorRole: approvalActions.actorRole,
      note: approvalActions.note,
      reason: approvalActions.reason,
      performedAt: approvalActions.performedAt,
      reviewerName: users.fullName,
      reviewerEmail: users.email,
    })
    .from(approvalActions)
    .leftJoin(users, eq(approvalActions.reviewerId, users.id))
    .where(eq(approvalActions.sessionId, sessionId))
    .orderBy(desc(approvalActions.performedAt));

  return actions.map((a: any) => ({
    id: a.id,
    sessionId: a.sessionId,
    workerId: a.workerId,
    workDate: a.workDate ? String(a.workDate).split('T')[0] : null,
    previousStatus: a.previousStatus ? normalizeAttendanceStatus(a.previousStatus) : null,
    newStatus: a.newStatus ? normalizeAttendanceStatus(a.newStatus) : normalizeAttendanceStatus(a.action),
    action: a.action,
    actionType: a.actionType || a.action,
    reviewerId: a.reviewerId,
    reviewerName: a.reviewerName || 'Authorised Reviewer',
    actorRole: a.actorRole || 'SUPERVISOR',
    note: a.note || a.reason || 'Status updated',
    performedAt: a.performedAt,
  }));
}
