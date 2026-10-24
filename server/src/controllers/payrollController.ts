import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import {
  payrollPeriods,
  payrollAdjustments,
  attendanceSessions,
  siteExpenses,
  users,
  worksites,
  attendanceAdjustmentRequests,
} from '../database/schema.js';
import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
import { formatMinutes } from '../services/overtimeService.js';

const createPeriodSchema = z.object({
  name: z.string().min(1, 'Payroll period name is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
});

const adjustmentSchema = z.object({
  workerId: z.string().uuid('Valid worker ID is required'),
  adjustmentType: z.enum(['HOURS', 'OVERTIME', 'EXPENSE', 'DEDUCTION', 'BONUS']),
  amountOrMinutes: z.number().refine((val) => val !== 0, 'Adjustment amount or minutes cannot be zero'),
  reason: z.string().min(1, 'Mandatory reason is required for payroll adjustment'),
});

/**
 * GET /payroll/periods
 * List all payroll periods for organization
 */
export async function getPayrollPeriods(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  const periods = await db
    .select({
      id: payrollPeriods.id,
      name: payrollPeriods.name,
      startDate: payrollPeriods.startDate,
      endDate: payrollPeriods.endDate,
      status: payrollPeriods.status,
      totalWorkers: payrollPeriods.totalWorkers,
      totalStandardMinutes: payrollPeriods.totalStandardMinutes,
      totalWorkedMinutes: payrollPeriods.totalWorkedMinutes,
      totalCalculatedOtMinutes: payrollPeriods.totalCalculatedOtMinutes,
      totalApprovedOtMinutes: payrollPeriods.totalApprovedOtMinutes,
      totalApprovedExpenses: payrollPeriods.totalApprovedExpenses,
      exceptionCount: payrollPeriods.exceptionCount,
      finalizedAt: payrollPeriods.finalizedAt,
      finalizedBy: payrollPeriods.finalizedBy,
      createdAt: payrollPeriods.createdAt,
      finalizedByName: users.fullName,
    })
    .from(payrollPeriods)
    .leftJoin(users, eq(payrollPeriods.finalizedBy, users.id))
    .where(eq(payrollPeriods.orgId as any, orgId as any))
    .orderBy(desc(payrollPeriods.startDate));

  const mapped = periods.map((p: any) => ({
    id: p.id,
    name: p.name,
    startDate: typeof p.startDate === 'string' ? p.startDate.split('T')[0] : new Date(p.startDate).toISOString().split('T')[0],
    endDate: typeof p.endDate === 'string' ? p.endDate.split('T')[0] : new Date(p.endDate).toISOString().split('T')[0],
    status: p.status,
    totalWorkers: p.totalWorkers,
    totalStandardHoursFormatted: formatMinutes(p.totalStandardMinutes),
    totalWorkedHoursFormatted: formatMinutes(p.totalWorkedMinutes),
    totalCalculatedOtFormatted: formatMinutes(p.totalCalculatedOtMinutes),
    totalApprovedOtFormatted: formatMinutes(p.totalApprovedOtMinutes),
    totalApprovedExpenses: p.totalApprovedExpenses,
    exceptionCount: p.exceptionCount,
    finalizedAt: p.finalizedAt,
    finalizedByName: p.finalizedByName,
  }));

  return res.json(mapped);
}

/**
 * POST /payroll/periods
 * Create new payroll period and calculate eligible totals and exception flags
 */
export async function createPayrollPeriod(req: Request, res: Response): Promise<any> {
  const parseResult = createPeriodSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const { name, startDate, endDate } = parseResult.data;
  if (startDate > endDate) {
    return res.status(400).json({ error: 'INVALID_DATE_RANGE', message: 'startDate cannot be after endDate' });
  }

  const db = await getDb();
  const orgId = req.user!.orgId;

  // Scan attendance sessions in this date range
  const sessions = await db
    .select({
      id: attendanceSessions.id,
      workerId: attendanceSessions.workerId,
      status: attendanceSessions.status,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      standardHoursMinutes: attendanceSessions.standardHoursMinutes,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      calculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      approvedOtMinutes: attendanceSessions.approvedOtMinutes,
      otStatus: attendanceSessions.otStatus,
    })
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.orgId as any, orgId as any),
        gte(attendanceSessions.workDate as any, startDate as any),
        lte(attendanceSessions.workDate as any, endDate as any)
      )
    );

  // Scan approved site expenses in this date range
  const expenses = await db
    .select({
      id: siteExpenses.id,
      amount: siteExpenses.amount,
      status: siteExpenses.status,
    })
    .from(siteExpenses)
    .where(
      and(
        eq(siteExpenses.orgId as any, orgId as any),
        gte(siteExpenses.date as any, startDate as any),
        lte(siteExpenses.date as any, endDate as any)
      )
    );

  const workerIds = new Set<string>();
  let totalStandardMinutes = 0;
  let totalWorkedMinutes = 0;
  let totalCalculatedOtMinutes = 0;
  let totalApprovedOtMinutes = 0;
  let exceptionCount = 0;

  for (const s of sessions) {
    workerIds.add(s.workerId);
    if (!s.clockOutTime) {
      exceptionCount += 1; // Missing punch flag
    }
    if (s.status === 'PENDING') {
      exceptionCount += 1; // Unapproved attendance flag
    }

    if (s.status === 'APPROVED' && s.clockOutTime) {
      totalStandardMinutes += (s.standardHoursMinutes || 540);
      totalWorkedMinutes += Math.floor((s.netWorkingSeconds || 0) / 60);
      totalCalculatedOtMinutes += (s.calculatedOtMinutes || 0);
      totalApprovedOtMinutes += (s.approvedOtMinutes || 0);
    }
  }

  let totalApprovedExpenses = 0;
  for (const exp of expenses) {
    if (exp.status === 'APPROVED') {
      totalApprovedExpenses += Number(exp.amount) || 0;
    }
  }

  const [period] = await db
    .insert(payrollPeriods)
    .values({
      orgId: orgId as any,
      name,
      startDate: startDate as any,
      endDate: endDate as any,
      status: 'DRAFT',
      totalWorkers: workerIds.size,
      totalStandardMinutes,
      totalWorkedMinutes,
      totalCalculatedOtMinutes,
      totalApprovedOtMinutes,
      totalApprovedExpenses,
      exceptionCount,
    })
    .returning();

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'CREATE_PAYROLL_PERIOD',
    entityType: 'PAYROLL_PERIOD',
    entityId: period.id,
    afterValues: { name, startDate, endDate, totalWorkers: workerIds.size, totalApprovedExpenses },
  });

  return res.status(201).json({
    success: true,
    message: 'Payroll period initialized in DRAFT status',
    period,
  });
}

/**
 * GET /payroll/periods/:id/reconciliation
 * Detailed worker-level and record-level reconciliation review sheet
 */
export async function getPayrollReconciliation(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.id as any, id as any), eq(payrollPeriods.orgId as any, orgId as any)))
    .limit(1);

  if (!period) {
    return res.status(404).json({ error: 'PERIOD_NOT_FOUND', message: 'Payroll period not found' });
  }

  const startDate = typeof period.startDate === 'string' ? period.startDate.split('T')[0] : new Date(period.startDate).toISOString().split('T')[0];
  const endDate = typeof period.endDate === 'string' ? period.endDate.split('T')[0] : new Date(period.endDate).toISOString().split('T')[0];

  // Fetch all attendance sessions
  const sessions = await db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      attendanceStatus: attendanceSessions.status,
      standardHoursMinutes: attendanceSessions.standardHoursMinutes,
      breakDurationMinutes: attendanceSessions.breakDurationMinutes,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      calculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      approvedOtMinutes: attendanceSessions.approvedOtMinutes,
      otStatus: attendanceSessions.otStatus,
      isPayrollLocked: attendanceSessions.isPayrollLocked,
      workerId: users.id,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      employmentType: users.employmentType,
      worksiteName: worksites.name,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .where(
      and(
        eq(attendanceSessions.orgId as any, orgId as any),
        gte(attendanceSessions.workDate as any, startDate as any),
        lte(attendanceSessions.workDate as any, endDate as any)
      )
    )
    .orderBy(desc(attendanceSessions.workDate));

  // Fetch approved site expenses
  const expenses = await db
    .select({
      id: siteExpenses.id,
      workerId: siteExpenses.workerId,
      amount: siteExpenses.amount,
      category: siteExpenses.category,
      status: siteExpenses.status,
      date: siteExpenses.date,
    })
    .from(siteExpenses)
    .where(
      and(
        eq(siteExpenses.orgId as any, orgId as any),
        gte(siteExpenses.date as any, startDate as any),
        lte(siteExpenses.date as any, endDate as any)
      )
    );

  // Fetch existing adjustments
  const adjustments = await db
    .select({
      id: payrollAdjustments.id,
      workerId: payrollAdjustments.workerId,
      adjustmentType: payrollAdjustments.adjustmentType,
      amountOrMinutes: payrollAdjustments.amountOrMinutes,
      reason: payrollAdjustments.reason,
      createdAt: payrollAdjustments.createdAt,
      adjustedByName: users.fullName,
    })
    .from(payrollAdjustments)
    .innerJoin(users, eq(payrollAdjustments.adjustedBy, users.id))
    .where(eq(payrollAdjustments.payrollPeriodId as any, period.id as any))
    .orderBy(desc(payrollAdjustments.createdAt));

  // Aggregate by worker
  const workerSummaryMap = new Map<string, any>();
  for (const s of sessions) {
    if (!workerSummaryMap.has(s.workerId)) {
      workerSummaryMap.set(s.workerId, {
        workerId: s.workerId,
        workerName: s.workerName,
        employeeCode: s.employeeCode,
        employmentType: s.employmentType,
        totalSessions: 0,
        completedSessions: 0,
        missingPunches: 0,
        pendingApprovals: 0,
        totalStandardMinutes: 0,
        totalWorkedMinutes: 0,
        totalCalculatedOtMinutes: 0,
        totalApprovedOtMinutes: 0,
        approvedExpensesAmount: 0,
        flagReasons: [] as string[],
      });
    }

    const item = workerSummaryMap.get(s.workerId);
    item.totalSessions += 1;

    if (!s.clockOutTime) {
      item.missingPunches += 1;
      item.flagReasons.push(`Missing clock-out on ${String(s.workDate).split('T')[0]}`);
    }
    if (s.attendanceStatus === 'PENDING') {
      item.pendingApprovals += 1;
      item.flagReasons.push(`Pending attendance approval on ${String(s.workDate).split('T')[0]}`);
    }
    if (s.attendanceStatus === 'REJECTED') {
      item.flagReasons.push(`Rejected attendance on ${String(s.workDate).split('T')[0]}`);
    }

    if (s.clockOutTime && s.attendanceStatus === 'APPROVED') {
      item.completedSessions += 1;
      item.totalStandardMinutes += (s.standardHoursMinutes || 540);
      item.totalWorkedMinutes += Math.floor((s.netWorkingSeconds || 0) / 60);
      item.totalCalculatedOtMinutes += (s.calculatedOtMinutes || 0);
      item.totalApprovedOtMinutes += (s.approvedOtMinutes || 0);
    }
  }

  // Attach expenses to workers
  for (const exp of expenses) {
    if (exp.workerId && exp.status === 'APPROVED' && workerSummaryMap.has(exp.workerId)) {
      workerSummaryMap.get(exp.workerId).approvedExpensesAmount += Number(exp.amount) || 0;
    }
  }

  const workerSummaries = Array.from(workerSummaryMap.values()).map((w) => ({
    ...w,
    hasUnresolvedFlags: w.flagReasons.length > 0,
    formattedStandardHours: formatMinutes(w.totalStandardMinutes),
    formattedWorkedHours: formatMinutes(w.totalWorkedMinutes),
    formattedCalculatedOt: formatMinutes(w.totalCalculatedOtMinutes),
    formattedApprovedOt: formatMinutes(w.totalApprovedOtMinutes),
  }));

  return res.json({
    period: {
      id: period.id,
      name: period.name,
      startDate,
      endDate,
      status: period.status,
      totalWorkers: workerSummaries.length,
      totalStandardMinutes: period.totalStandardMinutes,
      totalWorkedMinutes: period.totalWorkedMinutes,
      totalCalculatedOtMinutes: period.totalCalculatedOtMinutes,
      totalApprovedOtMinutes: period.totalApprovedOtMinutes,
      totalApprovedExpenses: period.totalApprovedExpenses,
      exceptionCount: period.exceptionCount,
      formattedTotalStandardHours: formatMinutes(period.totalStandardMinutes),
      formattedTotalWorkedHours: formatMinutes(period.totalWorkedMinutes),
      formattedTotalApprovedOt: formatMinutes(period.totalApprovedOtMinutes),
    },
    workerSummaries,
    adjustments,
    sessionsCount: sessions.length,
    expensesCount: expenses.length,
  });
}

/**
 * POST /payroll/periods/:id/adjust
 * Create an authorized reconciliation adjustment with mandatory reason
 */
export async function createPayrollAdjustment(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = adjustmentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.id as any, id as any), eq(payrollPeriods.orgId as any, orgId as any)))
    .limit(1);

  if (!period) {
    return res.status(404).json({ error: 'PERIOD_NOT_FOUND', message: 'Payroll period not found' });
  }

  // Prevent edits to FINALIZED payroll unless via post-finalization adjustment entry
  const { workerId, adjustmentType, amountOrMinutes, reason } = parseResult.data;

  const [adjustment] = await db
    .insert(payrollAdjustments)
    .values({
      payrollPeriodId: period.id as any,
      workerId: workerId as any,
      adjustmentType,
      amountOrMinutes,
      reason,
      adjustedBy: user.id as any,
    })
    .returning();

  await logAuditEvent({
    orgId,
    actorId: user.id,
    action: 'CREATE_PAYROLL_ADJUSTMENT',
    entityType: 'PAYROLL_ADJUSTMENT',
    entityId: adjustment.id,
    reason,
    afterValues: {
      periodId: period.id,
      workerId,
      adjustmentType,
      amountOrMinutes,
    },
    ipAddress: req.ip,
  });

  return res.status(201).json({
    success: true,
    message: 'Payroll adjustment recorded successfully',
    adjustment,
  });
}

/**
 * POST /payroll/periods/:id/lock
 * Locks the period and stamps isPayrollLocked on underlying attendance sessions
 */
export async function lockPayrollPeriod(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.id as any, id as any), eq(payrollPeriods.orgId as any, orgId as any)))
    .limit(1);

  if (!period) {
    return res.status(404).json({ error: 'PERIOD_NOT_FOUND', message: 'Payroll period not found' });
  }

  if (period.status === 'FINALIZED') {
    return res.status(400).json({ error: 'ALREADY_FINALIZED', message: 'Period is already finalized and locked.' });
  }

  const startDate = typeof period.startDate === 'string' ? period.startDate.split('T')[0] : new Date(period.startDate).toISOString().split('T')[0];
  const endDate = typeof period.endDate === 'string' ? period.endDate.split('T')[0] : new Date(period.endDate).toISOString().split('T')[0];

  // Lock underlying attendance sessions
  await db
    .update(attendanceSessions)
    .set({
      isPayrollLocked: true,
      payrollPeriodId: period.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(attendanceSessions.orgId as any, orgId as any),
        gte(attendanceSessions.workDate as any, startDate as any),
        lte(attendanceSessions.workDate as any, endDate as any)
      )
    );

  // Lock underlying approved expenses
  await db
    .update(siteExpenses)
    .set({
      isLocked: true,
      payrollPeriodId: period.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(siteExpenses.orgId as any, orgId as any),
        eq(siteExpenses.status as any, 'APPROVED' as any),
        gte(siteExpenses.date as any, startDate as any),
        lte(siteExpenses.date as any, endDate as any)
      )
    );

  // Update period status
  const [updated] = await db
    .update(payrollPeriods)
    .set({
      status: 'LOCKED',
      updatedAt: new Date(),
    })
    .where(eq(payrollPeriods.id as any, period.id as any))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: user.id,
    action: 'LOCK_PAYROLL_PERIOD',
    entityType: 'PAYROLL_PERIOD',
    entityId: period.id,
    reason: 'Authorized administrator locked payroll period for review',
    ipAddress: req.ip,
  });

  return res.json({
    success: true,
    message: 'Payroll period and underlying attendance records are now LOCKED.',
    period: updated,
  });
}

/**
 * POST /payroll/periods/:id/finalize
 * Finalizes and permanently seals the payroll period.
 */
export async function finalizePayrollPeriod(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.id as any, id as any), eq(payrollPeriods.orgId as any, orgId as any)))
    .limit(1);

  if (!period) {
    return res.status(404).json({ error: 'PERIOD_NOT_FOUND', message: 'Payroll period not found' });
  }

  if (period.status === 'FINALIZED') {
    return res.status(400).json({ error: 'ALREADY_FINALIZED', message: 'Period is already finalized.' });
  }

  const now = new Date();
  const [updated] = await db
    .update(payrollPeriods)
    .set({
      status: 'FINALIZED',
      finalizedBy: user.id as any,
      finalizedAt: now,
      updatedAt: now,
    })
    .where(eq(payrollPeriods.id as any, period.id as any))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: user.id,
    action: 'FINALIZE_PAYROLL_PERIOD',
    entityType: 'PAYROLL_PERIOD',
    entityId: period.id,
    reason: 'Authorized administrator finalized and sealed payroll period.',
    afterValues: {
      finalizedBy: user.id,
      finalizedAt: now,
    },
    ipAddress: req.ip,
  });

  return res.json({
    success: true,
    message: 'Payroll period successfully finalized and sealed.',
    period: updated,
  });
}
