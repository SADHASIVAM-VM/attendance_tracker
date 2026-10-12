import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  attendanceSessions,
  attendanceEvents,
  approvalActions,
  siteAssignments,
  siteAssignmentWorkers,
  worksites,
  users,
  notifications,
  organizations,
} from '../database/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { calculateHaversineDistance, isWithinGeofence, isAccuracyAcceptable } from '../utils/geo.js';
import { generateUploadAuthorization, generateSignedDownloadUrl, savePhoto, verifyStorageToken } from '../services/storage.js';
import { logAuditEvent } from '../utils/audit.js';

const clockInSchema = z.object({
  assignmentId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  reportedAccuracyMeters: z.number().positive(),
  photoObjectKey: z.string().min(1),
  idempotencyKey: z.string().min(1),
  clientDeviceInfo: z.string().optional(),
});

const approvalSchema = z.object({
  note: z.string().optional(),
});

const rejectionSchema = z.object({
  reason: z.string().min(3, 'Rejection note is required and must have at least 3 characters'),
});

const transferSupervisorSchema = z.object({
  newSupervisorId: z.string().uuid(),
  reason: z.string().min(3, 'Transfer reason is required'),
});

export async function requestPhotoUploadAuth(req: Request, res: Response): Promise<any> {
  const userId = req.user!.id;
  const authPayload = generateUploadAuthorization(userId);
  return res.json(authPayload);
}

export async function handlePhotoUpload(req: Request, res: Response): Promise<any> {
  if (!req.file) {
    return res.status(400).json({ error: 'PHOTO_REQUIRED', message: 'No image file uploaded' });
  }

  const token = req.body.token;
  const photoObjectKey = req.body.photoObjectKey;

  if (!token || !photoObjectKey) {
    return res.status(400).json({ error: 'INVALID_AUTH', message: 'Upload token and key required' });
  }

  const verified = verifyStorageToken(token);
  if (!verified || verified.photoObjectKey !== photoObjectKey) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Upload token expired or invalid' });
  }

  await savePhoto(photoObjectKey, req.file.buffer);

  // Generate short-lived signed view URL
  const downloadUrl = generateSignedDownloadUrl(photoObjectKey, req.user?.id);

  return res.json({
    photoObjectKey,
    photoUrl: downloadUrl,
    message: 'Photo uploaded securely',
  });
}

export async function clockIn(req: Request, res: Response): Promise<any> {
  const parseResult = clockInSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const {
    assignmentId,
    latitude,
    longitude,
    reportedAccuracyMeters,
    photoObjectKey,
    idempotencyKey,
    clientDeviceInfo,
  } = parseResult.data;

  const db = await getDb();
  const workerId = req.user!.id;
  const orgId = req.user!.orgId;

  // 1. Check idempotency / duplicate submission
  const existingSessionByIdempotency = await db
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingSessionByIdempotency.length > 0) {
    return res.status(200).json({
      message: 'Attendance already submitted (idempotent)',
      session: existingSessionByIdempotency[0],
    });
  }

  // Check duplicate active session for this assignment and worker
  const existingAssignmentSession = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.assignmentId, assignmentId),
        eq(attendanceSessions.workerId, workerId)
      )
    )
    .limit(1);

  if (existingAssignmentSession.length > 0) {
    return res.status(409).json({
      error: 'DUPLICATE_ATTENDANCE',
      message: 'Attendance session has already been submitted for this assignment',
      session: existingAssignmentSession[0],
    });
  }

  // 2. Fetch assignment details
  const [assignment] = await db
    .select({
      id: siteAssignments.id,
      orgId: siteAssignments.orgId,
      worksiteId: siteAssignments.worksiteId,
      supervisorId: siteAssignments.supervisorId,
      workDate: siteAssignments.workDate,
      status: siteAssignments.status,
      worksiteName: worksites.name,
      worksiteLatitude: worksites.latitude,
      worksiteLongitude: worksites.longitude,
      worksiteRadius: worksites.radiusMeters,
      worksiteMaxAccuracy: worksites.maxAccuracyMeters,
      worksiteIsActive: worksites.isActive,
    })
    .from(siteAssignments)
    .innerJoin(worksites, eq(siteAssignments.worksiteId, worksites.id))
    .where(and(eq(siteAssignments.id, assignmentId), eq(siteAssignments.orgId, orgId)))
    .limit(1);

  if (!assignment) {
    return res.status(404).json({
      error: 'NO_ACTIVE_ASSIGNMENT',
      message: 'Assignment not found',
    });
  }

  if (assignment.status !== 'PUBLISHED') {
    return res.status(400).json({
      error: 'ASSIGNMENT_NOT_PUBLISHED',
      message: `Assignment is not in published state (current status: ${assignment.status})`,
    });
  }

  if (!assignment.worksiteIsActive) {
    return res.status(400).json({
      error: 'WORKSITE_INACTIVE',
      message: 'The assigned worksite is inactive',
    });
  }

  // 3. Verify worker is member of this assignment
  const [membership] = await db
    .select()
    .from(siteAssignmentWorkers)
    .where(
      and(
        eq(siteAssignmentWorkers.assignmentId, assignmentId),
        eq(siteAssignmentWorkers.workerId, workerId)
      )
    )
    .limit(1);

  if (!membership) {
    return res.status(403).json({
      error: 'NOT_ASSIGNED_TO_SITE',
      message: 'Worker is not scheduled for this assignment',
    });
  }

  // 4. Calculate Distance using Haversine
  const calculatedDistanceMeters = calculateHaversineDistance(
    latitude,
    longitude,
    assignment.worksiteLatitude,
    assignment.worksiteLongitude
  );

  // 5. Accuracy & Geofence Policy Checks
  if (!isAccuracyAcceptable(reportedAccuracyMeters, assignment.worksiteMaxAccuracy)) {
    return res.status(422).json({
      error: 'LOCATION_ACCURACY_INSUFFICIENT',
      message: `GPS accuracy (+/- ${Math.round(reportedAccuracyMeters)}m) is too poor. Maximum permitted is ${assignment.worksiteMaxAccuracy}m. Please step outdoors and retry.`,
      reportedAccuracyMeters,
      maxAllowedAccuracyMeters: assignment.worksiteMaxAccuracy,
    });
  }

  const withinGeofence = isWithinGeofence(calculatedDistanceMeters, assignment.worksiteRadius);
  if (!withinGeofence) {
    return res.status(422).json({
      error: 'OUTSIDE_GEOFENCE',
      message: `You are ${Math.round(calculatedDistanceMeters)} meters away from ${assignment.worksiteName}. Clock-in requires being within ${assignment.worksiteRadius} meters.`,
      calculatedDistanceMeters,
      radiusMeters: assignment.worksiteRadius,
    });
  }

  const now = new Date();
  const photoUrl = generateSignedDownloadUrl(photoObjectKey, workerId);

  // 6. Create attendance session and event transactionally
  const [session] = await db
    .insert(attendanceSessions)
    .values({
      orgId,
      assignmentId,
      workerId,
      supervisorSnapshotId: assignment.supervisorId, // Immutable snapshot of assigned supervisor
      worksiteSnapshotId: assignment.worksiteId,
      workDate: assignment.workDate,
      status: 'PENDING',
      idempotencyKey,
      clockInTime: now,
    })
    .returning();

  const [event] = await db
    .insert(attendanceEvents)
    .values({
      sessionId: session.id,
      eventType: 'CLOCK_IN',
      eventTimestamp: now,
      latitude,
      longitude,
      reportedAccuracyMeters,
      calculatedDistanceMeters,
      isWithinGeofence: true,
      photoObjectKey,
      photoUrl,
      clientDeviceInfo,
    })
    .returning();

  // 7. Notify assigned supervisor
  await db.insert(notifications).values({
    userId: assignment.supervisorId,
    title: 'Clock-in Awaiting Approval',
    message: `${req.user!.fullName} clocked in at ${assignment.worksiteName}. Verification required.`,
    type: 'ATTENDANCE_PENDING',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
  });

  // 8. Audit event
  await logAuditEvent({
    orgId,
    actorId: workerId,
    action: 'CLOCK_IN_SUBMITTED',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    afterValues: {
      calculatedDistanceMeters,
      reportedAccuracyMeters,
      supervisorSnapshotId: assignment.supervisorId,
    },
  });

  return res.status(201).json({
    success: true,
    message: 'Clock-in submitted successfully and sent to your supervisor for approval',
    session: {
      ...session,
      event,
    },
  });
}

export async function clockOut(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const workerId = req.user!.id;
  const orgId = req.user!.orgId;

  const [org] = await db
    .select({ clockOutEnabled: organizations.clockOutEnabled })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org?.clockOutEnabled) {
    return res.status(400).json({
      error: 'CLOCK_OUT_DISABLED',
      message: 'Clock-out is currently disabled by organization policy',
    });
  }

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.id as any, id as any),
        eq(attendanceSessions.workerId as any, workerId as any),
        eq(attendanceSessions.orgId as any, orgId as any)
      )
    )
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  if (session.clockOutTime) {
    return res.status(400).json({ error: 'ALREADY_CLOCKED_OUT', message: 'You have already clocked out' });
  }

  const now = new Date();
  const [updatedSession] = await db
    .update(attendanceSessions)
    .set({
      clockOutTime: now,
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, id as any))
    .returning();

  return res.json({
    success: true,
    message: 'Clocked out successfully',
    session: updatedSession,
  });
}

export async function getPendingApprovals(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  let baseQuery = db
    .select({
      sessionId: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      status: attendanceSessions.status,
      clockInTime: attendanceSessions.clockInTime,
      supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
      workerId: users.id,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      workerEmail: users.email,
      worksiteId: worksites.id,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      worksiteAddress: worksites.address,
      shiftName: siteAssignments.shiftName,
      shiftStartTime: siteAssignments.shiftStartTime,
      shiftEndTime: siteAssignments.shiftEndTime,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .innerJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
    .where(
      and(
        eq(attendanceSessions.orgId, user.orgId),
        eq(attendanceSessions.status, 'PENDING')
      )
    );

  const pendingList = await baseQuery;

  // Filter based on supervisor snapshot unless superadmin / admin
  const filtered = isSuperOrAdmin
    ? pendingList
    : pendingList.filter((p: any) => p.supervisorSnapshotId === user.id);

  // Fetch events for these sessions to get location & selfie details
  const sessionIds = filtered.map((p: any) => p.sessionId);
  let eventMap: Record<string, any> = {};

  if (sessionIds.length > 0) {
    const events = await db
      .select()
      .from(attendanceEvents)
      .where(sql`${attendanceEvents.sessionId} IN (${sql.join(sessionIds.map((id: string) => sql`${id}`), sql`, `)})`);

    for (const ev of events) {
      // Re-sign download URL dynamically for supervisor security
      eventMap[ev.sessionId] = {
        ...ev,
        photoUrl: generateSignedDownloadUrl(ev.photoObjectKey, user.id),
      };
    }
  }

  const result = filtered.map((p: any) => ({
    ...p,
    clockInEvent: eventMap[p.sessionId] || null,
  }));

  return res.json(result);
}

export async function approveAttendance(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = approvalSchema.safeParse(req.body);
  const note = parseResult.success ? parseResult.data.note : undefined;

  const db = await getDb();
  const reviewer = req.user!;

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, reviewer.orgId as any)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  if (session.status !== 'PENDING') {
    return res.status(400).json({
      error: 'ATTENDANCE_ALREADY_FINALIZED',
      message: `Session is already finalized with status: ${session.status}`,
    });
  }

  // Check authorization: must be historical assigned supervisor OR admin
  const isAssignedSupervisor = session.supervisorSnapshotId === reviewer.id;
  const isAdminOrSuper = reviewer.roles.includes('ADMIN') || reviewer.roles.includes('SUPER_ADMIN');

  if (!isAssignedSupervisor && !isAdminOrSuper) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_SUPERVISOR',
      message: 'You are not the designated supervisor for this attendance session',
    });
  }

  const now = new Date();
  const [updatedSession] = await db
    .update(attendanceSessions)
    .set({
      status: 'APPROVED',
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, id as any))
    .returning();

  await db.insert(approvalActions).values({
    sessionId: session.id,
    action: 'APPROVED',
    reviewerId: reviewer.id,
    note: note || 'Approved by supervisor',
    performedAt: now,
  });

  // Notify worker
  await db.insert(notifications).values({
    userId: session.workerId,
    title: 'Attendance Approved',
    message: `Your clock-in for ${session.workDate} has been verified and approved.`,
    type: 'ATTENDANCE_APPROVED',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
  });

  await logAuditEvent({
    orgId: reviewer.orgId,
    actorId: reviewer.id,
    action: 'APPROVE_ATTENDANCE',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    beforeValues: { status: 'PENDING' },
    afterValues: { status: 'APPROVED', note },
    ipAddress: req.ip,
  });

  return res.json({ success: true, message: 'Attendance approved', session: updatedSession });
}

export async function rejectAttendance(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = rejectionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'REJECTION_REASON_REQUIRED', details: parseResult.error.issues });
  }

  const { reason } = parseResult.data;
  const db = await getDb();
  const reviewer = req.user!;

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, reviewer.orgId as any)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  if (session.status !== 'PENDING') {
    return res.status(400).json({
      error: 'ATTENDANCE_ALREADY_FINALIZED',
      message: `Session is already finalized with status: ${session.status}`,
    });
  }

  const isAssignedSupervisor = session.supervisorSnapshotId === reviewer.id;
  const isAdminOrSuper = reviewer.roles.includes('ADMIN') || reviewer.roles.includes('SUPER_ADMIN');

  if (!isAssignedSupervisor && !isAdminOrSuper) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_SUPERVISOR',
      message: 'You are not the designated supervisor for this attendance session',
    });
  }

  const now = new Date();
  const [updatedSession] = await db
    .update(attendanceSessions)
    .set({
      status: 'REJECTED',
      rejectionReason: reason,
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, id as any))
    .returning();

  await db.insert(approvalActions).values({
    sessionId: session.id,
    action: 'REJECTED',
    reviewerId: reviewer.id,
    reason,
    performedAt: now,
  });

  // Notify worker
  await db.insert(notifications).values({
    userId: session.workerId,
    title: 'Attendance Rejected',
    message: `Your clock-in for ${session.workDate} was rejected. Reason: ${reason}`,
    type: 'ATTENDANCE_REJECTED',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
  });

  await logAuditEvent({
    orgId: reviewer.orgId,
    actorId: reviewer.id,
    action: 'REJECT_ATTENDANCE',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    beforeValues: { status: 'PENDING' },
    afterValues: { status: 'REJECTED', reason },
    ipAddress: req.ip,
  });

  return res.json({ success: true, message: 'Attendance rejected', session: updatedSession });
}

export async function transferSupervisor(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = transferSupervisorSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { newSupervisorId, reason } = parseResult.data;
  const db = await getDb();
  const actor = req.user!;

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, actor.orgId as any)))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  const previousSupervisorId = session.supervisorSnapshotId;

  // Update session supervisor snapshot with auditable transfer record
  await db
    .update(attendanceSessions)
    .set({
      supervisorSnapshotId: newSupervisorId,
      updatedAt: new Date(),
    })
    .where(eq(attendanceSessions.id as any, id as any));

  await db.insert(approvalActions).values({
    sessionId: session.id,
    action: 'TRANSFERRED',
    reviewerId: actor.id,
    previousSupervisorId,
    reason,
    performedAt: new Date(),
  });

  await logAuditEvent({
    orgId: actor.orgId,
    actorId: actor.id,
    action: 'TRANSFER_SUPERVISOR_ROUTING',
    entityType: 'ATTENDANCE_SESSION',
    entityId: id,
    beforeValues: { supervisorSnapshotId: previousSupervisorId },
    afterValues: { supervisorSnapshotId: newSupervisorId, reason },
    ipAddress: req.ip,
  });

  return res.json({ success: true, message: 'Approval transferred to new supervisor' });
}

export async function getWorkerMyAttendance(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const workerId = req.user!.id;

  const sessions = await db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      status: attendanceSessions.status,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      rejectionReason: attendanceSessions.rejectionReason,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      shiftName: siteAssignments.shiftName,
      supervisorName: users.fullName,
    })
    .from(attendanceSessions)
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .innerJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
    .innerJoin(users, eq(attendanceSessions.supervisorSnapshotId, users.id))
    .where(eq(attendanceSessions.workerId, workerId))
    .orderBy(desc(attendanceSessions.workDate));

  return res.json(sessions);
}
