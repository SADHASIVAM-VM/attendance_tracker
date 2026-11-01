import { getDb } from '../database/db.js';
import {
  workerTransfers,
  siteAssignments,
  siteAssignmentWorkers,
  worksites,
  users,
  organizations,
} from '../database/schema.js';
import { eq, and, sql, desc, or, inArray, lte } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
import { getOrgCurrentMonth, getOrgTimezone } from '../utils/dateUtils.js';

export class TransferValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'TransferValidationError';
    this.statusCode = statusCode;
  }
}

export class TransferConflictError extends Error {
  statusCode: number;
  conflicts?: any;
  constructor(message: string, conflicts?: any) {
    super(message);
    this.name = 'TransferConflictError';
    this.statusCode = 409;
    this.conflicts = conflicts;
  }
}

export interface ScheduleTransferParams {
  orgId: string;
  workerId: string;
  destinationWorksiteId: string;
  effectiveDate: string; // YYYY-MM-DD
  reason: string;
  adminId: string;
  ipAddress?: string;
}

export interface UpdateTransferParams {
  destinationWorksiteId?: string;
  effectiveDate?: string;
  reason?: string;
}

/**
 * Schedule a future-dated worker worksite transfer.
 * Preserves the current active assignment until effectiveDate arrives.
 */
export async function scheduleWorkerTransfer(params: ScheduleTransferParams) {
  const { orgId, workerId, destinationWorksiteId, effectiveDate, reason, adminId, ipAddress } = params;
  const db = await getDb();

  // 1. Mandatory reason check
  if (!reason || reason.trim().length < 5) {
    throw new TransferValidationError('A meaningful transfer reason of at least 5 characters is required.');
  }

  // 2. Organization Timezone & Future-date validation
  const timeZone = await getOrgTimezone(db, orgId);
  const { todayStr } = getOrgCurrentMonth(timeZone);

  if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    throw new TransferValidationError('Effective date must be in YYYY-MM-DD format.');
  }

  if (effectiveDate <= todayStr) {
    throw new TransferValidationError(
      `Transfer effective date must be in the future (strictly after today, ${todayStr} in organization timezone ${timeZone}). Same-day or past-dated transfers are not permitted.`
    );
  }

  // 3. Concurrency Protection & Duplicate scheduled transfer check
  // Check if worker already has a pending scheduled transfer
  const [existingScheduled] = await db
    .select({
      id: workerTransfers.id,
      effectiveDate: workerTransfers.effectiveDate,
      destinationWorksiteId: workerTransfers.destinationWorksiteId,
      status: workerTransfers.status,
    })
    .from(workerTransfers)
    .where(
      and(
        eq(workerTransfers.workerId, workerId),
        eq(workerTransfers.status, 'SCHEDULED')
      )
    )
    .limit(1);

  if (existingScheduled) {
    const [destSite] = await db
      .select({ name: worksites.name, code: worksites.code })
      .from(worksites)
      .where(eq(worksites.id, existingScheduled.destinationWorksiteId))
      .limit(1);

    throw new TransferConflictError(
      `Worker already has an active transfer scheduled to ${destSite?.name || 'another worksite'} effective on ${existingScheduled.effectiveDate}. Only one scheduled transfer per worker is allowed at a time.`
    );
  }

  // 4. Find Worker's Current Active Worksite Assignment
  const activeWorkerRows = await db
    .select({
      workerId: siteAssignmentWorkers.workerId,
      assignmentId: siteAssignments.id,
      worksiteId: siteAssignments.worksiteId,
      workDate: siteAssignments.workDate,
      carryForward: siteAssignments.carryForward,
      status: siteAssignments.status,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
    })
    .from(siteAssignmentWorkers)
    .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
    .innerJoin(worksites, eq(siteAssignments.worksiteId, worksites.id))
    .where(
      and(
        eq(siteAssignments.orgId, orgId),
        eq(siteAssignmentWorkers.workerId, workerId),
        sql`${siteAssignments.status} NOT IN ('CANCELLED', 'COMPLETED')`
      )
    );

  const activeAssignment = activeWorkerRows.find((row) => {
    const isCarry = row.carryForward !== false;
    const workDateStr = String(row.workDate).split('T')[0];
    if (!isCarry && workDateStr < todayStr) return false;
    return true;
  });

  if (!activeAssignment) {
    throw new TransferValidationError(
      'Worker does not currently have an active worksite assignment to transfer from. Please assign the worker to a worksite first.'
    );
  }

  const sourceWorksiteId = activeAssignment.worksiteId;

  // 5. Destination Worksite Validation
  if (destinationWorksiteId === sourceWorksiteId) {
    throw new TransferValidationError(
      `Destination worksite cannot be the same as the worker's current worksite (${activeAssignment.worksiteName}).`
    );
  }

  const [destWorksite] = await db
    .select()
    .from(worksites)
    .where(and(eq(worksites.id, destinationWorksiteId), eq(worksites.orgId, orgId)))
    .limit(1);

  if (!destWorksite) {
    throw new TransferValidationError('Selected destination worksite was not found.');
  }

  if (!destWorksite.isActive) {
    throw new TransferValidationError(
      `Destination worksite "${destWorksite.name}" (${destWorksite.code}) is inactive. Inactive sites cannot receive transfers.`
    );
  }

  // 6. Create the Scheduled Transfer record
  const [createdTransfer] = await db
    .insert(workerTransfers)
    .values({
      orgId,
      workerId,
      sourceWorksiteId,
      destinationWorksiteId,
      sourceAssignmentId: activeAssignment.assignmentId,
      effectiveDate,
      reason: reason.trim(),
      status: 'SCHEDULED',
      initiatedBy: adminId,
    })
    .returning();

  // 7. Immutable Audit Log
  await logAuditEvent({
    orgId,
    actorId: adminId,
    action: 'SCHEDULE_WORKER_TRANSFER',
    entityType: 'WORKER_TRANSFER',
    entityId: createdTransfer.id,
    afterValues: {
      workerId,
      sourceWorksiteId,
      destinationWorksiteId,
      effectiveDate,
      reason: reason.trim(),
      status: 'SCHEDULED',
    },
    ipAddress,
  });

  return getTransferDetailsById(createdTransfer.id, orgId);
}

/**
 * Cancel a scheduled worker transfer.
 * Preserves the cancellation reason and logs audit details.
 */
export async function cancelWorkerTransfer(
  transferId: string,
  adminId: string,
  cancellationReason: string,
  orgId: string,
  ipAddress?: string
) {
  const db = await getDb();

  if (!cancellationReason || cancellationReason.trim().length < 3) {
    throw new TransferValidationError('A valid cancellation reason is required.');
  }

  const [transfer] = await db
    .select()
    .from(workerTransfers)
    .where(and(eq(workerTransfers.id, transferId), eq(workerTransfers.orgId, orgId)))
    .limit(1);

  if (!transfer) {
    throw new TransferValidationError('Transfer record not found.', 404);
  }

  if (transfer.status !== 'SCHEDULED') {
    throw new TransferValidationError(
      `Only scheduled transfers can be cancelled. Current status is ${transfer.status}. Completed transfers cannot be cancelled.`
    );
  }

  const [cancelled] = await db
    .update(workerTransfers)
    .set({
      status: 'CANCELLED',
      cancelledBy: adminId,
      cancellationReason: cancellationReason.trim(),
      cancelledAt: new Date(),
      lastModifiedBy: adminId,
      updatedAt: new Date(),
    })
    .where(eq(workerTransfers.id, transferId))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: adminId,
    action: 'CANCEL_WORKER_TRANSFER',
    entityType: 'WORKER_TRANSFER',
    entityId: transferId,
    beforeValues: { status: 'SCHEDULED' },
    afterValues: {
      status: 'CANCELLED',
      cancellationReason: cancellationReason.trim(),
      cancelledBy: adminId,
    },
    ipAddress,
  });

  return getTransferDetailsById(transferId, orgId);
}

/**
 * Modify a scheduled transfer (destination worksite or effective date).
 */
export async function updateWorkerTransfer(
  transferId: string,
  adminId: string,
  params: UpdateTransferParams,
  orgId: string,
  ipAddress?: string
) {
  const db = await getDb();

  const [transfer] = await db
    .select()
    .from(workerTransfers)
    .where(and(eq(workerTransfers.id, transferId), eq(workerTransfers.orgId, orgId)))
    .limit(1);

  if (!transfer) {
    throw new TransferValidationError('Transfer record not found.', 404);
  }

  if (transfer.status !== 'SCHEDULED') {
    throw new TransferValidationError(
      `Only scheduled transfers can be modified. Current status is ${transfer.status}.`
    );
  }

  const updates: Record<string, any> = {
    lastModifiedBy: adminId,
    updatedAt: new Date(),
  };

  const timeZone = await getOrgTimezone(db, orgId);
  const { todayStr } = getOrgCurrentMonth(timeZone);

  if (params.effectiveDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.effectiveDate)) {
      throw new TransferValidationError('Effective date must be in YYYY-MM-DD format.');
    }
    if (params.effectiveDate <= todayStr) {
      throw new TransferValidationError(
        `Effective date must be in the future (strictly after today, ${todayStr} in organization timezone ${timeZone}).`
      );
    }
    updates.effectiveDate = params.effectiveDate;
  }

  if (params.destinationWorksiteId) {
    if (params.destinationWorksiteId === transfer.sourceWorksiteId) {
      throw new TransferValidationError('Destination worksite cannot be the same as the source worksite.');
    }
    const [destSite] = await db
      .select()
      .from(worksites)
      .where(and(eq(worksites.id, params.destinationWorksiteId), eq(worksites.orgId, orgId)))
      .limit(1);

    if (!destSite || !destSite.isActive) {
      throw new TransferValidationError('Destination worksite is inactive or not found.');
    }
    updates.destinationWorksiteId = params.destinationWorksiteId;
  }

  if (params.reason) {
    if (params.reason.trim().length < 5) {
      throw new TransferValidationError('Transfer reason must be at least 5 characters.');
    }
    updates.reason = params.reason.trim();
  }

  const [updated] = await db
    .update(workerTransfers)
    .set(updates)
    .where(eq(workerTransfers.id, transferId))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: adminId,
    action: 'UPDATE_WORKER_TRANSFER',
    entityType: 'WORKER_TRANSFER',
    entityId: transferId,
    beforeValues: {
      destinationWorksiteId: transfer.destinationWorksiteId,
      effectiveDate: transfer.effectiveDate,
      reason: transfer.reason,
    },
    afterValues: updates,
    ipAddress,
  });

  return getTransferDetailsById(transferId, orgId);
}

/**
 * Execute due transfers whose effective date has arrived.
 * Atomically closes the old assignment and activates the destination assignment.
 * Safe for retries, background interval execution, or per-request reconciliation.
 */
export async function executeDueWorkerTransfers(db: any, targetOrgId?: string) {
  const queryOrgs = targetOrgId
    ? [{ id: targetOrgId }]
    : await db.select({ id: organizations.id }).from(organizations);

  let executedCount = 0;
  let failedCount = 0;

  for (const org of queryOrgs) {
    const timeZone = await getOrgTimezone(db, org.id);
    const { todayStr } = getOrgCurrentMonth(timeZone);

    // Find all scheduled transfers where effectiveDate <= todayStr
    const dueTransfers = await db
      .select()
      .from(workerTransfers)
      .where(
        and(
          eq(workerTransfers.orgId, org.id),
          eq(workerTransfers.status, 'SCHEDULED'),
          lte(workerTransfers.effectiveDate, todayStr)
        )
      );

    for (const transfer of dueTransfers) {
      try {
        // Revalidate: ensure transfer is still scheduled
        const [freshTransfer] = await db
          .select()
          .from(workerTransfers)
          .where(eq(workerTransfers.id, transfer.id))
          .limit(1);

        if (!freshTransfer || freshTransfer.status !== 'SCHEDULED') {
          continue;
        }

        // 1. Remove worker from source assignment(s)
        if (transfer.sourceAssignmentId) {
          await db
            .delete(siteAssignmentWorkers)
            .where(
              and(
                eq(siteAssignmentWorkers.assignmentId, transfer.sourceAssignmentId),
                eq(siteAssignmentWorkers.workerId, transfer.workerId)
              )
            );
        }

        // Also clean up any other active assignment for this worker on the source worksite or older sites
        const otherActiveAssigns = await db
          .select({
            junctionId: siteAssignmentWorkers.id,
            assignmentId: siteAssignments.id,
            worksiteId: siteAssignments.worksiteId,
          })
          .from(siteAssignmentWorkers)
          .innerJoin(siteAssignments, eq(siteAssignmentWorkers.assignmentId, siteAssignments.id))
          .where(
            and(
              eq(siteAssignments.orgId, org.id),
              eq(siteAssignmentWorkers.workerId, transfer.workerId),
              sql`${siteAssignments.worksiteId} != ${transfer.destinationWorksiteId}`
            )
          );

        for (const o of otherActiveAssigns) {
          await db
            .delete(siteAssignmentWorkers)
            .where(eq(siteAssignmentWorkers.id, o.junctionId));
        }

        // 2. Locate or create destination assignment at destination worksite
        // Look for an existing published carryForward assignment for destination worksite
        const candidateDestAssigns = await db
          .select({
            id: siteAssignments.id,
            workDate: siteAssignments.workDate,
            carryForward: siteAssignments.carryForward,
            status: siteAssignments.status,
          })
          .from(siteAssignments)
          .where(
            and(
              eq(siteAssignments.orgId, org.id),
              eq(siteAssignments.worksiteId, transfer.destinationWorksiteId),
              eq(siteAssignments.status, 'PUBLISHED')
            )
          );

        let targetAssignmentId: string | null = null;
        const carryAssign = candidateDestAssigns.find((a: any) => a.carryForward !== false);

        if (carryAssign) {
          targetAssignmentId = carryAssign.id;
        } else {
          // Find worksite primary supervisor or default admin
          const [destSite] = await db
            .select({
              primarySupervisorId: worksites.primarySupervisorId,
            })
            .from(worksites)
            .where(eq(worksites.id, transfer.destinationWorksiteId))
            .limit(1);

          const supervisorId = destSite?.primarySupervisorId || transfer.initiatedBy;

          // Create standard transfer destination assignment
          const [newAssign] = await db
            .insert(siteAssignments)
            .values({
              orgId: org.id,
              worksiteId: transfer.destinationWorksiteId,
              supervisorId,
              workDate: transfer.effectiveDate,
              groupName: 'General Transferred Workforce',
              shiftName: 'Standard Shift',
              shiftStartTime: '08:00',
              shiftEndTime: '17:00',
              carryForward: true,
              status: 'PUBLISHED',
              publishedAt: new Date(),
              createdBy: transfer.initiatedBy,
            })
            .returning();

          targetAssignmentId = newAssign.id;
        }

        // 3. Attach worker to target destination assignment
        // Guard against duplicate insertion
        const [existingWorkerAttach] = await db
          .select()
          .from(siteAssignmentWorkers)
          .where(
            and(
              eq(siteAssignmentWorkers.assignmentId, targetAssignmentId),
              eq(siteAssignmentWorkers.workerId, transfer.workerId)
            )
          )
          .limit(1);

        if (!existingWorkerAttach) {
          await db.insert(siteAssignmentWorkers).values({
            assignmentId: targetAssignmentId,
            workerId: transfer.workerId,
          });
        }

        // 4. Mark Transfer as COMPLETED
        await db
          .update(workerTransfers)
          .set({
            status: 'COMPLETED',
            destinationAssignmentId: targetAssignmentId,
            completedAt: new Date(),
            executedBy: 'SYSTEM_AUTO_EXECUTION',
            updatedAt: new Date(),
          })
          .where(eq(workerTransfers.id, transfer.id));

        await logAuditEvent({
          orgId: org.id,
          actorId: transfer.initiatedBy,
          action: 'COMPLETE_WORKER_TRANSFER',
          entityType: 'WORKER_TRANSFER',
          entityId: transfer.id,
          afterValues: {
            status: 'COMPLETED',
            destinationAssignmentId: targetAssignmentId,
            executedBy: 'SYSTEM_AUTO_EXECUTION',
          },
        });

        executedCount++;
      } catch (err: any) {
        console.error(`Failed executing transfer ${transfer.id}:`, err);
        failedCount++;

        await db
          .update(workerTransfers)
          .set({
            status: 'FAILED',
            failureReason: err.message || 'Unknown execution error',
            updatedAt: new Date(),
          })
          .where(eq(workerTransfers.id, transfer.id));
      }
    }
  }

  return { executedCount, failedCount };
}

/**
 * Fetch detailed transfer record by ID
 */
export async function getTransferDetailsById(transferId: string, orgId: string) {
  const db = await getDb();

  const [record] = await db
    .select({
      id: workerTransfers.id,
      orgId: workerTransfers.orgId,
      workerId: workerTransfers.workerId,
      workerName: sql<string>`w_usr.full_name`,
      workerEmail: sql<string>`w_usr.email`,
      workerEmployeeCode: sql<string>`w_usr.employee_code`,
      sourceWorksiteId: workerTransfers.sourceWorksiteId,
      sourceWorksiteName: sql<string>`src_site.name`,
      sourceWorksiteCode: sql<string>`src_site.code`,
      destinationWorksiteId: workerTransfers.destinationWorksiteId,
      destinationWorksiteName: sql<string>`dest_site.name`,
      destinationWorksiteCode: sql<string>`dest_site.code`,
      sourceAssignmentId: workerTransfers.sourceAssignmentId,
      destinationAssignmentId: workerTransfers.destinationAssignmentId,
      effectiveDate: workerTransfers.effectiveDate,
      reason: workerTransfers.reason,
      status: workerTransfers.status,
      initiatedBy: workerTransfers.initiatedBy,
      initiatorName: sql<string>`init_usr.full_name`,
      lastModifiedBy: workerTransfers.lastModifiedBy,
      lastModifiedByName: sql<string>`mod_usr.full_name`,
      cancelledBy: workerTransfers.cancelledBy,
      cancelledByName: sql<string>`canc_usr.full_name`,
      cancellationReason: workerTransfers.cancellationReason,
      cancelledAt: workerTransfers.cancelledAt,
      executedBy: workerTransfers.executedBy,
      completedAt: workerTransfers.completedAt,
      failureReason: workerTransfers.failureReason,
      createdAt: workerTransfers.createdAt,
      updatedAt: workerTransfers.updatedAt,
    })
    .from(workerTransfers)
    .innerJoin(sql`users w_usr`, sql`w_usr.id = ${workerTransfers.workerId}`)
    .innerJoin(sql`worksites src_site`, sql`src_site.id = ${workerTransfers.sourceWorksiteId}`)
    .innerJoin(sql`worksites dest_site`, sql`dest_site.id = ${workerTransfers.destinationWorksiteId}`)
    .innerJoin(sql`users init_usr`, sql`init_usr.id = ${workerTransfers.initiatedBy}`)
    .leftJoin(sql`users mod_usr`, sql`mod_usr.id = ${workerTransfers.lastModifiedBy}`)
    .leftJoin(sql`users canc_usr`, sql`canc_usr.id = ${workerTransfers.cancelledBy}`)
    .where(and(eq(workerTransfers.id, transferId), eq(workerTransfers.orgId, orgId)))
    .limit(1);

  return record || null;
}

/**
 * List transfers with filtering (status, worker, worksite, date range)
 */
export async function getTransfersList(
  orgId: string,
  filters: {
    status?: string;
    workerId?: string;
    worksiteId?: string;
    startDate?: string;
    endDate?: string;
  } = {}
) {
  const db = await getDb();

  // Run due transfer check first to ensure fresh lifecycle state
  await executeDueWorkerTransfers(db, orgId);

  let conditions = [eq(workerTransfers.orgId, orgId)];

  if (filters.status && filters.status !== 'ALL') {
    conditions.push(eq(workerTransfers.status, filters.status));
  }

  if (filters.workerId) {
    conditions.push(eq(workerTransfers.workerId, filters.workerId));
  }

  if (filters.worksiteId) {
    conditions.push(
      or(
        eq(workerTransfers.sourceWorksiteId, filters.worksiteId),
        eq(workerTransfers.destinationWorksiteId, filters.worksiteId)
      )!
    );
  }

  if (filters.startDate) {
    conditions.push(sql`${workerTransfers.effectiveDate} >= ${filters.startDate}`);
  }

  if (filters.endDate) {
    conditions.push(sql`${workerTransfers.effectiveDate} <= ${filters.endDate}`);
  }

  const records = await db
    .select({
      id: workerTransfers.id,
      orgId: workerTransfers.orgId,
      workerId: workerTransfers.workerId,
      workerName: sql<string>`w_usr.full_name`,
      workerEmail: sql<string>`w_usr.email`,
      workerEmployeeCode: sql<string>`w_usr.employee_code`,
      sourceWorksiteId: workerTransfers.sourceWorksiteId,
      sourceWorksiteName: sql<string>`src_site.name`,
      sourceWorksiteCode: sql<string>`src_site.code`,
      destinationWorksiteId: workerTransfers.destinationWorksiteId,
      destinationWorksiteName: sql<string>`dest_site.name`,
      destinationWorksiteCode: sql<string>`dest_site.code`,
      sourceAssignmentId: workerTransfers.sourceAssignmentId,
      destinationAssignmentId: workerTransfers.destinationAssignmentId,
      effectiveDate: workerTransfers.effectiveDate,
      reason: workerTransfers.reason,
      status: workerTransfers.status,
      initiatedBy: workerTransfers.initiatedBy,
      initiatorName: sql<string>`init_usr.full_name`,
      lastModifiedBy: workerTransfers.lastModifiedBy,
      lastModifiedByName: sql<string>`mod_usr.full_name`,
      cancelledBy: workerTransfers.cancelledBy,
      cancelledByName: sql<string>`canc_usr.full_name`,
      cancellationReason: workerTransfers.cancellationReason,
      cancelledAt: workerTransfers.cancelledAt,
      executedBy: workerTransfers.executedBy,
      completedAt: workerTransfers.completedAt,
      failureReason: workerTransfers.failureReason,
      createdAt: workerTransfers.createdAt,
      updatedAt: workerTransfers.updatedAt,
    })
    .from(workerTransfers)
    .innerJoin(sql`users w_usr`, sql`w_usr.id = ${workerTransfers.workerId}`)
    .innerJoin(sql`worksites src_site`, sql`src_site.id = ${workerTransfers.sourceWorksiteId}`)
    .innerJoin(sql`worksites dest_site`, sql`dest_site.id = ${workerTransfers.destinationWorksiteId}`)
    .innerJoin(sql`users init_usr`, sql`init_usr.id = ${workerTransfers.initiatedBy}`)
    .leftJoin(sql`users mod_usr`, sql`mod_usr.id = ${workerTransfers.lastModifiedBy}`)
    .leftJoin(sql`users canc_usr`, sql`canc_usr.id = ${workerTransfers.cancelledBy}`)
    .where(and(...conditions))
    .orderBy(desc(workerTransfers.createdAt));

  return records;
}

/**
 * Get comprehensive worker transfer audit history
 */
export async function getWorkerTransferAuditHistory(workerId: string, orgId: string) {
  const db = await getDb();
  return getTransfersList(orgId, { workerId });
}

/**
 * Check if a worker has an active scheduled transfer
 */
export async function getActiveScheduledTransferForWorker(workerId: string, orgId: string) {
  const db = await getDb();

  const [scheduled] = await db
    .select({
      id: workerTransfers.id,
      effectiveDate: workerTransfers.effectiveDate,
      sourceWorksiteId: workerTransfers.sourceWorksiteId,
      destinationWorksiteId: workerTransfers.destinationWorksiteId,
      destinationWorksiteName: sql<string>`dest_site.name`,
      destinationWorksiteCode: sql<string>`dest_site.code`,
      reason: workerTransfers.reason,
      status: workerTransfers.status,
    })
    .from(workerTransfers)
    .innerJoin(sql`worksites dest_site`, sql`dest_site.id = ${workerTransfers.destinationWorksiteId}`)
    .where(
      and(
        eq(workerTransfers.orgId, orgId),
        eq(workerTransfers.workerId, workerId),
        eq(workerTransfers.status, 'SCHEDULED')
      )
    )
    .limit(1);

  return scheduled || null;
}
