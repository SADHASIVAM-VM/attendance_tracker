import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  attendanceAdjustmentRequests,
  attendanceSessions,
  users,
  worksites,
  notifications,
} from '../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';

const requestSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  proposedClockInTime: z.string().datetime().optional(),
  proposedClockOutTime: z.string().datetime().optional(),
});

const decisionSchema = z.object({
  reviewNote: z.string().optional(),
});

export async function requestRegularization(req: Request, res: Response): Promise<any> {
  const { id } = req.params; // attendance session ID
  const parseResult = requestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { reason, proposedClockInTime, proposedClockOutTime } = parseResult.data;
  const db = await getDb();
  const userId = req.user!.id;
  const orgId = req.user!.orgId;

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, orgId as any)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance record not found' });
  }

  // Requester must be the worker or authorized supervisor
  if (session.workerId !== userId && session.supervisorSnapshotId !== userId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to request correction for this session' });
  }

  const [adjustment] = await db
    .insert(attendanceAdjustmentRequests)
    .values({
      sessionId: session.id,
      requestingUserId: userId,
      reason,
      proposedClockInTime: proposedClockInTime ? new Date(proposedClockInTime) : null,
      proposedClockOutTime: proposedClockOutTime ? new Date(proposedClockOutTime) : null,
      status: 'PENDING',
    })
    .returning();

  // Notify supervisor
  await db.insert(notifications).values({
    userId: session.supervisorSnapshotId,
    title: 'Attendance Regularization Request',
    message: `${req.user!.fullName} requested attendance adjustment for ${session.workDate}.`,
    type: 'REGULARIZATION_PENDING',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: adjustment.id,
  });

  await logAuditEvent({
    orgId,
    actorId: userId,
    action: 'REQUEST_ATTENDANCE_REGULARIZATION',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: adjustment.id,
    afterValues: adjustment,
    ipAddress: String(req.ip || ''),
  });

  return res.status(201).json(adjustment);
}

export async function getPendingRegularizations(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const pending = await db
    .select({
      id: attendanceAdjustmentRequests.id,
      sessionId: attendanceAdjustmentRequests.sessionId,
      reason: attendanceAdjustmentRequests.reason,
      proposedClockInTime: attendanceAdjustmentRequests.proposedClockInTime,
      proposedClockOutTime: attendanceAdjustmentRequests.proposedClockOutTime,
      status: attendanceAdjustmentRequests.status,
      createdAt: attendanceAdjustmentRequests.createdAt,
      workerId: users.id,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      workDate: attendanceSessions.workDate,
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
    );

  const filtered = isSuperOrAdmin
    ? pending
    : pending.filter((p: any) => p.supervisorSnapshotId === user.id);

  return res.json(filtered);
}

export async function approveRegularization(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = decisionSchema.safeParse(req.body);
  const reviewNote = parseResult.success ? parseResult.data.reviewNote : undefined;

  const db = await getDb();
  const reviewer = req.user!;

  const [adjustment] = await db
    .select()
    .from(attendanceAdjustmentRequests)
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .limit(1);

  if (!adjustment || adjustment.status !== 'PENDING') {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Pending regularization request not found' });
  }

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.id as any, adjustment.sessionId as any))
    .limit(1);

  // Update adjustment status
  const now = new Date();
  await db
    .update(attendanceAdjustmentRequests)
    .set({
      status: 'APPROVED',
      reviewerId: reviewer.id,
      reviewNote,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceAdjustmentRequests.id as any, id as any));

  // Update session transactionally
  const sessionUpdates: any = { updatedAt: now, status: 'APPROVED' };
  if (adjustment.proposedClockInTime) sessionUpdates.clockInTime = adjustment.proposedClockInTime;
  if (adjustment.proposedClockOutTime) sessionUpdates.clockOutTime = adjustment.proposedClockOutTime;

  await db
    .update(attendanceSessions)
    .set(sessionUpdates)
    .where(eq(attendanceSessions.id as any, adjustment.sessionId as any));

  // Notify requester
  await db.insert(notifications).values({
    userId: adjustment.requestingUserId,
    title: 'Regularization Approved',
    message: `Your attendance regularization for ${session.workDate} was approved.`,
    type: 'REGULARIZATION_APPROVED',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: adjustment.id,
  });

  await logAuditEvent({
    orgId: reviewer.orgId,
    actorId: reviewer.id,
    action: 'APPROVE_ATTENDANCE_REGULARIZATION',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: id,
    beforeValues: { clockInTime: session.clockInTime, clockOutTime: session.clockOutTime },
    afterValues: sessionUpdates,
    ipAddress: String(req.ip || ''),
  });

  return res.json({ success: true, message: 'Regularization approved and attendance updated' });
}

export async function rejectRegularization(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = decisionSchema.safeParse(req.body);
  const reviewNote = parseResult.success ? parseResult.data.reviewNote : 'Rejected by reviewer';

  const db = await getDb();
  const reviewer = req.user!;

  const [adjustment] = await db
    .select()
    .from(attendanceAdjustmentRequests)
    .where(eq(attendanceAdjustmentRequests.id as any, id as any))
    .limit(1);

  if (!adjustment || adjustment.status !== 'PENDING') {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Pending regularization request not found' });
  }

  const now = new Date();
  await db
    .update(attendanceAdjustmentRequests)
    .set({
      status: 'REJECTED',
      reviewerId: reviewer.id,
      reviewNote,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceAdjustmentRequests.id as any, id as any));

  await logAuditEvent({
    orgId: reviewer.orgId,
    actorId: reviewer.id,
    action: 'REJECT_ATTENDANCE_REGULARIZATION',
    entityType: 'ATTENDANCE_ADJUSTMENT',
    entityId: id,
    afterValues: { reviewNote },
    ipAddress: String(req.ip || ''),
  });

  return res.json({ success: true, message: 'Regularization request rejected' });
}
