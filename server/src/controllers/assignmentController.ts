import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db';
import {
  siteAssignments,
  siteAssignmentWorkers,
  worksites,
  users,
  userRoles,
  leaveRequests,
} from '../database/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit';

const createAssignmentSchema = z.object({
  worksiteId: z.string().uuid(),
  supervisorId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupName: z.string().optional(),
  shiftName: z.string().optional(),
  shiftStartTime: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
  shiftEndTime: z.string().regex(/^\d{2}:\d{2}$/).default('17:00'),
  workerIds: z.array(z.string().uuid()).default([]),
});

const updateWorkersSchema = z.object({
  workerIds: z.array(z.string().uuid()),
});

const cancelAssignmentSchema = z.object({
  reason: z.string().min(3),
});

export async function getAssignments(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { date, month, year, startDate, endDate, worksiteId, supervisorId, status } = req.query;

  let query = db
    .select({
      id: siteAssignments.id,
      orgId: siteAssignments.orgId,
      worksiteId: siteAssignments.worksiteId,
      supervisorId: siteAssignments.supervisorId,
      workDate: siteAssignments.workDate,
      groupName: siteAssignments.groupName,
      shiftName: siteAssignments.shiftName,
      shiftStartTime: siteAssignments.shiftStartTime,
      shiftEndTime: siteAssignments.shiftEndTime,
      status: siteAssignments.status,
      cancellationReason: siteAssignments.cancellationReason,
      publishedAt: siteAssignments.publishedAt,
      createdAt: siteAssignments.createdAt,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      worksiteAddress: worksites.address,
      worksiteLatitude: worksites.latitude,
      worksiteLongitude: worksites.longitude,
      worksiteRadius: worksites.radiusMeters,
      supervisorName: users.fullName,
      supervisorEmail: users.email,
    })
    .from(siteAssignments)
    .innerJoin(worksites, eq(siteAssignments.worksiteId, worksites.id))
    .innerJoin(users, eq(siteAssignments.supervisorId, users.id))
    .where(eq(siteAssignments.orgId as any, orgId as any));

  const assignmentsList = await query;

  let filtered = assignmentsList;
  if (date) filtered = filtered.filter((a: any) => a.workDate === date);
  if (month) filtered = filtered.filter((a: any) => String(a.workDate).startsWith(String(month)));
  if (year) filtered = filtered.filter((a: any) => String(a.workDate).startsWith(String(year)));
  if (startDate && endDate) {
    filtered = filtered.filter((a: any) => a.workDate >= String(startDate) && a.workDate <= String(endDate));
  }
  if (worksiteId) filtered = filtered.filter((a: any) => a.worksiteId === worksiteId);
  if (supervisorId) filtered = filtered.filter((a: any) => a.supervisorId === supervisorId);
  if (status) filtered = filtered.filter((a: any) => a.status === status);

  const assignmentIds = filtered.map((a: any) => a.id);
  let workerMap: Record<string, any[]> = {};

  if (assignmentIds.length > 0) {
    const assignedWorkers = await db
      .select({
        assignmentId: siteAssignmentWorkers.assignmentId,
        workerId: users.id,
        fullName: users.fullName,
        employeeCode: users.employeeCode,
        email: users.email,
      })
      .from(siteAssignmentWorkers)
      .innerJoin(users, eq(siteAssignmentWorkers.workerId, users.id))
      .where(inArray(siteAssignmentWorkers.assignmentId, assignmentIds));

    for (const w of assignedWorkers) {
      if (!workerMap[w.assignmentId]) {
        workerMap[w.assignmentId] = [];
      }
      workerMap[w.assignmentId].push(w);
    }
  }

  const result = filtered.map((a: any) => ({
    ...a,
    groupName: a.groupName || a.shiftName || 'Standard Group',
    workers: workerMap[a.id] || [],
  }));

  return res.json(result);
}

export async function getAssignmentById(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [assignment] = await db
    .select({
      id: siteAssignments.id,
      orgId: siteAssignments.orgId,
      worksiteId: siteAssignments.worksiteId,
      supervisorId: siteAssignments.supervisorId,
      workDate: siteAssignments.workDate,
      groupName: siteAssignments.groupName,
      shiftName: siteAssignments.shiftName,
      shiftStartTime: siteAssignments.shiftStartTime,
      shiftEndTime: siteAssignments.shiftEndTime,
      status: siteAssignments.status,
      cancellationReason: siteAssignments.cancellationReason,
      publishedAt: siteAssignments.publishedAt,
      createdAt: siteAssignments.createdAt,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      worksiteAddress: worksites.address,
      worksiteLatitude: worksites.latitude,
      worksiteLongitude: worksites.longitude,
      worksiteRadius: worksites.radiusMeters,
      supervisorName: users.fullName,
    })
    .from(siteAssignments)
    .innerJoin(worksites, eq(siteAssignments.worksiteId, worksites.id))
    .innerJoin(users, eq(siteAssignments.supervisorId, users.id))
    .where(and(eq(siteAssignments.id as any, id as any), eq(siteAssignments.orgId as any, orgId as any)))
    .limit(1);

  if (!assignment) {
    return res.status(404).json({ error: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' });
  }

  const assignedWorkers = await db
    .select({
      workerId: users.id,
      fullName: users.fullName,
      employeeCode: users.employeeCode,
      email: users.email,
    })
    .from(siteAssignmentWorkers)
    .innerJoin(users, eq(siteAssignmentWorkers.workerId, users.id))
    .where(eq(siteAssignmentWorkers.assignmentId as any, id as any));

  return res.json({
    ...assignment,
    groupName: assignment.groupName || assignment.shiftName || 'Standard Group',
    workers: assignedWorkers,
  });
}

export async function createAssignment(req: Request, res: Response): Promise<any> {
  const parseResult = createAssignmentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const data = parseResult.data;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [site] = await db
    .select()
    .from(worksites)
    .where(and(eq(worksites.id as any, data.worksiteId as any), eq(worksites.orgId as any, orgId as any)))
    .limit(1);

  if (!site || !site.isActive) {
    return res.status(400).json({ error: 'WORKSITE_INACTIVE', message: 'Worksite is inactive or not found' });
  }

  const supervisorRole = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId as any, data.supervisorId as any), eq(userRoles.role as any, 'SUPERVISOR' as any)))
    .limit(1);

  if (supervisorRole.length === 0) {
    return res.status(400).json({ error: 'INVALID_SUPERVISOR', message: 'Selected user is not an active supervisor' });
  }

  const groupName = data.groupName?.trim() || data.shiftName?.trim() || 'General Group';
  const shiftName = data.shiftName?.trim() || data.groupName?.trim() || 'Standard Shift';

  const [newAssignment] = await db
    .insert(siteAssignments)
    .values({
      orgId,
      worksiteId: data.worksiteId,
      supervisorId: data.supervisorId,
      workDate: data.workDate,
      groupName,
      shiftName,
      shiftStartTime: data.shiftStartTime || '08:00',
      shiftEndTime: data.shiftEndTime || '17:00',
      status: 'DRAFT',
      createdBy: req.user!.id,
    })
    .returning();

  if (data.workerIds.length > 0) {
    for (const wId of data.workerIds) {
      await db.insert(siteAssignmentWorkers).values({
        assignmentId: newAssignment.id,
        workerId: wId,
      });
    }
  }

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'CREATE_ASSIGNMENT',
    entityType: 'SITE_ASSIGNMENT',
    entityId: newAssignment.id,
    afterValues: { ...newAssignment, workerCount: data.workerIds.length },
    ipAddress: req.ip,
  });

  return res.status(201).json(newAssignment);
}

export async function updateAssignmentWorkers(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = updateWorkersSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { workerIds } = parseResult.data;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [assignment] = await db
    .select()
    .from(siteAssignments)
    .where(and(eq(siteAssignments.id as any, id as any), eq(siteAssignments.orgId as any, orgId as any)))
    .limit(1);

  if (!assignment) {
    return res.status(404).json({ error: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' });
  }

  await db.delete(siteAssignmentWorkers).where(eq(siteAssignmentWorkers.assignmentId as any, id as any));

  for (const wId of workerIds) {
    await db.insert(siteAssignmentWorkers).values({
      assignmentId: id,
      workerId: wId,
    });
  }

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'UPDATE_ASSIGNMENT_WORKERS',
    entityType: 'SITE_ASSIGNMENT',
    entityId: id,
    afterValues: { workerCount: workerIds.length },
    ipAddress: req.ip,
  });

  return res.json({ success: true, workerCount: workerIds.length });
}

export async function publishAssignment(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [assignment] = await db
    .select()
    .from(siteAssignments)
    .where(and(eq(siteAssignments.id as any, id as any), eq(siteAssignments.orgId as any, orgId as any)))
    .limit(1);

  if (!assignment) {
    return res.status(404).json({ error: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' });
  }

  if (assignment.status === 'PUBLISHED') {
    return res.status(400).json({ error: 'ALREADY_PUBLISHED', message: 'Assignment is already published' });
  }

  const [updated] = await db
    .update(siteAssignments)
    .set({
      status: 'PUBLISHED',
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(siteAssignments.id as any, id as any))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'PUBLISH_ASSIGNMENT',
    entityType: 'SITE_ASSIGNMENT',
    entityId: id,
    ipAddress: req.ip as any,
  });

  return res.json(updated);
}

export async function cancelAssignment(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = cancelAssignmentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { reason } = parseResult.data;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [assignment] = await db
    .select()
    .from(siteAssignments)
    .where(and(eq(siteAssignments.id as any, id as any), eq(siteAssignments.orgId as any, orgId as any)))
    .limit(1);

  if (!assignment) {
    return res.status(404).json({ error: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' });
  }

  const [updated] = await db
    .update(siteAssignments)
    .set({
      status: 'CANCELLED',
      cancellationReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(siteAssignments.id as any, id as any))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'CANCEL_ASSIGNMENT',
    entityType: 'SITE_ASSIGNMENT',
    entityId: id,
    afterValues: { reason },
    ipAddress: req.ip as any,
  });

  return res.json(updated);
}

export async function getWorkerMyAssignments(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const workerId = req.user!.id;
  const todayStr = new Date().toISOString().split('T')[0];

  const assignments = await db
    .select({
      id: siteAssignments.id,
      workDate: siteAssignments.workDate,
      shiftName: siteAssignments.shiftName,
      shiftStartTime: siteAssignments.shiftStartTime,
      shiftEndTime: siteAssignments.shiftEndTime,
      status: siteAssignments.status,
      worksiteId: worksites.id,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      worksiteAddress: worksites.address,
      worksiteLatitude: worksites.latitude,
      worksiteLongitude: worksites.longitude,
      worksiteRadius: worksites.radiusMeters,
      worksiteMaxAccuracy: worksites.maxAccuracyMeters,
      supervisorId: users.id,
      supervisorName: users.fullName,
      supervisorEmail: users.email,
    })
    .from(siteAssignmentWorkers)
    .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
    .innerJoin(worksites, eq(siteAssignments.worksiteId, worksites.id))
    .innerJoin(users, eq(siteAssignments.supervisorId, users.id))
    .where(
      and(
        eq(siteAssignmentWorkers.workerId as any, workerId as any),
        eq(siteAssignments.status as any, 'PUBLISHED' as any),
        eq(siteAssignments.workDate as any, todayStr as any)
      )
    );

  return res.json(assignments);
}
