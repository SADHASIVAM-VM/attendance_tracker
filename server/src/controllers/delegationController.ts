import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  supervisorDelegations,
  worksites,
  users,
} from '../database/schema.js';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import {
  reassignSiteSupervisor,
  syncDailyDelegationLifecycle,
  getAuthorizedSupervisorScope,
} from '../services/delegationService.js';

const reassignSchema = z.object({
  worksiteId: z.string().uuid(),
  newPrimaryId: z.string().uuid(),
  newSecondaryId: z.string().uuid().nullable().optional(),
  isPermanent: z.boolean().default(false),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().trim().min(5, 'Reassignment reason must be at least 5 characters'),
});

/**
 * GET /admin/delegations
 * Returns all delegations, summary KPIs, uncovered site alerts, and reassignment history.
 */
export async function getAdminDelegations(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { status, worksiteId, assignmentType } = req.query as Record<string, string>;

  // Run lifecycle sync first to ensure active/completed states are fresh
  try {
    await syncDailyDelegationLifecycle(db, orgId);
  } catch (syncErr) {
    console.warn('Delegation lifecycle sync warning:', syncErr);
  }

  // 1. Fetch delegations list
  let query = db
    .select({
      id: supervisorDelegations.id,
      orgId: supervisorDelegations.orgId,
      worksiteId: supervisorDelegations.worksiteId,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      primarySupervisorId: supervisorDelegations.primarySupervisorId,
      primarySupervisorName: sql<string>`u_prim.full_name`,
      primarySupervisorEmail: sql<string>`u_prim.email`,
      delegatedSupervisorId: supervisorDelegations.delegatedSupervisorId,
      delegatedSupervisorName: sql<string>`u_del.full_name`,
      delegatedSupervisorEmail: sql<string>`u_del.email`,
      assignmentType: supervisorDelegations.assignmentType,
      startDate: supervisorDelegations.startDate,
      endDate: supervisorDelegations.endDate,
      status: supervisorDelegations.status,
      isUncovered: supervisorDelegations.isUncovered,
      fallbackAdminId: supervisorDelegations.fallbackAdminId,
      fallbackAdminName: sql<string>`u_admin.full_name`,
      leaveRequestId: supervisorDelegations.leaveRequestId,
      reason: supervisorDelegations.reason,
      notes: supervisorDelegations.notes,
      createdByName: sql<string>`u_creator.full_name`,
      createdAt: supervisorDelegations.createdAt,
      updatedAt: supervisorDelegations.updatedAt,
    })
    .from(supervisorDelegations)
    .innerJoin(worksites, eq(supervisorDelegations.worksiteId, worksites.id))
    .leftJoin(sql`users u_prim`, sql`u_prim.id = ${supervisorDelegations.primarySupervisorId}`)
    .leftJoin(sql`users u_del`, sql`u_del.id = ${supervisorDelegations.delegatedSupervisorId}`)
    .leftJoin(sql`users u_admin`, sql`u_admin.id = ${supervisorDelegations.fallbackAdminId}`)
    .leftJoin(sql`users u_creator`, sql`u_creator.id = ${supervisorDelegations.createdBy}`)
    .where(eq(supervisorDelegations.orgId, orgId))
    .orderBy(desc(supervisorDelegations.createdAt));

  const list = await query;

  let filtered = list;
  if (status && status !== 'ALL') {
    filtered = filtered.filter((d: any) => d.status === status);
  }
  if (worksiteId && worksiteId !== 'ALL') {
    filtered = filtered.filter((d: any) => d.worksiteId === worksiteId);
  }
  if (assignmentType && assignmentType !== 'ALL') {
    filtered = filtered.filter((d: any) => d.assignmentType === assignmentType);
  }

  // 2. Fetch worksite supervisor summary (primary and secondary configured for each site)
  const worksiteSupervisors = await db
    .select({
      id: worksites.id,
      name: worksites.name,
      code: worksites.code,
      primarySupervisorId: worksites.primarySupervisorId,
      primarySupervisorName: sql<string>`u_p.full_name`,
      secondarySupervisorId: worksites.secondarySupervisorId,
      secondarySupervisorName: sql<string>`u_s.full_name`,
      isActive: worksites.isActive,
    })
    .from(worksites)
    .leftJoin(sql`users u_p`, sql`u_p.id = ${worksites.primarySupervisorId}`)
    .leftJoin(sql`users u_s`, sql`u_s.id = ${worksites.secondarySupervisorId}`)
    .where(eq(worksites.orgId, orgId))
    .orderBy(worksites.name);

  // Cross-reference active delegations on worksites
  const activeDelegationMap = new Map<string, any>();
  for (const del of list.filter((d: any) => d.status === 'ACTIVE')) {
    activeDelegationMap.set(del.worksiteId, del);
  }

  const enrichedWorksites = worksiteSupervisors.map((ws: any) => {
    const activeDel = activeDelegationMap.get(ws.id);
    return {
      ...ws,
      activeDelegation: activeDel || null,
      hasActiveDelegation: !!activeDel,
      isCurrentlyUncovered: activeDel?.isUncovered === true,
    };
  });

  // 3. KPI counts
  const totalDelegations = list.length;
  const activeDelegations = list.filter((d: any) => d.status === 'ACTIVE').length;
  const uncoveredDelegations = list.filter((d: any) => d.isUncovered && d.status === 'ACTIVE').length;
  const scheduledDelegations = list.filter((d: any) => d.status === 'SCHEDULED').length;

  return res.json({
    kpis: {
      totalDelegations,
      activeDelegations,
      uncoveredDelegations,
      scheduledDelegations,
    },
    delegations: filtered,
    worksites: enrichedWorksites,
  });
}

/**
 * POST /admin/reassignments
 * Creates a permanent or temporary supervisor reassignment with validation.
 */
export async function createAdminReassignment(req: Request, res: Response): Promise<any> {
  const parseResult = reassignSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid reassignment parameters',
      details: parseResult.error.issues,
    });
  }

  const db = await getDb();
  const actor = req.user!;
  const { worksiteId, newPrimaryId, newSecondaryId, isPermanent, startDate, endDate, reason } = parseResult.data;

  try {
    const result = await reassignSiteSupervisor(db, {
      worksiteId,
      newPrimaryId,
      newSecondaryId: newSecondaryId || null,
      isPermanent,
      startDate,
      endDate,
      reason,
      actorId: actor.id,
      orgId: actor.orgId,
      req,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({
      error: 'REASSIGNMENT_FAILED',
      message: err.message || 'Failed to process supervisor reassignment',
    });
  }
}

/**
 * POST /admin/delegations/sync
 * Manually trigger delegation lifecycle sync.
 */
export async function syncDelegations(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  try {
    const summary = await syncDailyDelegationLifecycle(db, orgId);
    return res.json({ success: true, summary });
  } catch (err: any) {
    return res.status(500).json({ error: 'SYNC_FAILED', message: err.message });
  }
}

/**
 * GET /supervisor/delegated-scope
 * Returns active delegated scope, dates, and covered supervisors for the current logged-in supervisor.
 */
export async function getSupervisorDelegatedScope(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const supervisorId = req.user!.id;
  const orgId = req.user!.orgId;

  try {
    const scope = await getAuthorizedSupervisorScope(db, {
      supervisorId,
      orgId,
    });

    return res.json({
      success: true,
      hasActiveDelegation: scope.activeDelegations.length > 0,
      activeDelegations: scope.activeDelegations,
      primaryWorksiteIds: scope.primaryWorksiteIds,
      delegatedWorksiteIds: scope.delegatedWorksiteIds,
      allWorksiteIds: scope.allWorksiteIds,
      primaryWorkerCount: scope.primaryWorkerIds.length,
      delegatedWorkerCount: scope.delegatedWorkerIds.length,
      totalAuthorizedWorkers: scope.allWorkerIds.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'SCOPE_FETCH_FAILED', message: err.message });
  }
}
