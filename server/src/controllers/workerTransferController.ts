import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  scheduleWorkerTransfer,
  cancelWorkerTransfer,
  updateWorkerTransfer,
  executeDueWorkerTransfers,
  getTransfersList,
  getTransferDetailsById,
  getWorkerTransferAuditHistory,
  getActiveScheduledTransferForWorker,
  TransferValidationError,
  TransferConflictError,
} from '../services/workerTransferService.js';

const scheduleSchema = z.object({
  workerId: z.string().uuid('Invalid worker ID'),
  destinationWorksiteId: z.string().uuid('Invalid destination worksite ID'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters'),
});

const updateSchema = z.object({
  destinationWorksiteId: z.string().uuid().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().trim().min(5).optional(),
});

const cancelSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason must be at least 3 characters'),
});

/**
 * POST /api/v1/worker-transfers
 * Schedule a future-dated worker worksite transfer.
 */
export async function scheduleTransfer(req: Request, res: Response): Promise<any> {
  const parseResult = scheduleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid input data',
      details: parseResult.error.issues,
    });
  }

  const { workerId, destinationWorksiteId, effectiveDate, reason } = parseResult.data;
  const orgId = req.user!.orgId;
  const adminId = req.user!.id;

  try {
    const transfer = await scheduleWorkerTransfer({
      orgId,
      workerId,
      destinationWorksiteId,
      effectiveDate,
      reason,
      adminId,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      message: 'Worker worksite transfer scheduled successfully.',
      transfer,
    });
  } catch (err: any) {
    if (err instanceof TransferValidationError) {
      return res.status(err.statusCode).json({ error: 'VALIDATION_ERROR', message: err.message });
    }
    if (err instanceof TransferConflictError) {
      return res.status(err.statusCode).json({
        error: 'TRANSFER_CONFLICT',
        message: err.message,
        conflicts: err.conflicts,
      });
    }
    console.error('Unhandled error in scheduleTransfer:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || 'Failed to schedule transfer' });
  }
}

/**
 * GET /api/v1/worker-transfers
 * List scheduled and historical transfers with filters.
 */
export async function listTransfers(req: Request, res: Response): Promise<any> {
  const orgId = req.user!.orgId;
  const { status, workerId, worksiteId, startDate, endDate } = req.query as Record<string, string>;

  try {
    const transfers = await getTransfersList(orgId, {
      status,
      workerId,
      worksiteId,
      startDate,
      endDate,
    });

    // Compute status counts for quick UI KPI pills
    const kpis = {
      total: transfers.length,
      scheduled: transfers.filter((t) => t.status === 'SCHEDULED').length,
      completed: transfers.filter((t) => t.status === 'COMPLETED').length,
      cancelled: transfers.filter((t) => t.status === 'CANCELLED').length,
      failed: transfers.filter((t) => t.status === 'FAILED').length,
    };

    return res.json({ transfers, kpis });
  } catch (err: any) {
    console.error('Error in listTransfers:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || 'Failed to list transfers' });
  }
}

/**
 * GET /api/v1/worker-transfers/:id
 * Retrieve single transfer record by ID.
 */
export async function getTransferById(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const orgId = req.user!.orgId;

  try {
    const transfer = await getTransferDetailsById(id, orgId);
    if (!transfer) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Transfer record not found' });
    }
    return res.json(transfer);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
}

/**
 * GET /api/v1/worker-transfers/workers/:workerId/history
 * Retrieve full chronological audit history of transfers for a worker.
 */
export async function getWorkerHistory(req: Request, res: Response): Promise<any> {
  const { workerId } = req.params;
  const orgId = req.user!.orgId;

  try {
    const history = await getWorkerTransferAuditHistory(workerId, orgId);
    return res.json(history);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
}

/**
 * GET /api/v1/worker-transfers/workers/:workerId/scheduled
 * Check if worker currently has an active scheduled transfer.
 */
export async function getWorkerScheduledTransfer(req: Request, res: Response): Promise<any> {
  const { workerId } = req.params;
  const orgId = req.user!.orgId;

  try {
    const scheduled = await getActiveScheduledTransferForWorker(workerId, orgId);
    return res.json({ hasScheduledTransfer: Boolean(scheduled), transfer: scheduled });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
}

/**
 * PATCH /api/v1/worker-transfers/:id
 * Modify a scheduled transfer before execution.
 */
export async function updateTransfer(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = updateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid input data',
    });
  }

  const orgId = req.user!.orgId;
  const adminId = req.user!.id;

  try {
    const updated = await updateWorkerTransfer(id, adminId, parseResult.data, orgId, req.ip);
    return res.json({ message: 'Transfer updated successfully.', transfer: updated });
  } catch (err: any) {
    if (err instanceof TransferValidationError) {
      return res.status(err.statusCode).json({ error: 'VALIDATION_ERROR', message: err.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
}

/**
 * POST /api/v1/worker-transfers/:id/cancel
 * Cancel a scheduled transfer with mandatory reason.
 */
export async function cancelTransfer(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = cancelSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Cancellation reason is required',
    });
  }

  const orgId = req.user!.orgId;
  const adminId = req.user!.id;

  try {
    const cancelled = await cancelWorkerTransfer(id, adminId, parseResult.data.reason, orgId, req.ip);
    return res.json({ message: 'Transfer cancelled successfully.', transfer: cancelled });
  } catch (err: any) {
    if (err instanceof TransferValidationError) {
      return res.status(err.statusCode).json({ error: 'VALIDATION_ERROR', message: err.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
}

/**
 * POST /api/v1/worker-transfers/reconcile
 * Trigger execution check of all due transfers.
 */
export async function reconcileTransfers(req: Request, res: Response): Promise<any> {
  const orgId = req.user!.orgId;
  const db = await getDb();

  try {
    const stats = await executeDueWorkerTransfers(db, orgId);
    return res.json({
      message: 'Transfer reconciliation completed.',
      ...stats,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
}
