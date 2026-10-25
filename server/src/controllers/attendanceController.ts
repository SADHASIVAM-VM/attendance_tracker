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
  leaveRequests,
  leaveTypes,
  attendanceFlags,
  attendanceExceptions,
  attendanceAdjustmentRequests,
} from '../database/schema.js';
import { eq, ne, and, or, sql, desc, inArray } from 'drizzle-orm';
import { calculateHaversineDistance, isWithinGeofence, isAccuracyAcceptable } from '../utils/geo.js';
import { logAuditEvent } from '../utils/audit.js';
import { detectAndFlagLeaveAttendanceConflict } from '../services/escalationService.js';
import { supervisorClockIn, supervisorClockOut } from './supervisorAttendanceController.js';
import { generateSignedDownloadUrl, generateUploadAuthorization, savePhoto, verifyStorageToken } from '../services/storage.js';
import { calculateSessionOvertime } from '../services/overtimeService.js';

const clockInSchema = z.object({
  assignmentId: z.string().uuid().optional(),
  worksiteId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  reportedAccuracyMeters: z.number().positive().nullable().optional(),
  photoObjectKey: z.string().optional(),
  idempotencyKey: z.string().optional(),
  clientDeviceInfo: z.string().optional(),
  bypassLocation: z.boolean().optional(),
  asWorker: z.boolean().optional(),
});

const approvalSchema = z.object({
  note: z.string().optional(),
  decisionNote: z.string().optional(),
});

const rejectionSchema = z.object({
  reason: z.string().optional(),
  decisionNote: z.string().optional(),
  note: z.string().optional(),
  rejectionReason: z.string().optional(),
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
    assignmentId: rawAssignmentId,
    worksiteId: rawWorksiteId,
    latitude,
    longitude,
    reportedAccuracyMeters,
    photoObjectKey,
    idempotencyKey,
    clientDeviceInfo,
    bypassLocation,
  } = parseResult.data;

  const db = await getDb();
  const workerId = req.user!.id;
  const orgId = req.user!.orgId;
  const userRoles = req.user!.roles || [];
  const todayStr = new Date().toISOString().split('T')[0];

  // If user is a supervisor and not explicitly submitting worker flow, execute supervisor attendance workflow
  if (userRoles.includes('SUPERVISOR') && !parseResult.data.asWorker) {
    return supervisorClockIn(req, res);
  }

  // Worker workflow: strictly enforce GPS coordinates, accuracy, and verification selfie
  if (latitude == null || longitude == null || reportedAccuracyMeters == null || !photoObjectKey) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Worker clock-in requires valid GPS coordinates, accuracy, and verification photo.',
    });
  }

  // 1. Check idempotency / duplicate submission
  const existingSessionByIdempotency = await db
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.idempotencyKey, idempotencyKey || ''))
    .limit(1);

  if (existingSessionByIdempotency.length > 0) {
    return res.status(200).json({
      message: 'Attendance already submitted (idempotent)',
      session: existingSessionByIdempotency[0],
    });
  }

  // Resolve target assignment: directly or via worksiteId for supervisors
  let assignmentId = rawAssignmentId;
  if (!assignmentId && rawWorksiteId) {
    const candidateAssigns = await db
      .select({
        id: siteAssignments.id,
        workDate: siteAssignments.workDate,
        carryForward: siteAssignments.carryForward,
        status: siteAssignments.status,
      })
      .from(siteAssignments)
      .where(and(eq(siteAssignments.worksiteId, rawWorksiteId), eq(siteAssignments.orgId, orgId)));

    const activeAssign = candidateAssigns.find((a: any) => {
      const aDate = String(a.workDate).split('T')[0];
      if (a.status !== 'PUBLISHED') return false;
      if (aDate === todayStr) return true;
      return a.carryForward !== false && aDate <= todayStr;
    });

    if (activeAssign) {
      assignmentId = activeAssign.id;
    } else {
      // Create a default published assignment for the worksite
      const [newAssign] = await db
        .insert(siteAssignments)
        .values({
          orgId,
          worksiteId: rawWorksiteId,
          supervisorId: workerId,
          workDate: todayStr,
          groupName: 'Supervisor Site Management',
          shiftName: 'Supervisor Shift',
          shiftStartTime: '08:00',
          shiftEndTime: '18:00',
          carryForward: true,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          createdBy: workerId,
        })
        .returning();
      assignmentId = newAssign.id;
    }
  }

  if (!assignmentId) {
    return res.status(400).json({
      error: 'ASSIGNMENT_REQUIRED',
      message: 'Either assignmentId or worksiteId is required to clock in',
    });
  }

  // Check duplicate active session for this assignment, worker AND todayStr
  const existingAssignmentSession = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.assignmentId, assignmentId),
        eq(attendanceSessions.workerId, workerId),
        eq(attendanceSessions.workDate, todayStr)
      )
    )
    .limit(1);

  if (existingAssignmentSession.length > 0) {
    return res.status(409).json({
      error: 'DUPLICATE_ATTENDANCE',
      message: 'Attendance session has already been submitted for this assignment today',
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
      carryForward: siteAssignments.carryForward,
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

  const aDate = String(assignment.workDate).split('T')[0];
  const isValidDate = aDate === todayStr || (assignment.carryForward !== false && aDate <= todayStr);
  if (!isValidDate) {
    return res.status(400).json({
      error: 'INVALID_ASSIGNMENT_DATE',
      message: 'This assignment is not active for today',
    });
  }

  if (!assignment.worksiteIsActive) {
    return res.status(400).json({
      error: 'WORKSITE_INACTIVE',
      message: 'The assigned worksite is inactive',
    });
  }

  // 3. Verify worker or supervisor authorization
  const isSupervisorUser =
    userRoles.includes('SUPERVISOR') ||
    userRoles.includes('ADMIN') ||
    userRoles.includes('SUPER_ADMIN') ||
    assignment.supervisorId === workerId;

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

  if (!membership && !isSupervisorUser) {
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

  // 5b. Fetch Organization Config for supervisor policies
  const [org] = await db
    .select({
      supervisorAutoApprove: organizations.supervisorAutoApprove,
      supervisorBypassLocation: organizations.supervisorBypassLocation,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const supervisorBypassAllowed = Boolean(org?.supervisorBypassLocation ?? true);
  const supervisorAutoApproveAllowed = Boolean(org?.supervisorAutoApprove ?? true);

  const withinGeofence = isWithinGeofence(calculatedDistanceMeters, assignment.worksiteRadius);
  const isLocationBypassed = Boolean(
    isSupervisorUser &&
    supervisorBypassAllowed &&
    (bypassLocation || !withinGeofence)
  );

  if (!withinGeofence && !isLocationBypassed) {
    return res.status(422).json({
      error: 'OUTSIDE_GEOFENCE',
      message: `You are ${Math.round(calculatedDistanceMeters)} meters away from ${assignment.worksiteName}. Clock-in requires being within ${assignment.worksiteRadius} meters.`,
      calculatedDistanceMeters,
      radiusMeters: assignment.worksiteRadius,
    });
  }

  const isAutoApproved = Boolean(isSupervisorUser && supervisorAutoApproveAllowed);
  const initialStatus = isAutoApproved ? 'APPROVED' : 'PENDING';
  const autoApprovalReason = isAutoApproved
    ? 'Auto-approved by system policy (Supervisor Attendance)'
    : null;

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
      currentApproverId: isAutoApproved ? null : assignment.supervisorId,
      worksiteSnapshotId: assignment.worksiteId,
      workDate: todayStr,
      status: initialStatus,
      isAutoApproved,
      autoApprovalReason,
      idempotencyKey,
      clockInTime: now,
      approvalSource: isAutoApproved ? 'SYSTEM_AUTO_APPROVAL' : 'MANUAL',
      approvedAt: isAutoApproved ? now : null,
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
      isWithinGeofence: withinGeofence,
      isLocationBypassed,
      photoObjectKey,
      photoUrl,
      clientDeviceInfo: isLocationBypassed
        ? `[LOCATION_BYPASS_ACTIVE] ${clientDeviceInfo || 'Browser Client'}`
        : clientDeviceInfo,
    })
    .returning();

  // 6b. If auto-approved, record approval action
  if (isAutoApproved) {
    await db.insert(approvalActions).values({
      sessionId: session.id,
      action: 'APPROVED',
      reviewerId: workerId,
      note: 'Auto-approved by system policy (Supervisor Attendance)',
    });
  }

  // 7. Notify assigned supervisor if not self and not auto-approved
  if (assignment.supervisorId !== workerId && !isAutoApproved) {
    await db.insert(notifications).values({
      userId: assignment.supervisorId,
      title: 'Clock-in Awaiting Approval',
      message: `${req.user!.fullName} clocked in at ${assignment.worksiteName}. Verification required.`,
      type: 'ATTENDANCE_PENDING',
      entityType: 'ATTENDANCE_SESSION',
      entityId: session.id,
    });
  }

  // 7b. If a missing clock-in flag exists for this assignment & worker, mark it as resolved by clock-in
  try {
    await db
      .update(attendanceFlags)
      .set({
        resolvedByClockIn: true,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(attendanceFlags.assignmentId, assignmentId),
          eq(attendanceFlags.workerId, workerId),
          eq(attendanceFlags.workDate, assignment.workDate)
        )
      );
  } catch (flagErr) {
    console.warn('Could not update missing clock-in flag resolution:', flagErr);
  }

  // 7c. Check and flag any leave vs attendance conflict
  await detectAndFlagLeaveAttendanceConflict(workerId, todayStr, session.id, orgId, assignment.supervisorId);

  // 8. Audit event
  await logAuditEvent({
    orgId,
    actorId: workerId,
    action: isAutoApproved ? 'CLOCK_IN_AUTO_APPROVED' : 'CLOCK_IN_SUBMITTED',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    afterValues: {
      calculatedDistanceMeters,
      reportedAccuracyMeters,
      isLocationBypassed,
      isAutoApproved,
      supervisorSnapshotId: assignment.supervisorId,
    },
  });

  return res.status(201).json({
    success: true,
    message: isAutoApproved
      ? 'Supervisor clock-in verified and auto-approved by organization policy'
      : 'Clock-in submitted successfully and sent to your supervisor for approval',
    session: {
      ...session,
      event,
    },
  });
}

export async function clockOut(req: Request, res: Response): Promise<any> {
  const sessionIdParam = req.params.id;
  const db = await getDb();
  const workerId = req.user!.id;
  const orgId = req.user!.orgId;
  const userRoles = req.user!.roles || [];
  const todayStr = new Date().toISOString().split('T')[0];

  // If user is a supervisor and not explicitly submitting worker flow, execute supervisor attendance clock-out
  if (userRoles.includes('SUPERVISOR') && !req.body?.asWorker) {
    return supervisorClockOut(req, res);
  }

  const [org] = await db
    .select({
      clockOutEnabled: organizations.clockOutEnabled,
      supervisorAutoApprove: organizations.supervisorAutoApprove,
      supervisorBypassLocation: organizations.supervisorBypassLocation,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org?.clockOutEnabled) {
    return res.status(400).json({
      error: 'CLOCK_OUT_DISABLED',
      message: 'Clock-out is currently disabled by organization policy',
    });
  }

  // Find session by ID or fallback to worker's today active session
  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(
      sessionIdParam && sessionIdParam !== 'current' && sessionIdParam !== 'today'
        ? and(
          eq(attendanceSessions.id as any, sessionIdParam as any),
          eq(attendanceSessions.workerId as any, workerId as any),
          eq(attendanceSessions.orgId as any, orgId as any)
        )
        : and(
          eq(attendanceSessions.workerId as any, workerId as any),
          eq(attendanceSessions.orgId as any, orgId as any),
          sql`DATE(${attendanceSessions.workDate}) = ${todayStr}`
        )
    )
    .orderBy(desc(attendanceSessions.createdAt))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Active attendance session not found' });
  }

  if (session.clockOutTime) {
    return res.status(400).json({ error: 'ALREADY_CLOCKED_OUT', message: 'You have already clocked out for this session' });
  }

  const now = new Date();
  const { latitude, longitude, reportedAccuracyMeters, photoObjectKey, clientDeviceInfo, bypassLocation } = req.body || {};

  // Fetch worksite coordinates to calculate distance
  const [ws] = await db
    .select()
    .from(worksites)
    .where(eq(worksites.id, session.worksiteSnapshotId))
    .limit(1);

  let calculatedDistanceMeters = 0;
  let isWithinGeofence = true;
  if (latitude != null && longitude != null && ws) {
    calculatedDistanceMeters = calculateHaversineDistance(
      Number(latitude),
      Number(longitude),
      ws.latitude,
      ws.longitude
    );
    isWithinGeofence = calculatedDistanceMeters <= ws.radiusMeters;
  }

  const isSupervisorUser =
    (req.user!.roles || []).includes('SUPERVISOR') ||
    (req.user!.roles || []).includes('ADMIN') ||
    (req.user!.roles || []).includes('SUPER_ADMIN') ||
    session.workerId === session.supervisorSnapshotId;

  // Rule: Non-supervisor field workers MUST provide a verified selfie to clock out
  if (!isSupervisorUser && (!photoObjectKey || typeof photoObjectKey !== 'string' || photoObjectKey.trim() === '')) {
    return res.status(400).json({
      error: 'PHOTO_REQUIRED',
      message: 'A verified selfie is required to clock out',
    });
  }

  const isAutoApproved = Boolean(
    session.isAutoApproved || (isSupervisorUser && (org?.supervisorAutoApprove ?? true))
  );
  const updatedStatus = isAutoApproved ? 'APPROVED' : 'PENDING';
  const isLocationBypassed = Boolean(
    isSupervisorUser && (org?.supervisorBypassLocation ?? true) && (!isWithinGeofence || bypassLocation)
  );

  let totalDurationSeconds = 0;
  if (session.clockInTime) {
    totalDurationSeconds = Math.max(0, Math.round((now.getTime() - new Date(session.clockInTime).getTime()) / 1000));
  }
  const breakMinutes = session.breakDurationMinutes || 0;
  const otCalc = calculateSessionOvertime(
    session.clockInTime,
    now,
    updatedStatus,
    breakMinutes,
    {
      standardHoursMinutes: session.standardHoursMinutes || 540,
      defaultBreakMinutes: breakMinutes,
      policyVersion: session.policyVersionSnapshot || 'v1.0',
    }
  );
  const netWorkingSeconds = otCalc.netWorkingMinutes * 60;

  // Update session: record clockOutTime, clockOutSource, duration, overtime and maintain APPROVED if auto-approved
  const [updatedSession] = await db
    .update(attendanceSessions)
    .set({
      clockOutTime: now,
      status: updatedStatus,
      clockOutSource: 'WORKER_SELF',
      totalDurationSeconds,
      netWorkingSeconds,
      standardHoursMinutes: otCalc.standardHoursMinutes,
      breakDurationMinutes: otCalc.breakDurationMinutes,
      calculatedOtMinutes: otCalc.calculatedOtMinutes,
      approvedOtMinutes: 0,
      otStatus: otCalc.otStatus,
      policyVersionSnapshot: otCalc.policyVersion,
      exceptionStatus: 'NONE',
      clockOutLatitude: latitude != null ? Number(latitude) : ws?.latitude,
      clockOutLongitude: longitude != null ? Number(longitude) : ws?.longitude,
      clockOutAccuracy: reportedAccuracyMeters != null ? Number(reportedAccuracyMeters) : 10,
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, session.id as any))
    .returning();

  // Record CLOCK_OUT attendance event with coordinates and selfie
  const outPhotoKey = photoObjectKey || (isSupervisorUser ? `supervisor_out_${Date.now()}_${workerId}.jpg` : '');
  const photoUrl = outPhotoKey ? generateSignedDownloadUrl(outPhotoKey, workerId) : '';

  await db.insert(attendanceEvents).values({
    sessionId: session.id,
    eventType: 'CLOCK_OUT',
    eventTimestamp: now,
    latitude: latitude != null ? Number(latitude) : ws?.latitude ?? 0,
    longitude: longitude != null ? Number(longitude) : ws?.longitude ?? 0,
    reportedAccuracyMeters: reportedAccuracyMeters != null ? Number(reportedAccuracyMeters) : 10,
    calculatedDistanceMeters,
    isWithinGeofence,
    isLocationBypassed,
    photoObjectKey: outPhotoKey,
    photoUrl,
    clientDeviceInfo: isLocationBypassed
      ? `[LOCATION_BYPASS_ACTIVE] ${clientDeviceInfo || req.headers['user-agent'] || 'Web Client'}`
      : (clientDeviceInfo || req.headers['user-agent'] || 'Web Client'),
  });

  // Notify assigned supervisor only if not auto-approved and not self
  if (session.supervisorSnapshotId !== workerId && !isAutoApproved) {
    await db.insert(notifications).values({
      userId: session.supervisorSnapshotId,
      title: 'Clock-out Awaiting Verification',
      message: `${req.user!.fullName} requested clock-out. Verification required.`,
      type: 'ATTENDANCE_PENDING',
      entityType: 'ATTENDANCE_SESSION',
      entityId: session.id,
    });
  }

  // Audit event
  await logAuditEvent({
    orgId,
    actorId: workerId,
    action: isAutoApproved ? 'CLOCK_OUT_AUTO_APPROVED' : 'CLOCK_OUT_SUBMITTED',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    afterValues: {
      clockOutTime: now,
      calculatedDistanceMeters,
      isLocationBypassed,
      isAutoApproved,
      supervisorSnapshotId: session.supervisorSnapshotId,
    },
  });

  return res.json({
    success: true,
    message: isAutoApproved
      ? 'Supervisor clock-out recorded and auto-approved'
      : 'Clock-out submitted successfully and routed to your assigned supervisor for verification',
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
      assignmentSupervisorId: siteAssignments.supervisorId,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .innerJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
    .where(
      and(
        eq(attendanceSessions.orgId, user.orgId),
        eq(attendanceSessions.status, 'PENDING'),
        sql`(${attendanceSessions.isAutoApproved} IS NOT TRUE AND ${attendanceSessions.workerId} != ${attendanceSessions.supervisorSnapshotId} AND (${attendanceSessions.approvalSource} IS NULL OR ${attendanceSessions.approvalSource} != 'SYSTEM_AUTO_APPROVAL'))`
      )
    );

  const pendingList = await baseQuery;

  // Fetch supervisor's assigned worksite IDs and worker IDs to ensure all relevant worker punches can be reviewed
  let userWorksiteIds = new Set<string>();
  let userWorkerIds = new Set<string>();
  if (!isSuperOrAdmin) {
    const supervisorAssignments = await db
      .select({ worksiteId: siteAssignments.worksiteId })
      .from(siteAssignments)
      .where(
        and(
          eq(siteAssignments.orgId, user.orgId),
          eq(siteAssignments.supervisorId, user.id),
          ne(siteAssignments.status, 'CANCELLED')
        )
      );
    userWorksiteIds = new Set(supervisorAssignments.map((a: any) => a.worksiteId));

    const workerAssigned = await db
      .select({ workerId: siteAssignmentWorkers.workerId })
      .from(siteAssignmentWorkers)
      .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
      .where(
        and(
          eq(siteAssignments.orgId, user.orgId),
          eq(siteAssignments.supervisorId, user.id),
          ne(siteAssignments.status, 'CANCELLED')
        )
      );
    userWorkerIds = new Set(workerAssigned.map((w: any) => w.workerId));
  }

  // Filter based on supervisor snapshot, assignment supervisor, supervised worksite, or assigned worker
  const filtered = isSuperOrAdmin
    ? pendingList
    : pendingList.filter(
      (p: any) =>
        p.supervisorSnapshotId === user.id ||
        p.assignmentSupervisorId === user.id ||
        userWorksiteIds.has(p.worksiteId) ||
        userWorkerIds.has(p.workerId)
    );

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

/**
 * Checks whether the reviewer has supervisor authority to approve/reject/transfer an attendance session.
 * Authorized if:
 * 1. Reviewer is ADMIN or SUPER_ADMIN
 * 2. Reviewer matches session.supervisorSnapshotId
 * 3. Reviewer is the supervisor assigned to session.assignmentId
 * 4. Reviewer has an active assignment supervising the session's worksite
 * 5. Reviewer is the supervisor of an assignment that includes this worker
 */
export async function isSupervisorAuthorizedForSession(
  db: any,
  session: any,
  reviewer: any
): Promise<boolean> {
  const isAdminOrSuper = reviewer.roles.includes('ADMIN') || reviewer.roles.includes('SUPER_ADMIN');
  if (isAdminOrSuper) return true;

  // Rule: Workers & supervisors CANNOT approve their own attendance session
  if (session.workerId === reviewer.id) {
    return false;
  }

  // 1. Direct snapshot supervisor match
  if (session.supervisorSnapshotId === reviewer.id) return true;

  // 1b. Current approver match (handles fallback supervisor and escalated requests)
  if (session.currentApproverId === reviewer.id) return true;

  // 2. Direct assignment supervisor or fallback supervisor match
  if (session.assignmentId) {
    const [assignment] = await db
      .select({
        supervisorId: siteAssignments.supervisorId,
        fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
      })
      .from(siteAssignments)
      .where(eq(siteAssignments.id, session.assignmentId))
      .limit(1);

    if (assignment) {
      if (assignment.supervisorId === reviewer.id) return true;
      if (assignment.fallbackSupervisorId === reviewer.id) return true;
    }
  }

  // 3. Worksite supervisor match (reviewer is an active/non-cancelled supervisor for this worksite)
  if (session.worksiteSnapshotId) {
    const [siteSupervisor] = await db
      .select({ id: siteAssignments.id })
      .from(siteAssignments)
      .where(
        and(
          eq(siteAssignments.orgId, reviewer.orgId),
          eq(siteAssignments.worksiteId, session.worksiteSnapshotId),
          or(
            eq(siteAssignments.supervisorId, reviewer.id),
            eq(siteAssignments.fallbackSupervisorId, reviewer.id)
          ),
          ne(siteAssignments.status, 'CANCELLED')
        )
      )
      .limit(1);

    if (siteSupervisor) {
      return true;
    }
  }

  // 4. Worker assigned supervisor match (worker is assigned to reviewer's non-cancelled assignment)
  if (session.workerId) {
    const [workerSupervisor] = await db
      .select({ id: siteAssignmentWorkers.id })
      .from(siteAssignmentWorkers)
      .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
      .where(
        and(
          eq(siteAssignments.orgId, reviewer.orgId),
          eq(siteAssignments.supervisorId, reviewer.id),
          eq(siteAssignmentWorkers.workerId, session.workerId),
          ne(siteAssignments.status, 'CANCELLED')
        )
      )
      .limit(1);

    if (workerSupervisor) {
      return true;
    }
  }

  return false;
}

export async function approveAttendance(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = approvalSchema.safeParse(req.body);
  const rawNote = parseResult.success
    ? (parseResult.data.note || parseResult.data.decisionNote)
    : (req.body as any)?.decisionNote || (req.body as any)?.note;
  const note = rawNote || 'Approved by supervisor';

  const db = await getDb();
  const reviewer = req.user!;

  // Try fetching session by ID, or fallback by worker ID (latest pending session)
  let [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, reviewer.orgId as any)))
    .limit(1);

  if (!session) {
    const [workerSession] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.workerId as any, id as any),
          eq(attendanceSessions.orgId as any, reviewer.orgId as any),
          eq(attendanceSessions.status as any, 'PENDING' as any)
        )
      )
      .orderBy(sql`${attendanceSessions.createdAt} DESC`)
      .limit(1);

    if (workerSession) {
      session = workerSession;
    }
  }

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  if (session.status !== 'PENDING') {
    return res.status(400).json({
      error: 'ATTENDANCE_ALREADY_FINALIZED',
      message: `Session is already finalized with status: ${session.status}`,
    });
  }

  // Rule: A worker or supervisor cannot approve their own attendance session
  if (session.workerId === reviewer.id) {
    return res.status(403).json({
      error: 'CANNOT_APPROVE_OWN_ATTENDANCE',
      message: 'You cannot approve your own attendance session',
    });
  }

  // Check authorization across snapshot, assignment, worksite, or worker assignments
  const isAuthorized = await isSupervisorAuthorizedForSession(db, session, reviewer);

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_SUPERVISOR',
      message: 'You are not the designated supervisor for this attendance session',
    });
  }

  const now = new Date();
  const shouldUpdateSupervisor = session.supervisorSnapshotId !== reviewer.id && reviewer.roles.includes('SUPERVISOR');

  const [updatedSession] = await db
    .update(attendanceSessions)
    .set({
      status: 'APPROVED',
      approvedAt: now,
      approvalSource: 'MANUAL',
      ...(shouldUpdateSupervisor ? { supervisorSnapshotId: reviewer.id } : {}),
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, session.id as any))
    .returning();

  await db.insert(approvalActions).values({
    sessionId: session.id,
    action: 'APPROVED',
    reviewerId: reviewer.id,
    note,
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

  const rawReason = parseResult.success
    ? (parseResult.data.reason || parseResult.data.decisionNote || parseResult.data.note || parseResult.data.rejectionReason)
    : ((req.body as any)?.decisionNote || (req.body as any)?.reason || (req.body as any)?.note);

  // Rejection requires a mandatory reason
  if (!rawReason || rawReason.trim().length < 3) {
    return res.status(400).json({
      error: 'REJECTION_REASON_REQUIRED',
      message: 'A mandatory rejection reason (at least 3 characters) is required',
    });
  }

  const reason = rawReason.trim();

  const db = await getDb();
  const reviewer = req.user!;

  // Try fetching session by ID, or fallback by worker ID (latest pending session)
  let [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, reviewer.orgId as any)))
    .limit(1);

  if (!session) {
    const [workerSession] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.workerId as any, id as any),
          eq(attendanceSessions.orgId as any, reviewer.orgId as any),
          eq(attendanceSessions.status as any, 'PENDING' as any)
        )
      )
      .orderBy(sql`${attendanceSessions.createdAt} DESC`)
      .limit(1);

    if (workerSession) {
      session = workerSession;
    }
  }

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
  }

  if (session.status !== 'PENDING') {
    return res.status(400).json({
      error: 'ATTENDANCE_ALREADY_FINALIZED',
      message: `Session is already finalized with status: ${session.status}`,
    });
  }

  // Check authorization across snapshot, assignment, worksite, or worker assignments
  const isAuthorized = await isSupervisorAuthorizedForSession(db, session, reviewer);

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_SUPERVISOR',
      message: 'You are not the designated supervisor for this attendance session',
    });
  }

  const now = new Date();
  const shouldUpdateSupervisor = session.supervisorSnapshotId !== reviewer.id && reviewer.roles.includes('SUPERVISOR');

  const [updatedSession] = await db
    .update(attendanceSessions)
    .set({
      status: 'REJECTED',
      rejectionReason: reason,
      ...(shouldUpdateSupervisor ? { supervisorSnapshotId: reviewer.id } : {}),
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, session.id as any))
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

  const isAuthorized = await isSupervisorAuthorizedForSession(db, session, actor);
  if (!isAuthorized) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_SUPERVISOR',
      message: 'You are not authorized to transfer this attendance session',
    });
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
  const todayStr = new Date().toISOString().split('T')[0];

  const sessions = await db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      status: attendanceSessions.status,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      rejectionReason: attendanceSessions.rejectionReason,
      standardHoursMinutes: attendanceSessions.standardHoursMinutes,
      breakDurationMinutes: attendanceSessions.breakDurationMinutes,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      totalDurationSeconds: attendanceSessions.totalDurationSeconds,
      calculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      approvedOtMinutes: attendanceSessions.approvedOtMinutes,
      otStatus: attendanceSessions.otStatus,
      isPayrollLocked: attendanceSessions.isPayrollLocked,
      exceptionStatus: attendanceSessions.exceptionStatus,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      shiftName: siteAssignments.shiftName,
      supervisorName: users.fullName,
    })
    .from(attendanceSessions)
    .leftJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .leftJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
    .leftJoin(users, eq(attendanceSessions.supervisorSnapshotId, users.id))
    .where(eq(attendanceSessions.workerId, workerId))
    .orderBy(desc(attendanceSessions.workDate));

  // Query exceptions for missing clock-in / absence
  const exceptions = await db
    .select({
      id: attendanceExceptions.id,
      workDate: attendanceExceptions.workDate,
      exceptionType: attendanceExceptions.exceptionType,
      status: attendanceExceptions.status,
      resolutionType: attendanceExceptions.resolutionType,
      resolutionNote: attendanceExceptions.resolutionNote,
      worksiteId: attendanceExceptions.worksiteId,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      supervisorName: users.fullName,
      createdAt: attendanceExceptions.createdAt,
    })
    .from(attendanceExceptions)
    .leftJoin(worksites, eq(attendanceExceptions.worksiteId, worksites.id))
    .leftJoin(users, eq(attendanceExceptions.primarySupervisorId, users.id))
    .where(eq(attendanceExceptions.workerId, workerId));

  // Query worker's assigned past shifts in roster
  const assignedDays = await db
    .select({
      assignmentId: siteAssignments.id,
      workDate: siteAssignments.workDate,
      worksiteId: siteAssignments.worksiteId,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      shiftName: siteAssignments.shiftName,
      supervisorName: users.fullName,
    })
    .from(siteAssignmentWorkers)
    .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
    .leftJoin(worksites, eq(siteAssignments.worksiteId, worksites.id))
    .leftJoin(users, eq(siteAssignments.supervisorId, users.id))
    .where(
      and(
        eq(siteAssignmentWorkers.workerId, workerId),
        ne(siteAssignments.status, 'CANCELLED'),
        sql`${siteAssignments.workDate} <= ${todayStr}::date`
      )
    );

  // Query supervisor-reviewed missing clock-in flags
  const flags = await db
    .select({
      id: attendanceFlags.id,
      workDate: attendanceFlags.workDate,
      flagStatus: attendanceFlags.flagStatus,
      reason: attendanceFlags.reason,
      note: attendanceFlags.note,
      reviewedBy: attendanceFlags.reviewedBy,
      reviewedAt: attendanceFlags.reviewedAt,
      resolvedByClockIn: attendanceFlags.resolvedByClockIn,
      resolvedAt: attendanceFlags.resolvedAt,
      supervisorName: users.fullName,
    })
    .from(attendanceFlags)
    .leftJoin(users, eq(attendanceFlags.reviewedBy, users.id))
    .where(eq(attendanceFlags.workerId, workerId));

  const flagByDate = new Map<string, any>();
  for (const f of flags) {
    const dStr = String(f.workDate).split('T')[0];
    flagByDate.set(dStr, f);
  }

  // Query worker's regularization requests
  const regularizations = await db
    .select({
      id: attendanceAdjustmentRequests.id,
      sessionId: attendanceAdjustmentRequests.sessionId,
      workDate: attendanceAdjustmentRequests.workDate,
      status: attendanceAdjustmentRequests.status,
      correctionType: attendanceAdjustmentRequests.correctionType,
      reason: attendanceAdjustmentRequests.reason,
      proposedClockInTime: attendanceAdjustmentRequests.proposedClockInTime,
      proposedClockOutTime: attendanceAdjustmentRequests.proposedClockOutTime,
      reviewNote: attendanceAdjustmentRequests.reviewNote,
      reviewedAt: attendanceAdjustmentRequests.reviewedAt,
      createdAt: attendanceAdjustmentRequests.createdAt,
    })
    .from(attendanceAdjustmentRequests)
    .where(eq(attendanceAdjustmentRequests.requestingUserId, workerId));

  const regByDate = new Map<string, any>();
  const regBySessionId = new Map<string, any>();
  for (const reg of regularizations) {
    if (reg.workDate) {
      const dStr = String(reg.workDate).split('T')[0];
      regByDate.set(dStr, reg);
    }
    if (reg.sessionId) {
      regBySessionId.set(reg.sessionId, reg);
    }
  }

  // Attach flag details and regularization to existing punch sessions
  for (const s of sessions) {
    const dStr = String(s.workDate).split('T')[0];
    const flag = flagByDate.get(dStr);
    if (flag) {
      (s as any).flagStatus = flag.flagStatus;
      (s as any).flagReason = flag.reason;
      (s as any).flagNote = flag.note;
      (s as any).flagApproved = flag.flagStatus === 'APPROVED';
    }
    const reg = regBySessionId.get(s.id) || regByDate.get(dStr);
    if (reg) {
      (s as any).regularization = reg;
    }
  }

  const sessionDateSet = new Set(sessions.map((s) => String(s.workDate).split('T')[0]));
  const result: any[] = [...sessions];

  // 1. Process attendance exceptions
  for (const ex of exceptions) {
    const dStr = String(ex.workDate).split('T')[0];
    if (!sessionDateSet.has(dStr)) {
      let synthStatus = 'MISSING_CLOCK_IN';
      if (ex.resolutionType === 'EXCUSED_ABSENCE') {
        synthStatus = 'EXCUSED_ABSENCE';
      } else if (ex.resolutionType === 'UNEXCUSED_ABSENCE') {
        synthStatus = 'ABSENT';
      } else if (ex.status === 'RESOLVED') {
        synthStatus = ex.resolutionType || 'RESOLVED';
      }

      result.push({
        id: `exception_${ex.id}`,
        workDate: dStr,
        status: synthStatus,
        isAbsent: true,
        absenceType: ex.resolutionType || 'MISSING_CLOCK_IN',
        exceptionId: ex.id,
        exceptionStatus: ex.status,
        resolutionType: ex.resolutionType,
        resolutionNote: ex.resolutionNote,
        worksiteName: ex.worksiteName || 'Assigned Worksite',
        worksiteCode: ex.worksiteCode || 'SITE',
        shiftName: 'Scheduled Shift',
        supervisorName: ex.supervisorName || 'Site Supervisor',
        clockInTime: null,
        clockOutTime: null,
        standardHoursMinutes: 540,
        breakDurationMinutes: 0,
        calculatedOtMinutes: 0,
        approvedOtMinutes: 0,
        otStatus: 'NONE',
        isPayrollLocked: false,
        regularization: regByDate.get(dStr) || null,
      });
      sessionDateSet.add(dStr);
    }
  }

  // 2. Process assigned past roster days (incorporating supervisor flag decisions)
  for (const asg of assignedDays) {
    const dStr = String(asg.workDate).split('T')[0];
    if (dStr < todayStr && !sessionDateSet.has(dStr)) {
      const flag = flagByDate.get(dStr);
      let status = 'ABSENT';
      let absenceType = 'UNEXCUSED_ABSENCE';
      let resolutionType = 'UNEXCUSED_ABSENCE';
      let resolutionNote = 'Scheduled shift missed without clock-in or prior leave';

      if (flag) {
        if (flag.flagStatus === 'APPROVED') {
          status = 'EXCUSED_ABSENCE';
          absenceType = 'EXCUSED_ABSENCE';
          resolutionType = 'EXCUSED_ABSENCE';
          resolutionNote = flag.reason
            ? `Absence Excused by Supervisor: ${flag.reason}${flag.note ? ` ("${flag.note}")` : ''}`
            : (flag.note || 'Absence excused by supervisor');
        } else if (flag.flagStatus === 'REJECTED') {
          status = 'ABSENT';
          absenceType = 'UNEXCUSED_ABSENCE';
          resolutionType = 'UNEXCUSED_ABSENCE';
          resolutionNote = flag.reason
            ? `Unexcused Absence - Explanation Rejected: ${flag.reason}${flag.note ? ` ("${flag.note}")` : ''}`
            : (flag.note || 'Unexcused absence - supervisor rejected explanation');
        } else if (flag.flagStatus === 'PENDING_REVIEW') {
          status = 'MISSING_CLOCK_IN';
          absenceType = 'MISSING_CLOCK_IN';
          resolutionType = 'PENDING';
          resolutionNote = 'Missing clock-in pending supervisor review';
        }
      }

      result.push({
        id: flag ? `flag_${flag.id}` : `scheduled_absent_${dStr}`,
        workDate: dStr,
        status,
        isAbsent: true,
        absenceType,
        exceptionStatus: flag?.flagStatus || 'OPEN',
        flagStatus: flag?.flagStatus || null,
        flagReason: flag?.reason || null,
        flagNote: flag?.note || null,
        resolutionType,
        resolutionNote,
        worksiteName: asg.worksiteName || 'Assigned Worksite',
        worksiteCode: asg.worksiteCode || 'SITE',
        shiftName: asg.shiftName || 'Scheduled Shift',
        supervisorName: flag?.supervisorName || asg.supervisorName || 'Site Supervisor',
        clockInTime: null,
        clockOutTime: null,
        standardHoursMinutes: 540,
        breakDurationMinutes: 0,
        calculatedOtMinutes: 0,
        approvedOtMinutes: 0,
        otStatus: 'NONE',
        isPayrollLocked: false,
        regularization: regByDate.get(dStr) || null,
      });
      sessionDateSet.add(dStr);
    }
  }

  result.sort((a, b) => (a.workDate < b.workDate ? 1 : -1));
  return res.json(result);
}

export async function getSupervisorTeamRoster(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  // 0. Validate selected date (Default to today's local date)
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (req.query.date && !dateRegex.test(String(req.query.date))) {
    return res.status(400).json({ error: 'INVALID_DATE', message: 'Date must be formatted as YYYY-MM-DD' });
  }
  const dateParam = String(req.query.date || todayStr);
  const worksiteIdParam = req.query.worksiteId ? String(req.query.worksiteId) : undefined;
  const statusParam = req.query.status ? String(req.query.status).toUpperCase() : undefined;
  const searchParam = req.query.search ? String(req.query.search).trim() : undefined;

  // 1. Fetch site assignments for this org
  const assignmentsQuery = db
    .select({
      id: siteAssignments.id,
      worksiteId: siteAssignments.worksiteId,
      supervisorId: siteAssignments.supervisorId,
      fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
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
      worksiteRadius: worksites.radiusMeters,
    })
    .from(siteAssignments)
    .innerJoin(worksites, eq(siteAssignments.worksiteId, worksites.id))
    .where(eq(siteAssignments.orgId, orgId));

  const allAssignments = await assignmentsQuery;

  // Filter assignments authorized for this supervisor and active on dateParam
  let targetAssignments = allAssignments.filter((a) => {
    const aDate = String(a.workDate).split('T')[0];
    const isCarry = a.carryForward !== false;
    const matchesDate = aDate === dateParam || (isCarry && aDate <= dateParam);
    const matchesSite = !worksiteIdParam || a.worksiteId === worksiteIdParam;
    const isSupervisorAuth =
      isSuperOrAdmin || a.supervisorId === user.id || (a.fallbackSupervisorId && a.fallbackSupervisorId === user.id);

    let isActiveOnDate = false;
    if (a.status !== 'CANCELLED') {
      isActiveOnDate = true;
    } else {
      const cancelDateStr = a.cancelledAt ? String(a.cancelledAt).split('T')[0] : aDate;
      isActiveOnDate = dateParam <= cancelDateStr;
    }

    return matchesDate && matchesSite && isSupervisorAuth && isActiveOnDate;
  });

  // Only if dateParam is today AND targetAssignments is empty do we check un-cancelled assignments as fallback
  if (targetAssignments.length === 0 && dateParam === todayStr) {
    targetAssignments = allAssignments.filter((a) => {
      const matchesSite = !worksiteIdParam || a.worksiteId === worksiteIdParam;
      const isSupervisorAuth =
        isSuperOrAdmin || a.supervisorId === user.id || (a.fallbackSupervisorId && a.fallbackSupervisorId === user.id);
      const isNotCancelled = a.status !== 'CANCELLED';
      return matchesSite && isSupervisorAuth && isNotCancelled;
    });
  }

  const assignmentIds = targetAssignments.map((a) => a.id);

  // 2. Fetch assigned workers for these assignments
  let assignedWorkers: any[] = [];
  if (assignmentIds.length > 0) {
    assignedWorkers = await db
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
  }

  // 3. Fetch attendance sessions for this date and org
  const sessions = await db
    .select({
      id: attendanceSessions.id,
      assignmentId: attendanceSessions.assignmentId,
      workerId: attendanceSessions.workerId,
      workDate: attendanceSessions.workDate,
      status: attendanceSessions.status,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      rejectionReason: attendanceSessions.rejectionReason,
      supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
      currentApproverId: attendanceSessions.currentApproverId,
      worksiteSnapshotId: attendanceSessions.worksiteSnapshotId,
    })
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        sql`DATE(${attendanceSessions.workDate}) = ${dateParam}`
      )
    );

  // 4. Fetch events for these sessions to get location & selfie photos (clock-in AND clock-out)
  const sessionIds = sessions.map((s) => s.id);
  let clockInEventMap: Record<string, any> = {};
  let clockOutEventMap: Record<string, any> = {};

  if (sessionIds.length > 0) {
    const events = await db
      .select()
      .from(attendanceEvents)
      .where(sql`${attendanceEvents.sessionId} IN (${sql.join(sessionIds.map((id: string) => sql`${id}`), sql`, `)})`);

    for (const ev of events) {
      if (ev.eventType === 'CLOCK_IN') {
        clockInEventMap[ev.sessionId] = {
          ...ev,
          photoUrl: generateSignedDownloadUrl(ev.photoObjectKey, user.id),
        };
      } else if (ev.eventType === 'CLOCK_OUT') {
        clockOutEventMap[ev.sessionId] = {
          ...ev,
          photoUrl: generateSignedDownloadUrl(ev.photoObjectKey, user.id),
        };
      }
    }
  }

  // 5. Index sessions by workerId
  const sessionByWorkerId: Record<string, any> = {};
  for (const s of sessions) {
    sessionByWorkerId[s.workerId] = {
      ...s,
      clockInEvent: clockInEventMap[s.id] || null,
      clockOutEvent: clockOutEventMap[s.id] || null,
    };
  }

  // 5b. Fetch leaves covering this date
  const activeLeaves = await db
    .select({
      id: leaveRequests.id,
      userId: leaveRequests.userId,
      status: leaveRequests.status,
      leaveTypeName: leaveTypes.name,
      reason: leaveRequests.reason,
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

  const leaveByWorkerId: Record<string, any> = {};
  for (const l of activeLeaves) {
    leaveByWorkerId[l.userId] = l;
  }

  // 5c. Fetch supervisor attendance flags / remarks for this date
  const dateFlags = await db
    .select({
      id: attendanceFlags.id,
      workerId: attendanceFlags.workerId,
      flagStatus: attendanceFlags.flagStatus,
      reason: attendanceFlags.reason,
      note: attendanceFlags.note,
    })
    .from(attendanceFlags)
    .where(and(eq(attendanceFlags.orgId, orgId), eq(attendanceFlags.workDate, dateParam)));

  const flagByWorkerId: Record<string, any> = {};
  for (const f of dateFlags) {
    flagByWorkerId[f.workerId] = f;
  }

  // 6. Map assigned workers to roster items
  const rosterWorkers: any[] = [];
  const processedWorkerIds = new Set<string>();

  for (const aw of assignedWorkers) {
    if (processedWorkerIds.has(aw.workerId)) continue;
    processedWorkerIds.add(aw.workerId);

    const assignment = targetAssignments.find((a) => a.id === aw.assignmentId);
    const session = sessionByWorkerId[aw.workerId];
    const leave = leaveByWorkerId[aw.workerId];
    const flag = flagByWorkerId[aw.workerId];

    const clockInEvent = session?.clockInEvent;
    const clockOutEvent = session?.clockOutEvent;
    const distanceMeters =
      clockInEvent?.calculatedDistanceMeters != null ? Math.round(clockInEvent.calculatedDistanceMeters) : 0;
    const isWithinRadius = clockInEvent?.isWithinGeofence ?? (session ? true : false);

    let formatClockIn = null;
    if (session?.clockInTime) {
      formatClockIn = new Date(session.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    let formatClockOut = null;
    if (session?.clockOutTime) {
      formatClockOut = new Date(session.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    let workerStatus: string;
    let note = flag?.note || flag?.reason || 'Scheduled on shift roster';
    const hasAppliedLeave = !!leave;

    if (session?.status) {
      workerStatus = session.status;
      if (session?.rejectionReason) {
        note = session.rejectionReason;
      } else if (session?.clockOutTime) {
        note = 'Clock-out submitted for verification';
      } else if (session?.clockInTime) {
        note = 'Clock-in submitted';
      }
    } else if (leave) {
      if (leave.status === 'APPROVED') {
        workerStatus = 'ON_LEAVE';
        note = `On Leave (${leave.leaveTypeName || 'Approved'})`;
      } else {
        workerStatus = 'ABSENT';
        note = `Absent (Leave Applied: ${leave.leaveTypeName || 'Pending'})`;
      }
    } else {
      // Assigned, but has not clocked in -> NOT_YET_IN (Missing clock-in)
      workerStatus = 'NOT_YET_IN';
      note = flag?.note || flag?.reason || 'Not yet clocked in';
    }

    rosterWorkers.push({
      id: session?.id || `roster_${aw.workerId}`,
      workerId: aw.workerId,
      name: aw.fullName || 'Field Worker',
      role: aw.employmentType
        ? aw.employmentType.charAt(0).toUpperCase() + aw.employmentType.slice(1)
        : 'Field Worker',
      avatar:
        aw.photoUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(aw.fullName || 'Worker')}&background=0D8ABC&color=fff`,
      clockInTime: formatClockIn,
      clockOutTime: formatClockOut,
      totalHours: session?.clockInTime && session?.clockOutTime ? 8.0 : session?.clockInTime ? 4.5 : 0,
      inPhotoUrl: clockInEvent?.photoUrl || aw.photoUrl || '',
      outPhotoUrl: clockOutEvent?.photoUrl || null,
      distanceMeters,
      isWithinRadius,
      status: workerStatus,
      hasAppliedLeave,
      note,
      rejectionReason: session?.rejectionReason || undefined,
      flagStatus: flag?.flagStatus || undefined,
      flagReason: flag?.reason || undefined,
      worksiteId: assignment?.worksiteId || '',
      worksiteName: assignment?.worksiteName || '',
      date: dateParam,
      employeeCode: aw.employeeCode || '',
      email: aw.email || '',
      phone: aw.phone || '',
      shiftName: assignment?.shiftName || 'General Shift',
    });
  }

  // 7. Also include any workers who punched against this supervisor's assignments or worksite
  for (const s of sessions) {
    const isAuthorizedForSession =
      isSuperOrAdmin ||
      s.supervisorSnapshotId === user.id ||
      s.currentApproverId === user.id ||
      assignmentIds.includes(s.assignmentId);

    if (!processedWorkerIds.has(s.workerId) && isAuthorizedForSession) {
      processedWorkerIds.add(s.workerId);
      const [u] = await db.select().from(users).where(eq(users.id, s.workerId)).limit(1);
      const assignment = allAssignments.find((a) => a.id === s.assignmentId);
      const flag = flagByWorkerId[s.workerId];
      const clockInEvent = s.clockInEvent;
      const clockOutEvent = s.clockOutEvent;
      const distanceMeters =
        clockInEvent?.calculatedDistanceMeters != null ? Math.round(clockInEvent.calculatedDistanceMeters) : 0;

      const formatClockIn = s.clockInTime
        ? new Date(s.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;
      const formatClockOut = s.clockOutTime
        ? new Date(s.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;

      rosterWorkers.push({
        id: s.id,
        workerId: s.workerId,
        name: u?.fullName || 'Field Worker',
        role: u?.employmentType
          ? u.employmentType.charAt(0).toUpperCase() + u.employmentType.slice(1)
          : 'Field Worker',
        avatar:
          u?.photoUrl ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.fullName || 'Worker')}&background=0D8ABC&color=fff`,
        clockInTime: formatClockIn,
        clockOutTime: formatClockOut,
        totalHours: s.clockInTime && s.clockOutTime ? 8.0 : s.clockInTime ? 4.5 : 0,
        inPhotoUrl: clockInEvent?.photoUrl || u?.photoUrl || '',
        outPhotoUrl: clockOutEvent?.photoUrl || null,
        distanceMeters,
        isWithinRadius: clockInEvent?.isWithinGeofence ?? true,
        status: s.status,
        note:
          s.rejectionReason ||
          flag?.note ||
          (s.clockOutTime ? 'Clock-out submitted for verification' : 'Submitted clock-in'),
        rejectionReason: s.rejectionReason || undefined,
        flagStatus: flag?.flagStatus || undefined,
        flagReason: flag?.reason || undefined,
        worksiteId: assignment?.worksiteId || s.worksiteSnapshotId,
        worksiteName: assignment?.worksiteName || 'Assigned Worksite',
        date: dateParam,
        employeeCode: u?.employeeCode || '',
        email: u?.email || '',
        phone: u?.phone || '',
        shiftName: assignment?.shiftName || 'General Shift',
      });
    }
  }

  // 8. Calculate Four Interactive Statistics Cards from real backend data
  const totalWorkers = rosterWorkers.length;
  const approved = rosterWorkers.filter((w) => w.status === 'APPROVED').length;
  const rejected = rosterWorkers.filter((w) => w.status === 'REJECTED').length;
  // Missing clock-ins: Assigned workers who have NO clock-in record for this date and are NOT on approved leave
  const missingClockIns = rosterWorkers.filter(
    (w) => !w.clockInTime && w.status !== 'ON_LEAVE'
  ).length;
  const pending = rosterWorkers.filter((w) => w.status === 'PENDING').length;
  const onLeave = rosterWorkers.filter((w) => w.status === 'ON_LEAVE').length;

  // Query pending regularizations within supervisor's scope
  const pendingRegRequests = await db
    .select({ count: sql<number>`count(*)` })
    .from(attendanceAdjustmentRequests)
    .innerJoin(attendanceSessions, eq(attendanceAdjustmentRequests.sessionId, attendanceSessions.id))
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        eq(attendanceAdjustmentRequests.status, 'PENDING'),
        isSuperOrAdmin
          ? sql`true`
          : or(
              eq(attendanceAdjustmentRequests.currentApproverId, user.id),
              eq(attendanceSessions.supervisorSnapshotId, user.id)
            )!
      )
    );
  const pendingRegularization = Number(pendingRegRequests[0]?.count || 0);

  // Active flagged attendance dates for dateParam
  const flaggedDatesCount = Object.keys(flagByWorkerId).length;

  const statistics = {
    totalWorkers,
    approved,
    rejected,
    missingClockIns,
    pending,
    onLeave,
    pendingApprovals: pending,
    pendingRegularization,
    flaggedDatesCount,
    flaggedCount: flaggedDatesCount,
  };

  // 9. Apply optional search and status filtering if requested via query
  let filteredWorkers = rosterWorkers;
  if (searchParam) {
    const q = searchParam.toLowerCase();
    filteredWorkers = filteredWorkers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.employeeCode && w.employeeCode.toLowerCase().includes(q)) ||
        (w.role && w.role.toLowerCase().includes(q))
    );
  }

  if (statusParam && statusParam !== 'ALL') {
    if (statusParam === 'APPROVED') {
      filteredWorkers = filteredWorkers.filter((w) => w.status === 'APPROVED');
    } else if (statusParam === 'REJECTED') {
      filteredWorkers = filteredWorkers.filter((w) => w.status === 'REJECTED');
    } else if (statusParam === 'PENDING') {
      filteredWorkers = filteredWorkers.filter((w) => w.status === 'PENDING');
    } else if (statusParam === 'MISSING_CLOCK_IN' || statusParam === 'NOT_YET_IN') {
      filteredWorkers = filteredWorkers.filter((w) => !w.clockInTime && w.status !== 'ON_LEAVE');
    } else if (statusParam === 'ON_LEAVE') {
      filteredWorkers = filteredWorkers.filter((w) => w.status === 'ON_LEAVE');
    }
  }

  return res.json({
    date: dateParam,
    statistics,
    assignments: targetAssignments,
    workers: filteredWorkers,
    totalCount: totalWorkers,
    filteredCount: filteredWorkers.length,
  });
}

/**
 * POST /attendance/:id/supervisor-clock-out
 * Allows an authorized supervisor or admin to clock out an assigned worker
 */
export async function supervisorClockOutWorker(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const supervisor = req.user!;
  const orgId = supervisor.orgId;
  const { reason, note } = req.body || {};

  const effectiveReason = (reason || note || '').trim();
  if (!effectiveReason || effectiveReason.length < 3) {
    return res.status(400).json({
      error: 'REASON_REQUIRED',
      message: 'A mandatory reason (at least 3 characters) is required to record assisted clock-out',
    });
  }

  const db = await getDb();

  // Try fetching session by ID, or fallback to worker's active session without clockOutTime
  let [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id as any, id as any), eq(attendanceSessions.orgId as any, orgId as any)))
    .limit(1);

  if (!session) {
    const [workerSession] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.workerId as any, id as any),
          eq(attendanceSessions.orgId as any, orgId as any),
          sql`${attendanceSessions.clockOutTime} IS NULL`
        )
      )
      .orderBy(desc(attendanceSessions.createdAt))
      .limit(1);

    if (workerSession) {
      session = workerSession;
    }
  }

  if (!session) {
    return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Active attendance session not found' });
  }

  if (session.clockOutTime) {
    return res.status(400).json({
      error: 'ALREADY_CLOCKED_OUT',
      message: 'Worker has already clocked out for this attendance session',
    });
  }

  // Verify supervisor is authorized for this worker/session
  const isAuthorized = await isSupervisorAuthorizedForSession(db, session, supervisor);
  if (!isAuthorized) {
    return res.status(403).json({
      error: 'UNAUTHORIZED_SUPERVISOR',
      message: 'You are not authorized to clock out this worker',
    });
  }

  const now = new Date();

  // Duration calculation
  let totalDurationSeconds = 0;
  if (session.clockInTime) {
    totalDurationSeconds = Math.max(0, Math.round((now.getTime() - new Date(session.clockInTime).getTime()) / 1000));
  }
  const netWorkingSeconds = totalDurationSeconds;

  // Worksite coordinates
  const [ws] = await db
    .select()
    .from(worksites)
    .where(eq(worksites.id, session.worksiteSnapshotId))
    .limit(1);

  // Update attendance session
  const [updatedSession] = await db
    .update(attendanceSessions)
    .set({
      clockOutTime: now,
      clockOutSource: 'SUPERVISOR_ASSISTED',
      totalDurationSeconds,
      netWorkingSeconds,
      exceptionStatus: 'NONE',
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, session.id as any))
    .returning();

  // Insert CLOCK_OUT event
  await db.insert(attendanceEvents).values({
    sessionId: session.id,
    eventType: 'CLOCK_OUT',
    eventTimestamp: now,
    latitude: ws?.latitude ?? 0,
    longitude: ws?.longitude ?? 0,
    reportedAccuracyMeters: 10,
    calculatedDistanceMeters: 0,
    isWithinGeofence: true,
    isLocationBypassed: true,
    photoObjectKey: 'supervisor_assisted_clockout',
    photoUrl: '',
    clientDeviceInfo: `[SUPERVISOR_ASSISTED] Clocked out by ${supervisor.fullName} (${supervisor.id}). Reason: ${effectiveReason}`,
  });

  // Record approval/action
  await db.insert(approvalActions).values({
    sessionId: session.id,
    action: 'SUPERVISOR_CLOCK_OUT',
    reviewerId: supervisor.id,
    note: effectiveReason,
    performedAt: now,
  });

  // Notify worker
  await db.insert(notifications).values({
    userId: session.workerId,
    title: 'Clocked Out by Supervisor',
    message: `Your supervisor ${supervisor.fullName} recorded your clock-out. Reason: ${effectiveReason}`,
    type: 'ATTENDANCE_SUPERVISOR_CLOCK_OUT',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
  });

  // Audit log
  await logAuditEvent({
    orgId: supervisor.orgId,
    actorId: supervisor.id,
    actorNameSnapshot: supervisor.fullName,
    actorRole: supervisor.roles[0],
    action: 'SUPERVISOR_CLOCK_OUT_WORKER',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    reason: effectiveReason,
    beforeValues: {
      clockOutTime: null,
      clockOutSource: session.clockOutSource,
    },
    afterValues: {
      clockOutTime: now.toISOString(),
      clockOutSource: 'SUPERVISOR_ASSISTED',
      totalDurationSeconds,
      supervisorId: supervisor.id,
      workerId: session.workerId,
    },
    metadata: JSON.stringify({
      workerId: session.workerId,
      supervisorId: supervisor.id,
      clockOutTime: now.toISOString(),
    }),
    req,
  });

  return res.json({
    success: true,
    message: 'Worker clocked out successfully by supervisor',
    session: updatedSession,
  });
}

/**
 * GET /attendance/supervisor/history-range
 * Returns historical attendance records within a date range [startDate, endDate]
 * for the supervisor's authorized team/scope with:
 * { date, workerName, employeeCode, clockInTime, clockOutTime, worksiteName, status, flag }
 * The flag property is from the missing clock-ins review.
 */
export async function getSupervisorAttendanceHistoryRange(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const { startDate, endDate, worksiteId, workerId, status, search } = req.query as Record<string, string>;

  const todayStr = new Date().toISOString().split('T')[0];
  const start = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : todayStr;
  const end = endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : todayStr;

  // 1. Fetch site assignments to determine supervisor scope
  const allAssignments = await db
    .select({
      id: siteAssignments.id,
      worksiteId: siteAssignments.worksiteId,
      supervisorId: siteAssignments.supervisorId,
      fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
    })
    .from(siteAssignments)
    .where(eq(siteAssignments.orgId, orgId));

  const authorizedWorksiteIds = new Set<string>();
  const authorizedAssignmentIds = new Set<string>();
  allAssignments.forEach((a) => {
    if (isSuperOrAdmin || a.supervisorId === user.id || a.fallbackSupervisorId === user.id) {
      authorizedAssignmentIds.add(a.id);
      authorizedWorksiteIds.add(a.worksiteId);
    }
  });

  // 2. Query attendance sessions in date range
  const sessions = await db
    .select({
      id: attendanceSessions.id,
      workerId: attendanceSessions.workerId,
      workDate: attendanceSessions.workDate,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      status: attendanceSessions.status,
      worksiteSnapshotId: attendanceSessions.worksiteSnapshotId,
      supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
      currentApproverId: attendanceSessions.currentApproverId,
      assignmentId: attendanceSessions.assignmentId,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      workerAvatar: users.photoUrl,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .leftJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .where(
      and(
        eq(attendanceSessions.orgId, orgId),
        sql`${attendanceSessions.workDate} >= ${start}::date`,
        sql`${attendanceSessions.workDate} <= ${end}::date`
      )
    );

  // 3. Query missing attendance flags in date range
  const flags = await db
    .select({
      id: attendanceFlags.id,
      workerId: attendanceFlags.workerId,
      workDate: attendanceFlags.workDate,
      flagStatus: attendanceFlags.flagStatus,
      reason: attendanceFlags.reason,
      note: attendanceFlags.note,
      reviewedAt: attendanceFlags.reviewedAt,
      resolvedByClockIn: attendanceFlags.resolvedByClockIn,
      supervisorId: attendanceFlags.supervisorId,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      worksiteId: worksites.id,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
    })
    .from(attendanceFlags)
    .innerJoin(users, eq(attendanceFlags.workerId, users.id))
    .innerJoin(siteAssignments, eq(attendanceFlags.assignmentId, siteAssignments.id))
    .leftJoin(worksites, eq(siteAssignments.worksiteId, worksites.id))
    .where(
      and(
        eq(attendanceFlags.orgId, orgId),
        sql`${attendanceFlags.workDate} >= ${start}::date`,
        sql`${attendanceFlags.workDate} <= ${end}::date`
      )
    );

  // Map flags by `${workerId}_${workDate}`
  const flagMap = new Map<string, any>();
  flags.forEach((f) => {
    const dStr = String(f.workDate).split('T')[0];
    flagMap.set(`${f.workerId}_${dStr}`, f);
  });

  // Filter sessions by supervisor authorization scope
  const authorizedSessions = sessions.filter((s) => {
    if (isSuperOrAdmin) return true;
    if (s.supervisorSnapshotId === user.id || s.currentApproverId === user.id) return true;
    if (s.assignmentId && authorizedAssignmentIds.has(s.assignmentId)) return true;
    if (s.worksiteSnapshotId && authorizedWorksiteIds.has(s.worksiteSnapshotId)) return true;
    return false;
  });

  // Build combined list
  const sessionKeys = new Set<string>();
  const result: any[] = [];

  for (const s of authorizedSessions) {
    const dStr = String(s.workDate).split('T')[0];
    const key = `${s.workerId}_${dStr}`;
    sessionKeys.add(key);

    const fl = flagMap.get(key);
    result.push({
      id: s.id,
      date: dStr,
      workerId: s.workerId,
      workerName: s.workerName || 'Worker',
      employeeCode: s.employeeCode || s.workerId.slice(0, 8),
      workerAvatar: s.workerAvatar,
      clockInTime: s.clockInTime,
      clockOutTime: s.clockOutTime,
      worksiteId: s.worksiteSnapshotId,
      worksiteName: s.worksiteName || 'Assigned Worksite',
      worksiteCode: s.worksiteCode || 'SITE',
      status: s.status,
      flag: fl
        ? {
            id: fl.id,
            status: fl.flagStatus,
            reason: fl.reason || 'Missing Clock-In',
            note: fl.note,
            reviewedAt: fl.reviewedAt,
          }
        : null,
    });
  }

  // Include missing clock-in flags that do not have an existing attendanceSession
  for (const f of flags) {
    const dStr = String(f.workDate).split('T')[0];
    const key = `${f.workerId}_${dStr}`;
    if (!sessionKeys.has(key)) {
      if (!isSuperOrAdmin && f.supervisorId !== user.id) {
        continue;
      }
      sessionKeys.add(key);

      result.push({
        id: `flag_${f.id}`,
        date: dStr,
        workerId: f.workerId,
        workerName: f.workerName || 'Worker',
        employeeCode: f.employeeCode || f.workerId.slice(0, 8),
        workerAvatar: null,
        clockInTime: null,
        clockOutTime: null,
        worksiteId: f.worksiteId,
        worksiteName: f.worksiteName || 'Assigned Worksite',
        worksiteCode: f.worksiteCode || 'SITE',
        status: f.flagStatus === 'APPROVED' ? 'EXCUSED_ABSENCE' : 'ABSENT',
        flag: {
          id: f.id,
          status: f.flagStatus,
          reason: f.reason || 'Missing Clock-In',
          note: f.note,
          reviewedAt: f.reviewedAt,
        },
      });
    }
  }

  // Apply optional filters (worksite, worker, status, search)
  let filtered = result;
  if (worksiteId && worksiteId !== 'ALL') {
    filtered = filtered.filter((r) => r.worksiteId === worksiteId || r.worksiteName === worksiteId || r.worksiteCode === worksiteId);
  }
  if (workerId && workerId !== 'ALL') {
    filtered = filtered.filter((r) => r.workerId === workerId);
  }
  if (status && status !== 'ALL') {
    filtered = filtered.filter((r) => r.status === status);
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.workerName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q) ||
        r.worksiteName.toLowerCase().includes(q)
    );
  }

  // Sort by date descending, then worker name
  filtered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.workerName.localeCompare(b.workerName)));

  return res.json({
    startDate: start,
    endDate: end,
    totalRecords: filtered.length,
    records: filtered,
  });
}


