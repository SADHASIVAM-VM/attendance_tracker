import { eq, and, or, sql, desc, inArray, gte, lte, isNull } from 'drizzle-orm';
import {
  supervisorDelegations,
  worksites,
  siteAssignments,
  siteAssignmentWorkers,
  attendanceSessions,
  leaveRequests,
  attendanceAdjustmentRequests,
  attendanceExceptions,
  users,
  userRoles,
  notifications,
  approvalActions,
} from '../database/schema.js';
import { logAuditEvent } from '../utils/audit.js';

export interface EvaluateLeaveDelegationParams {
  leaveRequestId: string;
  supervisorId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  orgId: string;
  actorId: string;
  req?: any;
}

export interface ReassignSiteSupervisorParams {
  worksiteId: string;
  newPrimaryId: string;
  newSecondaryId?: string | null;
  isPermanent: boolean;
  startDate?: string;
  endDate?: string;
  reason: string;
  actorId: string;
  orgId: string;
  req?: any;
}

/**
 * Idempotently creates a notification only if one with the same type, userId, and entityId doesn't exist
 */
async function sendIdempotentNotification(
  db: any,
  params: {
    userId: string;
    title: string;
    message: string;
    type: string;
    entityType: string;
    entityId: string;
  }
) {
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, params.userId),
        eq(notifications.type, params.type),
        eq(notifications.entityId, params.entityId)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(notifications).values(params);
  }
}

/**
 * Evaluates supervisor leave coverage when a supervisor's leave request is approved.
 * 1. Identifies all affected sites, workers, and pending tasks.
 * 2. Checks configured secondary supervisor for site & dates.
 * 3. Activates or schedules temporary delegation.
 * 4. If no backup, flags as uncovered, notifies admin, and routes to admin fallback.
 */
export async function evaluateAndCreateLeaveDelegation(
  db: any,
  params: EvaluateLeaveDelegationParams
): Promise<{
  createdDelegations: any[];
  uncoveredCount: number;
  routedPendingCount: number;
}> {
  const { leaveRequestId, supervisorId, startDate, endDate, orgId, actorId, req } = params;
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Find all sites where this supervisor is primary or assigned
  // Check worksites where supervisor is primary
  const primaryWorksites = await db
    .select()
    .from(worksites)
    .where(
      and(
        eq(worksites.orgId, orgId),
        eq(worksites.primarySupervisorId, supervisorId),
        eq(worksites.isActive, true)
      )
    );

  // Also check active site assignments in date range or carryForward
  const activeAssignments = await db
    .select({
      worksiteId: siteAssignments.worksiteId,
      fallbackSupervisorId: siteAssignments.fallbackSupervisorId,
    })
    .from(siteAssignments)
    .where(
      and(
        eq(siteAssignments.orgId, orgId),
        eq(siteAssignments.supervisorId, supervisorId),
        sql`${siteAssignments.status} NOT IN ('CANCELLED', 'COMPLETED')`
      )
    );

  // Consolidate unique worksite IDs
  const worksiteMap = new Map<string, { worksiteId: string; secondaryId?: string | null }>();

  for (const ws of primaryWorksites) {
    worksiteMap.set(ws.id, {
      worksiteId: ws.id,
      secondaryId: ws.secondarySupervisorId,
    });
  }

  for (const asgn of activeAssignments) {
    if (!worksiteMap.has(asgn.worksiteId)) {
      const [wsRow] = await db
        .select()
        .from(worksites)
        .where(eq(worksites.id, asgn.worksiteId))
        .limit(1);
      worksiteMap.set(asgn.worksiteId, {
        worksiteId: asgn.worksiteId,
        secondaryId: wsRow?.secondarySupervisorId || asgn.fallbackSupervisorId,
      });
    } else if (asgn.fallbackSupervisorId && !worksiteMap.get(asgn.worksiteId)!.secondaryId) {
      worksiteMap.get(asgn.worksiteId)!.secondaryId = asgn.fallbackSupervisorId;
    }
  }

  // 2. Fetch admin users for fallback routing if uncovered
  const adminUsers = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
    })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .where(
      and(
        eq(users.orgId, orgId),
        eq(users.isActive, true),
        sql`${userRoles.role} IN ('ADMIN', 'SUPER_ADMIN')`
      )
    );

  const fallbackAdminId = adminUsers[0]?.id || actorId;
  const createdDelegations: any[] = [];
  let uncoveredCount = 0;
  let routedPendingCount = 0;

  for (const [wsId, wsInfo] of worksiteMap.entries()) {
    let candidateSecondaryId = wsInfo.secondaryId;

    // Validate candidate secondary supervisor eligibility
    let isSecondaryEligible = false;
    if (candidateSecondaryId && candidateSecondaryId !== supervisorId) {
      const [secUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, candidateSecondaryId), eq(users.isActive, true)))
        .limit(1);

      if (secUser) {
        // Check if secondary supervisor is also on approved leave during this period
        const [overlappingLeave] = await db
          .select({ id: leaveRequests.id })
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.userId, candidateSecondaryId),
              eq(leaveRequests.status, 'APPROVED'),
              sql`${leaveRequests.startDate} <= ${endDate}`,
              sql`${leaveRequests.endDate} >= ${startDate}`
            )
          )
          .limit(1);

        if (!overlappingLeave) {
          isSecondaryEligible = true;
        }
      }
    }

    const isUncovered = !isSecondaryEligible;
    const delegatedSupervisorId = isSecondaryEligible ? candidateSecondaryId! : null;
    const shouldBeActive = startDate <= todayStr;
    const initialStatus = shouldBeActive ? 'ACTIVE' : 'SCHEDULED';

    if (isUncovered) {
      uncoveredCount++;
    }

    // Insert supervisor delegation record
    const [delegation] = await db
      .insert(supervisorDelegations)
      .values({
        orgId,
        worksiteId: wsId,
        primarySupervisorId: supervisorId,
        delegatedSupervisorId,
        assignmentType: 'LEAVE_COVERAGE',
        startDate,
        endDate,
        status: initialStatus,
        isUncovered,
        fallbackAdminId: isUncovered ? fallbackAdminId : null,
        leaveRequestId,
        reason: isUncovered
          ? 'Supervisor on approved leave; no configured backup supervisor available. Routed to Admin fallback.'
          : 'Approved supervisor leave coverage delegation',
        createdBy: actorId,
      })
      .returning();

    createdDelegations.push(delegation);

    // If active immediately, route pending approval tasks
    const effectiveApproverId = isSecondaryEligible ? delegatedSupervisorId! : fallbackAdminId;

    if (shouldBeActive && effectiveApproverId) {
      // A. Reassign pending attendance sessions
      const updatedSessions = await db
        .update(attendanceSessions)
        .set({
          currentApproverId: effectiveApproverId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(attendanceSessions.orgId, orgId),
            eq(attendanceSessions.status, 'PENDING'),
            eq(attendanceSessions.worksiteSnapshotId, wsId),
            or(
              eq(attendanceSessions.currentApproverId, supervisorId),
              eq(attendanceSessions.supervisorSnapshotId, supervisorId)
            )
          )
        )
        .returning({ id: attendanceSessions.id });

      routedPendingCount += updatedSessions.length;

      // B. Reassign pending leave requests for workers at this site
      const workerRows = await db
        .select({ workerId: siteAssignmentWorkers.workerId })
        .from(siteAssignmentWorkers)
        .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
        .where(
          and(
            eq(siteAssignments.orgId, orgId),
            eq(siteAssignments.worksiteId, wsId)
          )
        );
      const workerIds = Array.from(new Set(workerRows.map((r: any) => r.workerId)));

      if (workerIds.length > 0) {
        await db
          .update(leaveRequests)
          .set({
            currentApproverId: effectiveApproverId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(leaveRequests.orgId, orgId),
              eq(leaveRequests.status, 'PENDING'),
              inArray(leaveRequests.userId, workerIds),
              or(
                eq(leaveRequests.currentApproverId, supervisorId),
                isNull(leaveRequests.currentApproverId)
              )
            )
          );
      }

      // C. Reassign pending regularization requests
      await db
        .update(attendanceAdjustmentRequests)
        .set({
          currentApproverId: effectiveApproverId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(attendanceAdjustmentRequests.status, 'PENDING'),
            eq(attendanceAdjustmentRequests.currentApproverId, supervisorId)
          )
        );

      // D. Reassign open attendance exceptions
      await db
        .update(attendanceExceptions)
        .set({
          currentApproverId: effectiveApproverId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(attendanceExceptions.orgId, orgId),
            sql`${attendanceExceptions.status} IN ('OPEN', 'INVESTIGATING')`,
            eq(attendanceExceptions.worksiteId, wsId),
            eq(attendanceExceptions.currentApproverId, supervisorId)
          )
        );

      // Notifications
      if (!isUncovered && delegatedSupervisorId) {
        await sendIdempotentNotification(db, {
          userId: delegatedSupervisorId,
          title: 'Delegation Activated: Supervisor Leave Coverage',
          message: `You are temporarily delegated as site supervisor for worksite coverage from ${startDate} to ${endDate}.`,
          type: 'SUPERVISOR_DELEGATION_ACTIVATED',
          entityType: 'SUPERVISOR_DELEGATION',
          entityId: delegation.id,
        });
      }
    }

    // If uncovered, send urgent alert to all admins
    if (isUncovered) {
      for (const admin of adminUsers) {
        await sendIdempotentNotification(db, {
          userId: admin.id,
          title: 'ACTION REQUIRED: Supervisor Leave Uncovered',
          message: `Supervisor leave from ${startDate} to ${endDate} has NO configured backup supervisor for site. Responsibilities have been routed to Admin fallback.`,
          type: 'SUPERVISOR_LEAVE_UNCOVERED',
          entityType: 'SUPERVISOR_DELEGATION',
          entityId: delegation.id,
        });
      }
    }
  }

  // Audit log
  await logAuditEvent({
    orgId,
    actorId,
    action: 'SUPERVISOR_LEAVE_DELEGATION_EVALUATED',
    entityType: 'SUPERVISOR_DELEGATION',
    entityId: leaveRequestId,
    reason: `Evaluated leave coverage for supervisor from ${startDate} to ${endDate}. Created ${createdDelegations.length} delegation(s), ${uncoveredCount} uncovered.`,
    afterValues: {
      leaveRequestId,
      supervisorId,
      startDate,
      endDate,
      delegationCount: createdDelegations.length,
      uncoveredCount,
      routedPendingCount,
    },
    req,
  });

  return { createdDelegations, uncoveredCount, routedPendingCount };
}

/**
 * Handles cancelled, revoked, or shortened supervisor leave.
 * Restores pending approvals back to primary supervisor if not superseded.
 */
export async function cancelOrUpdateLeaveDelegation(
  db: any,
  params: {
    leaveRequestId: string;
    reason: string;
    actorId: string;
    req?: any;
  }
): Promise<{ cancelledCount: number; restoredCount: number }> {
  const { leaveRequestId, reason, actorId, req } = params;

  const delegations = await db
    .select()
    .from(supervisorDelegations)
    .where(
      and(
        eq(supervisorDelegations.leaveRequestId, leaveRequestId),
        sql`${supervisorDelegations.status} IN ('ACTIVE', 'SCHEDULED')`
      )
    );

  let cancelledCount = 0;
  let restoredCount = 0;

  for (const del of delegations) {
    // Check if superseded by newer permanent assignment
    const [newerPermanent] = await db
      .select({ id: supervisorDelegations.id })
      .from(supervisorDelegations)
      .where(
        and(
          eq(supervisorDelegations.worksiteId, del.worksiteId),
          eq(supervisorDelegations.assignmentType, 'PERMANENT_REASSIGNMENT'),
          sql`${supervisorDelegations.createdAt} > ${del.createdAt}`
        )
      )
      .limit(1);

    if (newerPermanent) {
      await db
        .update(supervisorDelegations)
        .set({
          status: 'SUPERSEDED',
          notes: `Leave cancelled but site has already been permanently reassigned: ${reason}`,
          updatedAt: new Date(),
        })
        .where(eq(supervisorDelegations.id, del.id));
      continue;
    }

    // Cancel delegation
    await db
      .update(supervisorDelegations)
      .set({
        status: 'CANCELLED',
        notes: `Cancelled due to leave revocation/cancellation: ${reason}`,
        updatedAt: new Date(),
      })
      .where(eq(supervisorDelegations.id, del.id));

    cancelledCount++;

    // Restore pending approvals back to primary supervisor
    const effectiveDelegatedId = del.delegatedSupervisorId || del.fallbackAdminId;
    if (del.status === 'ACTIVE' && effectiveDelegatedId) {
      const restoredSessions = await db
        .update(attendanceSessions)
        .set({
          currentApproverId: del.primarySupervisorId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(attendanceSessions.status, 'PENDING'),
            eq(attendanceSessions.worksiteSnapshotId, del.worksiteId),
            eq(attendanceSessions.currentApproverId, effectiveDelegatedId)
          )
        )
        .returning({ id: attendanceSessions.id });

      restoredCount += restoredSessions.length;

      // Notify delegated supervisor
      if (del.delegatedSupervisorId) {
        await sendIdempotentNotification(db, {
          userId: del.delegatedSupervisorId,
          title: 'Delegation Ended Early',
          message: `Your temporary coverage for worksite has ended early because the supervisor leave was cancelled: ${reason}`,
          type: 'SUPERVISOR_DELEGATION_ENDED',
          entityType: 'SUPERVISOR_DELEGATION',
          entityId: del.id,
        });
      }

      // Notify primary supervisor
      await sendIdempotentNotification(db, {
        userId: del.primarySupervisorId,
        title: 'Supervisor Responsibilities Restored',
        message: 'Your leave was cancelled or ended. Your site supervisor approval queues have been restored.',
        type: 'SUPERVISOR_RETURN_RESTORED',
        entityType: 'SUPERVISOR_DELEGATION',
        entityId: del.id,
      });
    }
  }

  await logAuditEvent({
    orgId: delegations[0]?.orgId || (req?.user?.orgId ?? ''),
    actorId,
    action: 'CANCEL_SUPERVISOR_LEAVE_DELEGATION',
    entityType: 'SUPERVISOR_DELEGATION',
    entityId: leaveRequestId,
    reason,
    afterValues: { cancelledCount, restoredCount },
    req,
  });

  return { cancelledCount, restoredCount };
}

/**
 * Admin manual reassignment of primary & secondary supervisors to a site.
 * Supports permanent or temporary reassignment with effective dates & mandatory reason.
 * Validates eligibility, active status, date overlaps, and preserves historical records.
 */
export async function reassignSiteSupervisor(
  db: any,
  params: ReassignSiteSupervisorParams
): Promise<{
  success: boolean;
  delegation?: any;
  message: string;
}> {
  const {
    worksiteId,
    newPrimaryId,
    newSecondaryId,
    isPermanent,
    startDate: rawStartDate,
    endDate: rawEndDate,
    reason,
    actorId,
    orgId,
    req,
  } = params;

  // 1. Mandatory reason validation
  if (!reason || reason.trim().length < 5) {
    throw new Error('A mandatory, meaningful reassignment reason of at least 5 characters is required.');
  }

  // 2. Worksite existence check
  const [ws] = await db
    .select()
    .from(worksites)
    .where(and(eq(worksites.id, worksiteId), eq(worksites.orgId, orgId)))
    .limit(1);

  if (!ws) {
    throw new Error('Worksite not found.');
  }

  // 3. Supervisor eligibility check
  const [primaryUser] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      isActive: users.isActive,
    })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .where(
      and(
        eq(users.id, newPrimaryId),
        eq(users.orgId, orgId),
        sql`${userRoles.role} IN ('SUPERVISOR', 'ADMIN', 'SUPER_ADMIN')`
      )
    )
    .limit(1);

  if (!primaryUser || !primaryUser.isActive) {
    throw new Error('Selected primary supervisor is invalid, inactive, or lacks supervisor role.');
  }

  if (newSecondaryId) {
    if (newSecondaryId === newPrimaryId) {
      throw new Error('Primary and Secondary supervisor cannot be the same person.');
    }
    const [secondaryUser] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        isActive: users.isActive,
      })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .where(
        and(
          eq(users.id, newSecondaryId),
          eq(users.orgId, orgId),
          sql`${userRoles.role} IN ('SUPERVISOR', 'ADMIN', 'SUPER_ADMIN')`
        )
      )
      .limit(1);

    if (!secondaryUser || !secondaryUser.isActive) {
      throw new Error('Selected secondary supervisor is invalid, inactive, or lacks supervisor role.');
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const previousPrimaryId = ws.primarySupervisorId || null;

  if (isPermanent) {
    // ─── PERMANENT REASSIGNMENT ─────────────────────────────────────────────
    // A. Supersede any active or scheduled delegations on this worksite
    await db
      .update(supervisorDelegations)
      .set({
        status: 'SUPERSEDED',
        notes: `Superseded by permanent reassignment to ${primaryUser.fullName}: ${reason}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supervisorDelegations.worksiteId, worksiteId),
          sql`${supervisorDelegations.status} IN ('ACTIVE', 'SCHEDULED')`
        )
      );

    // B. Update worksite primary & secondary supervisor configuration
    await db
      .update(worksites)
      .set({
        primarySupervisorId: newPrimaryId,
        secondarySupervisorId: newSecondaryId || null,
        updatedAt: new Date(),
      })
      .where(eq(worksites.id, worksiteId));

    // C. Update active / published siteAssignments for this worksite
    await db
      .update(siteAssignments)
      .set({
        supervisorId: newPrimaryId,
        fallbackSupervisorId: newSecondaryId || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(siteAssignments.worksiteId, worksiteId),
          sql`${siteAssignments.status} NOT IN ('CANCELLED', 'COMPLETED')`
        )
      );

    // D. Create permanent reassignment audit delegation record
    const [delegation] = await db
      .insert(supervisorDelegations)
      .values({
        orgId,
        worksiteId,
        primarySupervisorId: newPrimaryId,
        delegatedSupervisorId: null,
        assignmentType: 'PERMANENT_REASSIGNMENT',
        startDate: todayStr,
        endDate: null,
        status: 'ACTIVE',
        isUncovered: false,
        reason,
        notes: `Permanently reassigned supervisor from ${previousPrimaryId || 'Unassigned'} to ${newPrimaryId}`,
        createdBy: actorId,
      })
      .returning();

    // E. Route pending approvals to new primary supervisor
    await db
      .update(attendanceSessions)
      .set({
        currentApproverId: newPrimaryId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(attendanceSessions.orgId, orgId),
          eq(attendanceSessions.status, 'PENDING'),
          eq(attendanceSessions.worksiteSnapshotId, worksiteId)
        )
      );

    // Notifications
    await sendIdempotentNotification(db, {
      userId: newPrimaryId,
      title: 'Permanent Supervisor Assignment',
      message: `You have been permanently assigned as the Primary Supervisor for ${ws.name}. Reason: ${reason}`,
      type: 'SUPERVISOR_ASSIGNMENT_CHANGED',
      entityType: 'WORKSITE',
      entityId: worksiteId,
    });

    if (previousPrimaryId && previousPrimaryId !== newPrimaryId) {
      await sendIdempotentNotification(db, {
        userId: previousPrimaryId,
        title: 'Supervisor Assignment Replaced',
        message: `Your primary supervisor assignment for ${ws.name} has been permanently reassigned to ${primaryUser.fullName}.`,
        type: 'SUPERVISOR_ASSIGNMENT_CHANGED',
        entityType: 'WORKSITE',
        entityId: worksiteId,
      });
    }

    await logAuditEvent({
      orgId,
      actorId,
      action: 'ADMIN_PERMANENT_SUPERVISOR_REASSIGNMENT',
      entityType: 'WORKSITE',
      entityId: worksiteId,
      reason,
      beforeValues: {
        primarySupervisorId: previousPrimaryId,
        secondarySupervisorId: ws.secondarySupervisorId,
      },
      afterValues: {
        primarySupervisorId: newPrimaryId,
        secondarySupervisorId: newSecondaryId,
        isPermanent: true,
      },
      req,
    });

    return {
      success: true,
      delegation,
      message: `Worksite ${ws.name} permanently reassigned to ${primaryUser.fullName}.`,
    };
  } else {
    // ─── TEMPORARY REASSIGNMENT ─────────────────────────────────────────────
    const startDate = rawStartDate || todayStr;
    const endDate = rawEndDate;

    if (!endDate || startDate > endDate) {
      throw new Error('Temporary reassignment requires a valid date range where start date <= end date.');
    }

    // Check for conflicting active temporary delegations with overlapping dates
    const [overlap] = await db
      .select({ id: supervisorDelegations.id })
      .from(supervisorDelegations)
      .where(
        and(
          eq(supervisorDelegations.worksiteId, worksiteId),
          sql`${supervisorDelegations.status} IN ('ACTIVE', 'SCHEDULED')`,
          sql`${supervisorDelegations.startDate} <= ${endDate}`,
          sql`COALESCE(${supervisorDelegations.endDate}, '9999-12-31') >= ${startDate}`
        )
      )
      .limit(1);

    if (overlap) {
      throw new Error('An active or scheduled supervisor assignment already overlaps with this date range.');
    }

    const isActiveNow = startDate <= todayStr;
    const initialStatus = isActiveNow ? 'ACTIVE' : 'SCHEDULED';

    // Insert temporary delegation record
    const [delegation] = await db
      .insert(supervisorDelegations)
      .values({
        orgId,
        worksiteId,
        primarySupervisorId: previousPrimaryId || actorId,
        delegatedSupervisorId: newPrimaryId,
        assignmentType: 'TEMPORARY_REASSIGNMENT',
        startDate,
        endDate,
        status: initialStatus,
        isUncovered: false,
        reason,
        createdBy: actorId,
      })
      .returning();

    // If active now, route pending approval tasks
    if (isActiveNow) {
      await db
        .update(attendanceSessions)
        .set({
          currentApproverId: newPrimaryId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(attendanceSessions.orgId, orgId),
            eq(attendanceSessions.status, 'PENDING'),
            eq(attendanceSessions.worksiteSnapshotId, worksiteId)
          )
        );

      await sendIdempotentNotification(db, {
        userId: newPrimaryId,
        title: 'Temporary Supervisor Delegation Activated',
        message: `You have been temporarily assigned as supervisor for ${ws.name} from ${startDate} to ${endDate}. Reason: ${reason}`,
        type: 'SUPERVISOR_DELEGATION_ACTIVATED',
        entityType: 'SUPERVISOR_DELEGATION',
        entityId: delegation.id,
      });
    }

    await logAuditEvent({
      orgId,
      actorId,
      action: 'ADMIN_TEMPORARY_SUPERVISOR_REASSIGNMENT',
      entityType: 'SUPERVISOR_DELEGATION',
      entityId: delegation.id,
      reason,
      afterValues: {
        worksiteId,
        delegatedSupervisorId: newPrimaryId,
        startDate,
        endDate,
        status: initialStatus,
      },
      req,
    });

    return {
      success: true,
      delegation,
      message: `Temporary supervisor delegation created for ${ws.name} (${startDate} to ${endDate}).`,
    };
  }
}

/**
 * Routine/lifecycle runner to sync delegations daily:
 * - Activates scheduled delegations whose start date has arrived.
 * - Expires / completes ended delegations and restores primary supervisor (if not superseded).
 */
export async function syncDailyDelegationLifecycle(db: any, orgId?: string): Promise<{
  activatedCount: number;
  completedCount: number;
}> {
  const todayStr = new Date().toISOString().split('T')[0];
  const orgFilter = orgId ? eq(supervisorDelegations.orgId, orgId) : sql`1=1`;

  // 1. Activate scheduled delegations whose start date has arrived
  const toActivate = await db
    .select()
    .from(supervisorDelegations)
    .where(
      and(
        orgFilter,
        eq(supervisorDelegations.status, 'SCHEDULED'),
        sql`${supervisorDelegations.startDate} <= ${todayStr}`
      )
    );

  let activatedCount = 0;
  for (const del of toActivate) {
    await db
      .update(supervisorDelegations)
      .set({
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
      .where(eq(supervisorDelegations.id, del.id));

    activatedCount++;

    const effectiveApprover = del.delegatedSupervisorId || del.fallbackAdminId;
    if (effectiveApprover) {
      await db
        .update(attendanceSessions)
        .set({
          currentApproverId: effectiveApprover,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(attendanceSessions.status, 'PENDING'),
            eq(attendanceSessions.worksiteSnapshotId, del.worksiteId),
            or(
              eq(attendanceSessions.currentApproverId, del.primarySupervisorId),
              eq(attendanceSessions.supervisorSnapshotId, del.primarySupervisorId)
            )
          )
        );

      if (del.delegatedSupervisorId) {
        await sendIdempotentNotification(db, {
          userId: del.delegatedSupervisorId,
          title: 'Delegation Activated Today',
          message: `Your scheduled supervisor coverage for worksite started today (${todayStr}) and is now active.`,
          type: 'SUPERVISOR_DELEGATION_ACTIVATED',
          entityType: 'SUPERVISOR_DELEGATION',
          entityId: del.id,
        });
      }
    }
  }

  // 2. Complete active delegations whose end date has passed
  const toComplete = await db
    .select()
    .from(supervisorDelegations)
    .where(
      and(
        orgFilter,
        eq(supervisorDelegations.status, 'ACTIVE'),
        sql`${supervisorDelegations.endDate} IS NOT NULL`,
        sql`${supervisorDelegations.endDate} < ${todayStr}`
      )
    );

  let completedCount = 0;
  for (const del of toComplete) {
    const [newerPermanent] = await db
      .select({ id: supervisorDelegations.id })
      .from(supervisorDelegations)
      .where(
        and(
          eq(supervisorDelegations.worksiteId, del.worksiteId),
          eq(supervisorDelegations.assignmentType, 'PERMANENT_REASSIGNMENT'),
          sql`${supervisorDelegations.createdAt} > ${del.createdAt}`
        )
      )
      .limit(1);

    await db
      .update(supervisorDelegations)
      .set({
        status: 'COMPLETED',
        updatedAt: new Date(),
      })
      .where(eq(supervisorDelegations.id, del.id));

    completedCount++;

    // Restore primary supervisor ONLY if not superseded
    if (!newerPermanent) {
      const effectiveDelegated = del.delegatedSupervisorId || del.fallbackAdminId;
      if (effectiveDelegated) {
        await db
          .update(attendanceSessions)
          .set({
            currentApproverId: del.primarySupervisorId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(attendanceSessions.status, 'PENDING'),
              eq(attendanceSessions.worksiteSnapshotId, del.worksiteId),
              eq(attendanceSessions.currentApproverId, effectiveDelegated)
            )
          );

        // Notify primary supervisor
        await sendIdempotentNotification(db, {
          userId: del.primarySupervisorId,
          title: 'Welcome Back: Supervisor Queue Restored',
          message: 'Your coverage period has ended. Approval tasks have returned to your active queue.',
          type: 'SUPERVISOR_RETURN_RESTORED',
          entityType: 'SUPERVISOR_DELEGATION',
          entityId: del.id,
        });

        // Notify secondary supervisor
        if (del.delegatedSupervisorId) {
          await sendIdempotentNotification(db, {
            userId: del.delegatedSupervisorId,
            title: 'Delegation Completed',
            message: 'Your temporary supervisor delegation coverage has concluded.',
            type: 'SUPERVISOR_DELEGATION_ENDED',
            entityType: 'SUPERVISOR_DELEGATION',
            entityId: del.id,
          });
        }
      }
    }
  }

  return { activatedCount, completedCount };
}

/**
 * Returns full authorized supervisor scope, combining primary assignments
 * and active temporary delegations.
 */
export async function getAuthorizedSupervisorScope(
  db: any,
  params: { supervisorId: string; orgId: string; targetDate?: string }
): Promise<{
  primaryWorksiteIds: string[];
  delegatedWorksiteIds: string[];
  allWorksiteIds: string[];
  primaryWorkerIds: string[];
  delegatedWorkerIds: string[];
  allWorkerIds: string[];
  activeDelegations: any[];
}> {
  const { supervisorId, orgId, targetDate = new Date().toISOString().split('T')[0] } = params;

  // 1. Primary worksites: direct worksite config or active site assignments
  const wsDirect = await db
    .select({ id: worksites.id })
    .from(worksites)
    .where(
      and(
        eq(worksites.orgId, orgId),
        eq(worksites.primarySupervisorId, supervisorId),
        eq(worksites.isActive, true)
      )
    );

  const primarySiteAssignments = await db
    .select({ worksiteId: siteAssignments.worksiteId })
    .from(siteAssignments)
    .where(
      and(
        eq(siteAssignments.orgId, orgId),
        eq(siteAssignments.supervisorId, supervisorId),
        sql`${siteAssignments.status} NOT IN ('CANCELLED')`
      )
    );

  const primaryWorksiteIds = Array.from(
    new Set([...wsDirect.map((w: any) => w.id), ...primarySiteAssignments.map((a: any) => a.worksiteId)])
  );

  // 2. Delegated worksites: active delegations where supervisor is delegated
  const activeDelegations = await db
    .select({
      id: supervisorDelegations.id,
      worksiteId: supervisorDelegations.worksiteId,
      primarySupervisorId: supervisorDelegations.primarySupervisorId,
      assignmentType: supervisorDelegations.assignmentType,
      startDate: supervisorDelegations.startDate,
      endDate: supervisorDelegations.endDate,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      primarySupervisorName: users.fullName,
    })
    .from(supervisorDelegations)
    .innerJoin(worksites, eq(supervisorDelegations.worksiteId, worksites.id))
    .innerJoin(users, eq(supervisorDelegations.primarySupervisorId, users.id))
    .where(
      and(
        eq(supervisorDelegations.orgId, orgId),
        eq(supervisorDelegations.delegatedSupervisorId, supervisorId),
        eq(supervisorDelegations.status, 'ACTIVE'),
        sql`${supervisorDelegations.startDate} <= ${targetDate}`,
        sql`(${supervisorDelegations.endDate} IS NULL OR ${supervisorDelegations.endDate} >= ${targetDate})`
      )
    );

  const delegatedWorksiteIds = Array.from(new Set(activeDelegations.map((d: any) => d.worksiteId)));
  const allWorksiteIds = Array.from(new Set([...primaryWorksiteIds, ...delegatedWorksiteIds]));

  // 3. Primary worker IDs
  let primaryWorkerIds: string[] = [];
  if (primaryWorksiteIds.length > 0) {
    const primaryWorkerRows = await db
      .select({ workerId: siteAssignmentWorkers.workerId })
      .from(siteAssignmentWorkers)
      .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
      .where(
        and(
          eq(siteAssignments.orgId, orgId),
          inArray(siteAssignments.worksiteId, primaryWorksiteIds)
        )
      );
    primaryWorkerIds = Array.from(new Set(primaryWorkerRows.map((r: any) => r.workerId)));
  }

  // 4. Delegated worker IDs
  let delegatedWorkerIds: string[] = [];
  if (delegatedWorksiteIds.length > 0) {
    const delegatedWorkerRows = await db
      .select({ workerId: siteAssignmentWorkers.workerId })
      .from(siteAssignmentWorkers)
      .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
      .where(
        and(
          eq(siteAssignments.orgId, orgId),
          inArray(siteAssignments.worksiteId, delegatedWorksiteIds)
        )
      );
    delegatedWorkerIds = Array.from(new Set(delegatedWorkerRows.map((r: any) => r.workerId)));
  }

  const allWorkerIds = Array.from(new Set([...primaryWorkerIds, ...delegatedWorkerIds]));

  return {
    primaryWorksiteIds,
    delegatedWorksiteIds,
    allWorksiteIds,
    primaryWorkerIds,
    delegatedWorkerIds,
    allWorkerIds,
    activeDelegations,
  };
}

/**
 * Checks whether a supervisor has active delegation authority for a specific worksite or worker.
 */
export async function isSupervisorDelegatedForScope(
  db: any,
  params: {
    supervisorId: string;
    worksiteId?: string;
    workerId?: string;
    targetDate?: string;
    orgId: string;
  }
): Promise<{ isDelegated: boolean; delegation?: any }> {
  const { supervisorId, worksiteId, workerId, targetDate = new Date().toISOString().split('T')[0], orgId } = params;

  let candidateWorksiteIds: string[] = [];
  if (worksiteId) {
    candidateWorksiteIds.push(worksiteId);
  }

  if (workerId && candidateWorksiteIds.length === 0) {
    const workerSites = await db
      .select({ worksiteId: siteAssignments.worksiteId })
      .from(siteAssignmentWorkers)
      .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
      .where(
        and(
          eq(siteAssignments.orgId, orgId),
          eq(siteAssignmentWorkers.workerId, workerId),
          sql`${siteAssignments.status} NOT IN ('CANCELLED')`
        )
      );
    candidateWorksiteIds = workerSites.map((s: any) => s.worksiteId);
  }

  if (candidateWorksiteIds.length === 0) {
    return { isDelegated: false };
  }

  const [del] = await db
    .select()
    .from(supervisorDelegations)
    .where(
      and(
        eq(supervisorDelegations.orgId, orgId),
        eq(supervisorDelegations.delegatedSupervisorId, supervisorId),
        eq(supervisorDelegations.status, 'ACTIVE'),
        inArray(supervisorDelegations.worksiteId, candidateWorksiteIds),
        sql`${supervisorDelegations.startDate} <= ${targetDate}`,
        sql`(${supervisorDelegations.endDate} IS NULL OR ${supervisorDelegations.endDate} >= ${targetDate})`
      )
    )
    .limit(1);

  return { isDelegated: !!del, delegation: del };
}
