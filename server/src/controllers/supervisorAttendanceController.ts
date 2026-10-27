import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  attendanceSessions,
  supervisorLocationVisits,
  approvalActions,
  siteAssignments,
  worksites,
  users,
  organizations,
} from '../database/schema.js';
import { eq, and, or, sql, desc, isNull } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';

// Input Schemas
const supervisorClockInSchema = z.object({
  worksiteId: z.string().uuid().optional(),
  date: z.string().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  reportedAccuracyMeters: z.number().nonnegative().nullable().optional(),
  photoObjectKey: z.string().optional(),
  idempotencyKey: z.string().optional(),
  clientDeviceInfo: z.string().optional(),
});

const supervisorLocationSwitchSchema = z.object({
  destinationLocationId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  date: z.string().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  reportedAccuracyMeters: z.number().nonnegative().nullable().optional(),
  clientDeviceInfo: z.string().optional(),
});

const supervisorClockOutSchema = z.object({
  sessionId: z.string().uuid().optional(),
  date: z.string().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  reportedAccuracyMeters: z.number().nonnegative().nullable().optional(),
  photoObjectKey: z.string().optional(),
  clientDeviceInfo: z.string().optional(),
});

/**
 * Helper to fetch supervisor's valid assigned locations for a specific date
 */
export async function getSupervisorAssignedLocationsHelper(
  db: any,
  orgId: string,
  supervisorId: string,
  targetDate: string,
  userRoles: string[] = []
) {
  const isSuperOrAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('ADMIN');

  // Query site assignments for supervisor on target date (or active carry-forward)
  const assignments = await db
    .select({
      assignmentId: siteAssignments.id,
      workDate: siteAssignments.workDate,
      carryForward: siteAssignments.carryForward,
      shiftName: siteAssignments.shiftName,
      shiftStartTime: siteAssignments.shiftStartTime,
      shiftEndTime: siteAssignments.shiftEndTime,
      worksiteId: worksites.id,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      worksiteAddress: worksites.address,
      worksiteRadius: worksites.radiusMeters,
      worksiteIsActive: worksites.isActive,
    })
    .from(siteAssignments)
    .innerJoin(worksites, eq(siteAssignments.worksiteId, worksites.id))
    .where(
      and(
        eq(siteAssignments.orgId, orgId),
        sql`${siteAssignments.status} != 'CANCELLED'`,
        eq(worksites.isActive, true)
      )
    );

  const validAssignments = assignments.filter((a: any) => {
    // If not super/admin, ensure assignment is for this supervisor
    const aDate = String(a.workDate).split('T')[0];
    const isDateMatch = aDate === targetDate || (a.carryForward !== false && aDate <= targetDate);
    return isDateMatch;
  });

  // Unique worksites by ID
  const map = new Map<string, any>();
  for (const item of validAssignments) {
    if (!map.has(item.worksiteId)) {
      map.set(item.worksiteId, {
        id: item.worksiteId,
        assignmentId: item.assignmentId,
        name: item.worksiteName,
        code: item.worksiteCode,
        address: item.worksiteAddress,
        radiusMeters: item.worksiteRadius,
        shiftName: item.shiftName,
        shiftStartTime: item.shiftStartTime,
        shiftEndTime: item.shiftEndTime,
      });
    }
  }

  // If superadmin / admin or if no specific assignment exists yet, also make active master worksites available
  if (isSuperOrAdmin || map.size === 0) {
    const activeWorksites = await db
      .select({
        id: worksites.id,
        name: worksites.name,
        code: worksites.code,
        address: worksites.address,
        radiusMeters: worksites.radiusMeters,
      })
      .from(worksites)
      .where(and(eq(worksites.orgId, orgId), eq(worksites.isActive, true)));

    for (const ws of activeWorksites) {
      if (!map.has(ws.id)) {
        map.set(ws.id, {
          ...ws,
          assignmentId: null,
          shiftName: 'Supervisor Shift',
          shiftStartTime: '08:00',
          shiftEndTime: '18:00',
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * 1. GET /api/attendance/supervisor/assigned-locations
 */
export async function getAssignedLocations(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const targetDate = String(req.query.date || new Date().toISOString().split('T')[0]);

  const assignedLocations = await getSupervisorAssignedLocationsHelper(
    db,
    user.orgId,
    user.id,
    targetDate,
    user.roles
  );

  return res.json({
    date: targetDate,
    supervisorId: user.id,
    count: assignedLocations.length,
    locations: assignedLocations,
  });
}

/**
 * 2. POST /api/attendance/supervisor/clock-in
 */
export async function supervisorClockIn(req: Request, res: Response): Promise<any> {
  const parseResult = supervisorClockInSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const {
    worksiteId: rawWorksiteId,
    latitude,
    longitude,
    reportedAccuracyMeters,
    photoObjectKey,
    idempotencyKey,
    clientDeviceInfo,
  } = parseResult.data;

  const db = await getDb();
  const supervisorId = req.user!.id;
  const orgId = req.user!.orgId;
  const userRoles = req.user!.roles || [];
  const todayStr = parseResult.data.date || String(req.body.date || req.query.date || new Date().toISOString().split('T')[0]);
  const now = new Date();

  // Validate GPS format if present
  const hasValidGps =
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude));

  const safeLat = hasValidGps ? Number(latitude) : null;
  const safeLng = hasValidGps ? Number(longitude) : null;
  const safeAccuracy =
    hasValidGps && reportedAccuracyMeters != null && !isNaN(Number(reportedAccuracyMeters))
      ? Number(reportedAccuracyMeters)
      : null;

  // 1. Check if supervisor already has an active or completed attendance session for today
  const existingTodaySessions = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.workerId, supervisorId),
        eq(attendanceSessions.orgId, orgId),
        sql`DATE(${attendanceSessions.workDate}) = ${todayStr}`
      )
    )
    .orderBy(desc(attendanceSessions.createdAt))
    .limit(1);

  if (existingTodaySessions.length > 0) {
    const existing = existingTodaySessions[0];
    if (existing.clockOutTime) {
      return res.status(409).json({
        error: 'SHIFT_ALREADY_COMPLETED',
        message: 'Supervisor shift for today has already been completed.',
        session: existing,
      });
    }
    return res.status(200).json({
      message: 'Supervisor attendance session already active.',
      session: existing,
    });
  }

  // 2. Fetch assigned locations for today
  const assignedLocations = await getSupervisorAssignedLocationsHelper(
    db,
    orgId,
    supervisorId,
    todayStr,
    userRoles
  );

  let initialWorksite: any = null;
  let targetAssignmentId: string | null = null;

  if (rawWorksiteId) {
    initialWorksite = assignedLocations.find((l: any) => l.id === rawWorksiteId);
    if (!initialWorksite) {
      // Audit log failed attempt
      await logAuditEvent({
        orgId,
        actorId: supervisorId,
        action: 'SUPERVISOR_CLOCK_IN_FAILED',
        entityType: 'ATTENDANCE_SESSION',
        afterValues: {
          reason: 'LOCATION_NOT_ASSIGNED',
          attemptedLocationId: rawWorksiteId,
          timestamp: now.toISOString(),
        },
      });

      return res.status(403).json({
        error: 'LOCATION_NOT_ASSIGNED',
        message: 'Selected location is not in your assigned locations for today.',
      });
    }
    targetAssignmentId = initialWorksite.assignmentId;
  }

  // Ensure an assignment ID exists (fallback to published supervisor assignment)
  if (!targetAssignmentId) {
    const fallbackWsId = initialWorksite?.id || (assignedLocations[0]?.id ?? null);
    if (fallbackWsId) {
      // Check existing assignment
      const [existingAssign] = await db
        .select({ id: siteAssignments.id })
        .from(siteAssignments)
        .where(
          and(
            eq(siteAssignments.orgId, orgId),
            eq(siteAssignments.worksiteId, fallbackWsId),
            eq(siteAssignments.status, 'PUBLISHED')
          )
        )
        .limit(1);

      if (existingAssign) {
        targetAssignmentId = existingAssign.id;
      } else {
        const [newAssign] = await db
          .insert(siteAssignments)
          .values({
            orgId,
            worksiteId: fallbackWsId,
            supervisorId,
            workDate: todayStr,
            groupName: 'Supervisor Site Management',
            shiftName: 'Supervisor Shift',
            shiftStartTime: '08:00',
            shiftEndTime: '18:00',
            carryForward: true,
            status: 'PUBLISHED',
            publishedAt: now,
            createdBy: supervisorId,
          })
          .returning();
        targetAssignmentId = newAssign.id;
      }
    }
  }

  if (!targetAssignmentId) {
    return res.status(400).json({
      error: 'NO_ASSIGNMENT_AVAILABLE',
      message: 'No active location assignments configured for your organization.',
    });
  }

  const generatedIdempKey =
    idempotencyKey || `sup_${supervisorId}_${todayStr}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 3. Create Attendance Session with Automatic Approval
  const [session] = await db
    .insert(attendanceSessions)
    .values({
      orgId,
      assignmentId: targetAssignmentId,
      workerId: supervisorId,
      supervisorSnapshotId: supervisorId,
      worksiteSnapshotId: initialWorksite?.id || assignedLocations[0].id,
      workDate: todayStr,
      status: 'APPROVED',
      isAutoApproved: true,
      approvalSource: 'SYSTEM_AUTO_APPROVAL',
      approvedAt: now,
      autoApprovalReason: 'Auto-approved by system policy (Supervisor Attendance)',
      idempotencyKey: generatedIdempKey,
      clockInTime: now,
      activeLocationId: initialWorksite ? initialWorksite.id : null,
      activeLocationStartedAt: initialWorksite ? now : null,
      clockInLatitude: safeLat,
      clockInLongitude: safeLng,
      clockInAccuracy: safeAccuracy,
    })
    .returning();

  // Record system approval action
  await db.insert(approvalActions).values({
    sessionId: session.id,
    action: 'APPROVED',
    reviewerId: supervisorId,
    note: 'Auto-approved by system policy (SYSTEM_AUTO_APPROVAL)',
  });

  // 4. If initial location was selected, record the first location visit session
  let firstVisit: any = null;
  if (initialWorksite) {
    const [visit] = await db
      .insert(supervisorLocationVisits)
      .values({
        sessionId: session.id,
        supervisorId,
        locationId: initialWorksite.id,
        locationNameSnapshot: initialWorksite.name,
        startedAt: now,
        endedAt: null,
        durationSeconds: 0,
        startLatitude: safeLat,
        startLongitude: safeLng,
        gpsAccuracyMeters: safeAccuracy,
      })
      .returning();
    firstVisit = visit;
  }

  // 5. Immutable Audit Log
  await logAuditEvent({
    orgId,
    actorId: supervisorId,
    action: 'SUPERVISOR_CLOCK_IN',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    afterValues: {
      actorNameSnapshot: req.user!.fullName,
      actorRole: 'SUPERVISOR',
      timestamp: now.toISOString(),
      locationId: initialWorksite?.id || null,
      locationName: initialWorksite?.name || null,
      isAutoApproved: true,
      approvalSource: 'SYSTEM_AUTO_APPROVAL',
      gps: safeLat != null ? { latitude: safeLat, longitude: safeLng, accuracy: safeAccuracy } : null,
      clientDeviceInfo,
    },
  });

  return res.status(201).json({
    success: true,
    message: initialWorksite
      ? `Supervisor clock-in recorded & auto-approved at ${initialWorksite.name}`
      : 'Supervisor clock-in recorded & auto-approved. Please select your working location.',
    session: {
      ...session,
      activeVisit: firstVisit,
    },
    activeLocation: initialWorksite
      ? {
          locationId: initialWorksite.id,
          locationNameSnapshot: initialWorksite.name,
          startedAt: now,
          elapsedSeconds: 0,
        }
      : null,
  });
}

/**
 * 3. POST /api/attendance/supervisor/location-switch
 */
export async function switchLocation(req: Request, res: Response): Promise<any> {
  const parseResult = supervisorLocationSwitchSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const {
    destinationLocationId,
    sessionId: rawSessionId,
    latitude,
    longitude,
    reportedAccuracyMeters,
    clientDeviceInfo,
  } = parseResult.data;

  const db = await getDb();
  const supervisorId = req.user!.id;
  const orgId = req.user!.orgId;
  const userRoles = req.user!.roles || [];
  const todayStr = parseResult.data.date || String(req.body.date || req.query.date || new Date().toISOString().split('T')[0]);
  const now = new Date();

  const hasValidGps =
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude));

  const safeLat = hasValidGps ? Number(latitude) : null;
  const safeLng = hasValidGps ? Number(longitude) : null;
  const safeAccuracy =
    hasValidGps && reportedAccuracyMeters != null && !isNaN(Number(reportedAccuracyMeters))
      ? Number(reportedAccuracyMeters)
      : null;

  // 1. Fetch supervisor's active session for today
  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(
      rawSessionId
        ? and(eq(attendanceSessions.id as any, rawSessionId as any), eq(attendanceSessions.workerId, supervisorId))
        : and(
            eq(attendanceSessions.workerId, supervisorId),
            eq(attendanceSessions.orgId, orgId),
            sql`DATE(${attendanceSessions.workDate}) = ${todayStr}`
          )
    )
    .orderBy(desc(attendanceSessions.createdAt))
    .limit(1);

  if (!session) {
    return res.status(404).json({
      error: 'NO_ACTIVE_SESSION',
      message: 'No active attendance session found. Please clock in first.',
    });
  }

  if (session.clockOutTime) {
    return res.status(400).json({
      error: 'SESSION_ALREADY_CLOSED',
      message: 'You have already clocked out for today. Location switching is closed.',
    });
  }

  // 2. Validate destination location is in supervisor's assigned locations
  const assignedLocations = await getSupervisorAssignedLocationsHelper(
    db,
    orgId,
    supervisorId,
    todayStr,
    userRoles
  );

  const destWorksite = assignedLocations.find((l: any) => l.id === destinationLocationId);
  if (!destWorksite) {
    // Audit failed attempt
    await logAuditEvent({
      orgId,
      actorId: supervisorId,
      action: 'SUPERVISOR_LOCATION_SWITCH_REJECTED',
      entityType: 'ATTENDANCE_SESSION',
      entityId: session.id,
      afterValues: {
        reason: 'DESTINATION_LOCATION_NOT_ASSIGNED',
        attemptedLocationId: destinationLocationId,
        timestamp: now.toISOString(),
      },
    });

    return res.status(403).json({
      error: 'LOCATION_NOT_ASSIGNED',
      message: 'You cannot switch to an unassigned location.',
    });
  }

  // 3. Check currently active location visit
  const activeVisits = await db
    .select()
    .from(supervisorLocationVisits)
    .where(
      and(
        eq(supervisorLocationVisits.sessionId, session.id),
        sql`${supervisorLocationVisits.endedAt} IS NULL`
      )
    )
    .orderBy(desc(supervisorLocationVisits.startedAt));

  const currentActiveVisit = activeVisits[0] || null;

  // Rule: If supervisor selects the location they are already actively working at, do not create a duplicate
  if (currentActiveVisit && currentActiveVisit.locationId === destinationLocationId) {
    const elapsedSecs = Math.max(
      0,
      Math.floor((now.getTime() - new Date(currentActiveVisit.startedAt).getTime()) / 1000)
    );
    return res.status(200).json({
      message: `Already actively working at ${destWorksite.name}. No duplicate session created.`,
      activeVisit: {
        ...currentActiveVisit,
        elapsedSeconds: elapsedSecs,
      },
      switched: false,
    });
  }

  // 4. Atomically close previous visit & open new visit
  let closedVisitSummary: any = null;
  if (currentActiveVisit) {
    const startMs = new Date(currentActiveVisit.startedAt).getTime();
    const durationSeconds = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));

    const [closedVisit] = await db
      .update(supervisorLocationVisits)
      .set({
        endedAt: now,
        durationSeconds,
        endLatitude: safeLat,
        endLongitude: safeLng,
        updatedAt: now,
      })
      .where(eq(supervisorLocationVisits.id, currentActiveVisit.id))
      .returning();

    closedVisitSummary = closedVisit;
  }

  // Open new visit for the destination location
  const [newVisit] = await db
    .insert(supervisorLocationVisits)
    .values({
      sessionId: session.id,
      supervisorId,
      locationId: destinationLocationId,
      locationNameSnapshot: destWorksite.name,
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      startLatitude: safeLat,
      startLongitude: safeLng,
      gpsAccuracyMeters: safeAccuracy,
    })
    .returning();

  // Update session active location
  await db
    .update(attendanceSessions)
    .set({
      activeLocationId: destinationLocationId,
      activeLocationStartedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, session.id as any));

  // 5. Audit Log
  const isInitialSelection = !currentActiveVisit;
  await logAuditEvent({
    orgId,
    actorId: supervisorId,
    action: isInitialSelection ? 'SUPERVISOR_LOCATION_SELECT' : 'SUPERVISOR_LOCATION_SWITCH',
    entityType: 'SUPERVISOR_LOCATION_VISIT',
    entityId: newVisit.id,
    beforeValues: currentActiveVisit
      ? {
          locationId: currentActiveVisit.locationId,
          locationName: currentActiveVisit.locationNameSnapshot,
          startedAt: currentActiveVisit.startedAt,
          endedAt: now.toISOString(),
          durationSeconds: closedVisitSummary?.durationSeconds ?? 0,
        }
      : null,
    afterValues: {
      locationId: destinationLocationId,
      locationName: destWorksite.name,
      startedAt: now.toISOString(),
      actorNameSnapshot: req.user!.fullName,
      actorRole: 'SUPERVISOR',
      gps: safeLat != null ? { latitude: safeLat, longitude: safeLng, accuracy: safeAccuracy } : null,
      clientDeviceInfo,
    },
  });

  return res.status(200).json({
    success: true,
    message: isInitialSelection
      ? `Started tracking time at ${destWorksite.name}`
      : `Switched location from ${currentActiveVisit.locationNameSnapshot} to ${destWorksite.name}`,
    switched: true,
    previousVisit: closedVisitSummary,
    activeVisit: newVisit,
  });
}

/**
 * 4. POST /api/attendance/supervisor/clock-out
 */
export async function supervisorClockOut(req: Request, res: Response): Promise<any> {
  const parseResult = supervisorClockOutSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const {
    sessionId: rawSessionId,
    latitude,
    longitude,
    reportedAccuracyMeters,
    clientDeviceInfo,
  } = parseResult.data;

  const db = await getDb();
  const supervisorId = req.user!.id;
  const orgId = req.user!.orgId;
  const todayStr = parseResult.data.date || String(req.body.date || req.query.date || new Date().toISOString().split('T')[0]);
  const now = new Date();

  const hasValidGps =
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude));

  const safeLat = hasValidGps ? Number(latitude) : null;
  const safeLng = hasValidGps ? Number(longitude) : null;
  const safeAccuracy =
    hasValidGps && reportedAccuracyMeters != null && !isNaN(Number(reportedAccuracyMeters))
      ? Number(reportedAccuracyMeters)
      : null;

  // 1. Fetch active session
  let session: any = null;

  if (rawSessionId) {
    const [foundById] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.id as any, rawSessionId as any),
          eq(attendanceSessions.workerId, supervisorId)
        )
      )
      .limit(1);
    session = foundById;
  }

  // Fallback 1: Find currently open shift (clockOutTime IS NULL)
  if (!session) {
    const [openSession] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.workerId, supervisorId),
          eq(attendanceSessions.orgId, orgId),
          isNull(attendanceSessions.clockOutTime)
        )
      )
      .orderBy(desc(attendanceSessions.createdAt))
      .limit(1);
    session = openSession;
  }

  // Fallback 2: Find by work date
  if (!session) {
    const [byDateSession] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.workerId, supervisorId),
          eq(attendanceSessions.orgId, orgId),
          sql`DATE(${attendanceSessions.workDate}) = ${todayStr}`
        )
      )
      .orderBy(desc(attendanceSessions.createdAt))
      .limit(1);
    session = byDateSession;
  }

  if (!session) {
    return res.status(404).json({
      error: 'NO_ACTIVE_SESSION',
      message: 'Active attendance session not found.',
    });
  }

  if (session.clockOutTime) {
    return res.status(400).json({
      error: 'ALREADY_CLOCKED_OUT',
      message: 'You have already clocked out for today.',
      session,
    });
  }

  // 2. Close any active location visit atomically
  const activeVisits = await db
    .select()
    .from(supervisorLocationVisits)
    .where(
      and(
        eq(supervisorLocationVisits.sessionId, session.id),
        sql`${supervisorLocationVisits.endedAt} IS NULL`
      )
    );

  for (const activeVisit of activeVisits) {
    const startMs = new Date(activeVisit.startedAt).getTime();
    const durationSeconds = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));

    await db
      .update(supervisorLocationVisits)
      .set({
        endedAt: now,
        durationSeconds,
        endLatitude: safeLat,
        endLongitude: safeLng,
        updatedAt: now,
      })
      .where(eq(supervisorLocationVisits.id, activeVisit.id));
  }

  // 3. Compute overall shift duration
  const clockInMs = new Date(session.clockInTime || session.createdAt).getTime();
  const totalDurationSeconds = Math.max(0, Math.floor((now.getTime() - clockInMs) / 1000));

  // 4. Update session to completed
  const [updatedSession] = await db
    .update(attendanceSessions)
    .set({
      clockOutTime: now,
      totalDurationSeconds,
      netWorkingSeconds: totalDurationSeconds,
      activeLocationId: null,
      activeLocationStartedAt: null,
      clockOutLatitude: safeLat,
      clockOutLongitude: safeLng,
      clockOutAccuracy: safeAccuracy,
      status: 'APPROVED',
      isAutoApproved: true,
      approvalSource: 'SYSTEM_AUTO_APPROVAL',
      approvedAt: now,
      updatedAt: now,
    })
    .where(eq(attendanceSessions.id as any, session.id as any))
    .returning();

  // 5. Audit Log
  await logAuditEvent({
    orgId,
    actorId: supervisorId,
    action: 'SUPERVISOR_CLOCK_OUT',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    afterValues: {
      actorNameSnapshot: req.user!.fullName,
      actorRole: 'SUPERVISOR',
      clockInTime: session.clockInTime,
      clockOutTime: now.toISOString(),
      totalDurationSeconds,
      isAutoApproved: true,
      approvalSource: 'SYSTEM_AUTO_APPROVAL',
      gps: safeLat != null ? { latitude: safeLat, longitude: safeLng, accuracy: safeAccuracy } : null,
      clientDeviceInfo,
    },
  });

  return res.status(200).json({
    success: true,
    message: 'Supervisor clocked out successfully. Day duration recorded & auto-approved.',
    session: updatedSession,
  });
}

/**
 * 5. GET /api/attendance/supervisor/active-session
 * Restores state on browser refresh, calculates active duration, and aggregates time per location.
 */
export async function getActiveSession(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const supervisorId = req.user!.id;
  const orgId = req.user!.orgId;
  const userRoles = req.user!.roles || [];
  const targetDate = String(req.query.date || new Date().toISOString().split('T')[0]);
  const now = new Date();

  // Fetch today's session: Check for open active shift first
  let [session] = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.workerId, supervisorId),
        eq(attendanceSessions.orgId, orgId),
        isNull(attendanceSessions.clockOutTime)
      )
    )
    .orderBy(desc(attendanceSessions.createdAt))
    .limit(1);

  if (!session) {
    [session] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.workerId, supervisorId),
          eq(attendanceSessions.orgId, orgId),
          sql`DATE(${attendanceSessions.workDate}) = ${targetDate}`
        )
      )
      .orderBy(desc(attendanceSessions.createdAt))
      .limit(1);
  }

  if (!session) {
    const assignedLocations = await getSupervisorAssignedLocationsHelper(
      db,
      orgId,
      supervisorId,
      targetDate,
      userRoles
    );

    return res.json({
      hasSession: false,
      status: 'NOT_CLOCKED_IN',
      session: null,
      activeLocation: null,
      visits: [],
      locationTotals: [],
      unallocatedDurationSeconds: 0,
      assignedLocations,
    });
  }

  // Fetch all location visits for this session
  const visits = await db
    .select()
    .from(supervisorLocationVisits)
    .where(eq(supervisorLocationVisits.sessionId, session.id))
    .orderBy(supervisorLocationVisits.startedAt);

  // Determine active visit & aggregate durations
  let activeVisit: any = null;
  const locationMap: Record<
    string,
    {
      locationId: string;
      locationName: string;
      totalSeconds: number;
      visitCount: number;
      isActive: boolean;
    }
  > = {};

  for (const v of visits) {
    const isVisitActive = !v.endedAt && !session.clockOutTime;
    let duration = v.durationSeconds;
    if (isVisitActive) {
      const startMs = new Date(v.startedAt).getTime();
      duration = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
      activeVisit = {
        ...v,
        elapsedSeconds: duration,
      };
    }

    if (!locationMap[v.locationId]) {
      locationMap[v.locationId] = {
        locationId: v.locationId,
        locationName: v.locationNameSnapshot,
        totalSeconds: 0,
        visitCount: 0,
        isActive: false,
      };
    }

    locationMap[v.locationId].totalSeconds += duration;
    locationMap[v.locationId].visitCount += 1;
    if (isVisitActive) {
      locationMap[v.locationId].isActive = true;
    }
  }

  // Helper formatting seconds -> HHh MMm SSs
  const formatSecs = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const locationTotals = Object.values(locationMap).map((loc) => ({
    ...loc,
    formattedDuration: formatSecs(loc.totalSeconds),
  }));

  // Overall session elapsed
  const startMs = new Date(session.clockInTime || session.createdAt).getTime();
  const endMs = session.clockOutTime ? new Date(session.clockOutTime).getTime() : now.getTime();
  const totalElapsedSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

  // Calculate unallocated time (duration between clock-in and first location start)
  let unallocatedSeconds = 0;
  if (visits.length === 0 && !session.clockOutTime) {
    unallocatedSeconds = totalElapsedSeconds;
  } else if (visits.length > 0) {
    const firstVisitStart = new Date(visits[0].startedAt).getTime();
    if (firstVisitStart > startMs) {
      unallocatedSeconds = Math.max(0, Math.floor((firstVisitStart - startMs) / 1000));
    }
  }

  const assignedLocations = await getSupervisorAssignedLocationsHelper(
    db,
    orgId,
    supervisorId,
    targetDate,
    userRoles
  );

  return res.json({
    hasSession: true,
    status: session.clockOutTime ? 'SHIFT_DONE' : 'WORKING',
    session: {
      ...session,
      totalElapsedSeconds,
      formattedTotalElapsed: formatSecs(totalElapsedSeconds),
    },
    activeLocation: activeVisit
      ? {
          locationId: activeVisit.locationId,
          locationNameSnapshot: activeVisit.locationNameSnapshot,
          startedAt: activeVisit.startedAt,
          elapsedSeconds: activeVisit.elapsedSeconds,
        }
      : null,
    visits: visits.map((v) => ({
      ...v,
      formattedDuration: formatSecs(
        v.endedAt
          ? v.durationSeconds
          : Math.max(0, Math.floor((now.getTime() - new Date(v.startedAt).getTime()) / 1000))
      ),
    })),
    locationTotals,
    unallocatedDurationSeconds: unallocatedSeconds,
    formattedUnallocatedDuration: formatSecs(unallocatedSeconds),
    assignedLocations,
  });
}

/**
 * 6. GET /api/reports/supervisor-attendance
 * Detailed supervisor attendance, location visits timeline, and totals for Admin inspection.
 */
export async function getSupervisorAttendanceReport(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { startDate, endDate, supervisorId, worksiteId } = req.query;

  // Query supervisor sessions (users where role includes SUPERVISOR, or workerId matches snapshot)
  const query = db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      status: attendanceSessions.status,
      isAutoApproved: attendanceSessions.isAutoApproved,
      autoApprovalReason: attendanceSessions.autoApprovalReason,
      approvalSource: attendanceSessions.approvalSource,
      approvedAt: attendanceSessions.approvedAt,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      totalDurationSeconds: attendanceSessions.totalDurationSeconds,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      clockInLatitude: attendanceSessions.clockInLatitude,
      clockInLongitude: attendanceSessions.clockInLongitude,
      clockInAccuracy: attendanceSessions.clockInAccuracy,
      clockOutLatitude: attendanceSessions.clockOutLatitude,
      clockOutLongitude: attendanceSessions.clockOutLongitude,
      clockOutAccuracy: attendanceSessions.clockOutAccuracy,
      createdAt: attendanceSessions.createdAt,
      supervisorId: users.id,
      supervisorName: users.fullName,
      supervisorEmail: users.email,
      employeeCode: users.employeeCode,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .where(
      and(
        eq(attendanceSessions.orgId as any, orgId as any),
        sql`(${attendanceSessions.isAutoApproved} = true OR ${attendanceSessions.approvalSource} = 'SYSTEM_AUTO_APPROVAL' OR ${attendanceSessions.workerId} = ${attendanceSessions.supervisorSnapshotId})`
      )
    )
    .orderBy(desc(attendanceSessions.workDate), desc(attendanceSessions.createdAt));

  const sessions = await query;

  // Filter in memory for parameters
  let filtered = sessions;
  if (startDate) filtered = filtered.filter((s: any) => String(s.workDate) >= String(startDate));
  if (endDate) filtered = filtered.filter((s: any) => String(s.workDate) <= String(endDate));
  if (supervisorId) filtered = filtered.filter((s: any) => s.supervisorId === String(supervisorId));

  const sessionIds = filtered.map((s: any) => s.id);
  let visitsMap: Record<string, any[]> = {};

  if (sessionIds.length > 0) {
    const allVisits = await db
      .select()
      .from(supervisorLocationVisits)
      .where(sql`${supervisorLocationVisits.sessionId} IN (${sql.join(sessionIds.map((id: string) => sql`${id}`), sql`, `)})`)
      .orderBy(supervisorLocationVisits.startedAt);

    for (const v of allVisits) {
      if (!visitsMap[v.sessionId]) visitsMap[v.sessionId] = [];
      visitsMap[v.sessionId].push(v);
    }
  }

  // Format and aggregate each supervisor session
  const formatSecs = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const results = filtered.map((s: any) => {
    const sessionVisits = visitsMap[s.id] || [];

    // Aggregate location totals
    const locMap: Record<
      string,
      {
        locationId: string;
        locationName: string;
        totalSeconds: number;
        visitCount: number;
      }
    > = {};

    for (const v of sessionVisits) {
      const dur = v.durationSeconds || 0;
      if (!locMap[v.locationId]) {
        locMap[v.locationId] = {
          locationId: v.locationId,
          locationName: v.locationNameSnapshot,
          totalSeconds: 0,
          visitCount: 0,
        };
      }
      locMap[v.locationId].totalSeconds += dur;
      locMap[v.locationId].visitCount += 1;
    }

    const locationTotals = Object.values(locMap).map((l) => ({
      ...l,
      formattedDuration: formatSecs(l.totalSeconds),
      hoursDecimal: Number((l.totalSeconds / 3600).toFixed(2)),
    }));

    return {
      sessionId: s.id,
      supervisorId: s.supervisorId,
      supervisorName: s.supervisorName,
      supervisorEmail: s.supervisorEmail,
      employeeCode: s.employeeCode,
      workDate: s.workDate,
      status: s.status,
      isAutoApproved: s.isAutoApproved,
      approvalSource: s.approvalSource || 'SYSTEM_AUTO_APPROVAL',
      approvedAt: s.approvedAt || s.createdAt,
      clockInTime: s.clockInTime,
      clockOutTime: s.clockOutTime,
      totalDurationSeconds: s.totalDurationSeconds || 0,
      formattedTotalDuration: formatSecs(s.totalDurationSeconds || 0),
      totalHoursDecimal: Number(((s.totalDurationSeconds || 0) / 3600).toFixed(2)),
      clockInGps: s.clockInLatitude != null
        ? {
            latitude: s.clockInLatitude,
            longitude: s.clockInLongitude,
            accuracy: s.clockInAccuracy,
          }
        : null,
      clockOutGps: s.clockOutLatitude != null
        ? {
            latitude: s.clockOutLatitude,
            longitude: s.clockOutLongitude,
            accuracy: s.clockOutAccuracy,
          }
        : null,
      locationVisits: sessionVisits.map((v) => ({
        id: v.id,
        locationId: v.locationId,
        locationName: v.locationNameSnapshot,
        startedAt: v.startedAt,
        endedAt: v.endedAt,
        durationSeconds: v.durationSeconds,
        formattedDuration: formatSecs(v.durationSeconds),
        startGps: v.startLatitude != null ? { latitude: v.startLatitude, longitude: v.startLongitude, accuracy: v.gpsAccuracyMeters } : null,
        endGps: v.endLatitude != null ? { latitude: v.endLatitude, longitude: v.endLongitude } : null,
      })),
      locationTotals,
    };
  });

  // Filter by worksiteId if requested
  const finalResults = worksiteId
    ? results.filter((r) => r.locationVisits.some((v) => v.locationId === String(worksiteId)))
    : results;

  return res.json({
    data: finalResults,
    total: finalResults.length,
  });
}
