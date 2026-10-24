import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import { siteExpenses, users, worksites } from '../database/schema.js';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';

const expenseCategories = ['Materials', 'Food', 'Transport', 'Worker payment', 'Other'] as const;

const createExpenseSchema = z.object({
  worksiteId: z.string().min(1, 'Worksite ID is required'),
  amount: z.number().positive('Expense amount must be greater than 0'),
  category: z.enum(['Materials', 'Food', 'Transport', 'Worker payment', 'Other']),
  appliesToType: z.enum(['LOCATION', 'WORKER']).default('LOCATION'),
  workerId: z.string().optional().nullable(),
  workerName: z.string().optional().nullable(),
  note: z.string().min(1, 'Description note is required'),
  receiptUrl: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD').optional(),
  time: z.string().optional(),
});

const updateExpenseSchema = z.object({
  worksiteId: z.string().optional(),
  amount: z.number().positive('Expense amount must be greater than 0').optional(),
  category: z.enum(expenseCategories).optional(),
  appliesToType: z.enum(['LOCATION', 'WORKER']).optional(),
  workerId: z.string().optional().nullable(),
  workerName: z.string().optional().nullable(),
  note: z.string().min(1).optional(),
  receiptUrl: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().optional(),
});

/**
 * GET /expenses
 * List site expenses with optional worksite and date filters
 */
export async function getExpenses(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;

  const { worksiteId, date, startDate, endDate, category, workerId } = req.query;

  const conditions = [eq(siteExpenses.orgId, orgId)];

  if (worksiteId && typeof worksiteId === 'string' && worksiteId.trim()) {
    conditions.push(eq(siteExpenses.worksiteId, worksiteId.trim() as any));
  }

  if (date && typeof date === 'string') {
    conditions.push(eq(siteExpenses.date, date as any));
  } else {
    if (startDate && typeof startDate === 'string') {
      conditions.push(gte(siteExpenses.date, startDate as any));
    }
    if (endDate && typeof endDate === 'string') {
      conditions.push(lte(siteExpenses.date, endDate as any));
    }
  }

  if (category && typeof category === 'string' && category !== 'ALL') {
    conditions.push(eq(siteExpenses.category, category as any));
  }

  if (workerId && typeof workerId === 'string') {
    conditions.push(eq(siteExpenses.workerId, workerId as any));
  }

  const records = await db
    .select({
      id: siteExpenses.id,
      amount: siteExpenses.amount,
      category: siteExpenses.category,
      appliesToType: siteExpenses.appliesToType,
      workerId: siteExpenses.workerId,
      workerName: siteExpenses.workerName,
      note: siteExpenses.note,
      receiptUrl: siteExpenses.receiptUrl,
      date: siteExpenses.date,
      time: siteExpenses.time,
      isLocked: siteExpenses.isLocked,
      worksiteId: siteExpenses.worksiteId,
      supervisorId: siteExpenses.supervisorId,
      createdAt: siteExpenses.createdAt,
      updatedAt: siteExpenses.updatedAt,
      worksiteName: worksites.name,
    })
    .from(siteExpenses)
    .leftJoin(worksites, eq(siteExpenses.worksiteId, worksites.id))
    .where(and(...conditions))
    .orderBy(desc(siteExpenses.date), desc(siteExpenses.createdAt));

  // Map to frontend SpendEntry interface
  const entries = records.map((r: any) => ({
    id: r.id,
    amount: r.amount,
    category: r.category,
    appliesToType: r.appliesToType,
    workerId: r.workerId || undefined,
    workerName: r.workerName || undefined,
    note: r.note,
    receiptUrl: r.receiptUrl || undefined,
    date: typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0],
    time: r.time,
    isLocked: r.isLocked,
    worksiteId: r.worksiteId,
    worksiteName: r.worksiteName || undefined,
    supervisorId: r.supervisorId,
  }));

  return res.json(entries);
}

/**
 * GET /expenses/:id
 * Retrieve a single expense entry
 */
export async function getExpenseById(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const user = req.user!;

  const [record] = await db
    .select()
    .from(siteExpenses)
    .where(and(eq(siteExpenses.id as any, id as any), eq(siteExpenses.orgId as any, user.orgId as any)))
    .limit(1);

  if (!record) {
    return res.status(404).json({ error: 'EXPENSE_NOT_FOUND', message: 'Site expense voucher not found' });
  }

  return res.json(record);
}

/**
 * POST /expenses
 * Create a new site expense entry
 */
export async function createExpense(req: Request, res: Response): Promise<any> {
  const parseResult = createExpenseSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const {
    worksiteId,
    amount,
    category,
    appliesToType,
    workerId,
    note,
    receiptUrl,
    date,
    time,
  } = parseResult.data;

  let workerName = parseResult.data.workerName;
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;

  // Resolve worker name if workerId provided without name
  if (workerId && !workerName) {
    const [w] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id as any, workerId as any)).limit(1);
    if (w) workerName = w.fullName;
  }

  const now = new Date();
  const dateStr = date || now.toISOString().split('T')[0];
  const timeStr = time || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const [inserted] = await db
    .insert(siteExpenses)
    .values({
      orgId: orgId as any,
      worksiteId: worksiteId as any,
      supervisorId: user.id as any,
      amount,
      category,
      appliesToType,
      workerId: (workerId || null) as any,
      workerName: workerName || null,
      note,
      receiptUrl: receiptUrl || null,
      date: dateStr as any,
      time: timeStr,
      isLocked: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await logAuditEvent({
    orgId,
    actorId: user.id,
    action: 'CREATE_SITE_EXPENSE',
    entityType: 'SITE_EXPENSE',
    entityId: inserted.id,
    afterValues: { amount, category, appliesToType, note, date: dateStr },
    ipAddress: req.ip,
  });

  const entry = {
    id: inserted.id,
    amount: inserted.amount,
    category: inserted.category,
    appliesToType: inserted.appliesToType,
    workerId: inserted.workerId || undefined,
    workerName: inserted.workerName || undefined,
    note: inserted.note,
    receiptUrl: inserted.receiptUrl || undefined,
    date: dateStr,
    time: inserted.time,
    isLocked: inserted.isLocked,
    worksiteId: inserted.worksiteId,
  };

  return res.status(201).json({
    success: true,
    message: 'Site expense recorded successfully',
    expense: entry,
  });
}

/**
 * PUT /expenses/:id
 * Update an existing site expense entry
 */
export async function updateExpense(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = updateExpenseSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const [existing] = await db
    .select()
    .from(siteExpenses)
    .where(and(eq(siteExpenses.id as any, id as any), eq(siteExpenses.orgId as any, orgId as any)))
    .limit(1);

  if (!existing) {
    return res.status(404).json({ error: 'EXPENSE_NOT_FOUND', message: 'Site expense voucher not found' });
  }

  if (existing.isLocked) {
    return res.status(403).json({
      error: 'EXPENSE_LOCKED',
      message: 'This expense entry has been audited and locked by finance; it cannot be modified.',
    });
  }

  // Permission check: only the recording supervisor or an admin can edit
  if (!isSuperOrAdmin && existing.supervisorId !== user.id) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You are not authorized to edit this expense entry',
    });
  }

  const updateData: any = {
    updatedAt: new Date(),
  };

  if (parseResult.data.amount !== undefined) updateData.amount = parseResult.data.amount;
  if (parseResult.data.category !== undefined) updateData.category = parseResult.data.category;
  if (parseResult.data.appliesToType !== undefined) updateData.appliesToType = parseResult.data.appliesToType;
  if (parseResult.data.workerId !== undefined) updateData.workerId = parseResult.data.workerId;
  if (parseResult.data.workerName !== undefined) updateData.workerName = parseResult.data.workerName;
  if (parseResult.data.note !== undefined) updateData.note = parseResult.data.note;
  if (parseResult.data.receiptUrl !== undefined) updateData.receiptUrl = parseResult.data.receiptUrl;
  if (parseResult.data.date !== undefined) updateData.date = parseResult.data.date;
  if (parseResult.data.time !== undefined) updateData.time = parseResult.data.time;
  if (parseResult.data.worksiteId !== undefined) updateData.worksiteId = parseResult.data.worksiteId;

  // Resolve worker name if workerId is set or changed without workerName
  if (updateData.workerId && !updateData.workerName) {
    const [w] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id as any, updateData.workerId as any)).limit(1);
    if (w) updateData.workerName = w.fullName;
  }

  const [updated] = await db
    .update(siteExpenses)
    .set(updateData)
    .where(eq(siteExpenses.id as any, id as any))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: user.id,
    action: 'UPDATE_SITE_EXPENSE',
    entityType: 'SITE_EXPENSE',
    entityId: id,
    beforeValues: { amount: existing.amount, category: existing.category, note: existing.note },
    afterValues: updateData,
    ipAddress: req.ip,
  });

  const entry = {
    id: updated.id,
    amount: updated.amount,
    category: updated.category,
    appliesToType: updated.appliesToType,
    workerId: updated.workerId || undefined,
    workerName: updated.workerName || undefined,
    note: updated.note,
    receiptUrl: updated.receiptUrl || undefined,
    date: typeof updated.date === 'string' ? updated.date.split('T')[0] : new Date(updated.date).toISOString().split('T')[0],
    time: updated.time,
    isLocked: updated.isLocked,
    worksiteId: updated.worksiteId,
  };

  return res.json({
    success: true,
    message: 'Site expense updated successfully',
    expense: entry,
  });
}

/**
 * DELETE /expenses/:id
 * Delete an existing site expense entry
 */
export async function deleteExpense(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const user = req.user!;
  const orgId = user.orgId;
  const isSuperOrAdmin = user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');

  const [existing] = await db
    .select()
    .from(siteExpenses)
    .where(and(eq(siteExpenses.id as any, id as any), eq(siteExpenses.orgId as any, orgId as any)))
    .limit(1);

  if (!existing) {
    return res.status(404).json({ error: 'EXPENSE_NOT_FOUND', message: 'Site expense voucher not found' });
  }

  if (existing.isLocked) {
    return res.status(403).json({
      error: 'EXPENSE_LOCKED',
      message: 'This expense entry has been audited and locked by finance; it cannot be deleted.',
    });
  }

  if (!isSuperOrAdmin && existing.supervisorId !== user.id) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You are not authorized to delete this expense entry',
    });
  }

  await db.delete(siteExpenses).where(eq(siteExpenses.id as any, id as any));

  await logAuditEvent({
    orgId,
    actorId: user.id,
    action: 'DELETE_SITE_EXPENSE',
    entityType: 'SITE_EXPENSE',
    entityId: id,
    beforeValues: { amount: existing.amount, category: existing.category, note: existing.note },
    ipAddress: req.ip,
  });

  return res.json({
    success: true,
    message: 'Site expense deleted successfully',
  });
}
