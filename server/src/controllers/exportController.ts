import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { getDb } from '../database/db.js';
import {
  attendanceSessions,
  worksites,
  siteAssignments,
  users,
  siteExpenses,
  payrollPeriods,
  payrollAdjustments,
} from '../database/schema.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { formatMinutes } from '../services/overtimeService.js';

/**
 * Sanitizes strings against CSV/Excel formula injection (DDE / formula execution).
 * If a string begins with =, +, -, @, \t, or \r, prepend a single quote.
 */
export function sanitizeCellValue(val: any): any {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean' || val instanceof Date) {
    return val;
  }
  let str = String(val).trim();
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    str = `'${str}`;
  }
  return str;
}

/**
 * Common style helper for worksheet headers
 */
function applyHeaderStyle(row: ExcelJS.Row, fillColor: string = '1E293B') {
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11, name: 'Segoe UI' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fillColor },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'CBD5E1' } },
      bottom: { style: 'medium', color: { argb: '94A3B8' } },
      left: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } },
    };
  });
}

/**
 * 1. GET /exports/attendance.xlsx
 * Detailed attendance log with worker, site, punch times, standard hours, OT, status
 */
export async function exportDetailedAttendanceXlsx(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { startDate, endDate, worksiteId, workerId, status } = req.query;

  const conditions = [eq(attendanceSessions.orgId as any, orgId as any)];
  if (startDate && typeof startDate === 'string') conditions.push(gte(attendanceSessions.workDate as any, startDate as any));
  if (endDate && typeof endDate === 'string') conditions.push(lte(attendanceSessions.workDate as any, endDate as any));
  if (worksiteId && typeof worksiteId === 'string') conditions.push(eq(attendanceSessions.worksiteSnapshotId as any, worksiteId as any));
  if (workerId && typeof workerId === 'string') conditions.push(eq(attendanceSessions.workerId as any, workerId as any));
  if (status && typeof status === 'string' && status !== 'ALL') conditions.push(eq(attendanceSessions.status as any, status as any));

  const records = await db
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
      isAutoApproved: attendanceSessions.isAutoApproved,
      exceptionStatus: attendanceSessions.exceptionStatus,
      workerId: users.id,
      employeeCode: users.employeeCode,
      workerName: users.fullName,
      worksiteName: worksites.name,
      shiftName: siteAssignments.shiftName,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .leftJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
    .where(and(...conditions))
    .orderBy(desc(attendanceSessions.workDate));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance Tracker System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Detailed Attendance', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = [
    { header: 'Work Date', key: 'workDate', width: 14 },
    { header: 'Employee Code', key: 'employeeCode', width: 16 },
    { header: 'Worker Name', key: 'workerName', width: 22 },
    { header: 'Worksite', key: 'worksiteName', width: 22 },
    { header: 'Shift', key: 'shiftName', width: 16 },
    { header: 'Clock-In Time', key: 'clockInTime', width: 20 },
    { header: 'Clock-Out Time', key: 'clockOutTime', width: 20 },
    { header: 'Break (mins)', key: 'breakMins', width: 14 },
    { header: 'Net Worked', key: 'netWorked', width: 14 },
    { header: 'Standard Hours', key: 'standardHours', width: 16 },
    { header: 'Calculated OT', key: 'calculatedOt', width: 16 },
    { header: 'Approved OT', key: 'approvedOt', width: 14 },
    { header: 'Attendance Status', key: 'attendanceStatus', width: 18 },
    { header: 'OT Status', key: 'otStatus', width: 14 },
  ];

  applyHeaderStyle(worksheet.getRow(1));

  records.forEach((r: any) => {
    const netMins = Math.floor((r.netWorkingSeconds || 0) / 60);
    const row = worksheet.addRow({
      workDate: sanitizeCellValue(typeof r.workDate === 'string' ? r.workDate.split('T')[0] : new Date(r.workDate).toISOString().split('T')[0]),
      employeeCode: sanitizeCellValue(r.employeeCode),
      workerName: sanitizeCellValue(r.workerName),
      worksiteName: sanitizeCellValue(r.worksiteName),
      shiftName: sanitizeCellValue(r.shiftName || 'Standard'),
      clockInTime: r.clockInTime ? new Date(r.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'MISSING',
      clockOutTime: r.clockOutTime ? new Date(r.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'MISSING',
      breakMins: r.breakDurationMinutes || 0,
      netWorked: formatMinutes(netMins),
      standardHours: formatMinutes(r.standardHoursMinutes || 540),
      calculatedOt: formatMinutes(r.calculatedOtMinutes || 0),
      approvedOt: formatMinutes(r.approvedOtMinutes || 0),
      attendanceStatus: sanitizeCellValue(r.attendanceStatus),
      otStatus: sanitizeCellValue(r.otStatus || 'NONE'),
    });
    row.alignment = { vertical: 'middle' };
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=detailed_attendance_${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  return res.end();
}

/**
 * 2. GET /exports/worker-summaries.xlsx
 * Monthly/Weekly aggregation by worker
 */
export async function exportWorkerSummariesXlsx(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { startDate, endDate } = req.query;

  const conditions = [eq(attendanceSessions.orgId as any, orgId as any)];
  if (startDate && typeof startDate === 'string') conditions.push(gte(attendanceSessions.workDate as any, startDate as any));
  if (endDate && typeof endDate === 'string') conditions.push(lte(attendanceSessions.workDate as any, endDate as any));

  const records = await db
    .select({
      workerId: users.id,
      employeeCode: users.employeeCode,
      workerName: users.fullName,
      employmentType: users.employmentType,
      standardHoursMinutes: attendanceSessions.standardHoursMinutes,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      calculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      approvedOtMinutes: attendanceSessions.approvedOtMinutes,
      clockOutTime: attendanceSessions.clockOutTime,
      attendanceStatus: attendanceSessions.status,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .where(and(...conditions));

  // Aggregate by worker
  const workerMap = new Map<string, any>();
  records.forEach((r: any) => {
    if (!workerMap.has(r.workerId)) {
      workerMap.set(r.workerId, {
        employeeCode: r.employeeCode,
        workerName: r.workerName,
        employmentType: r.employmentType,
        totalSessions: 0,
        completedSessions: 0,
        missingClockOuts: 0,
        totalStandardMinutes: 0,
        totalNetWorkedMinutes: 0,
        totalCalculatedOtMinutes: 0,
        totalApprovedOtMinutes: 0,
      });
    }

    const item = workerMap.get(r.workerId);
    item.totalSessions += 1;
    if (r.clockOutTime) {
      item.completedSessions += 1;
      const netMins = Math.floor((r.netWorkingSeconds || 0) / 60);
      item.totalNetWorkedMinutes += netMins;
      item.totalStandardMinutes += (r.standardHoursMinutes || 540);
      item.totalCalculatedOtMinutes += (r.calculatedOtMinutes || 0);
      item.totalApprovedOtMinutes += (r.approvedOtMinutes || 0);
    } else {
      item.missingClockOuts += 1;
    }
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Worker Summaries', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = [
    { header: 'Employee Code', key: 'employeeCode', width: 16 },
    { header: 'Worker Name', key: 'workerName', width: 24 },
    { header: 'Employment Type', key: 'employmentType', width: 18 },
    { header: 'Total Days', key: 'totalDays', width: 12 },
    { header: 'Completed Days', key: 'completedDays', width: 16 },
    { header: 'Missing Clock-outs', key: 'missingClockOuts', width: 18 },
    { header: 'Standard Hours', key: 'standardHours', width: 16 },
    { header: 'Net Worked Hours', key: 'netWorkedHours', width: 18 },
    { header: 'Calculated OT', key: 'calculatedOt', width: 16 },
    { header: 'Approved OT', key: 'approvedOt', width: 16 },
  ];

  applyHeaderStyle(worksheet.getRow(1));

  for (const item of workerMap.values()) {
    worksheet.addRow({
      employeeCode: sanitizeCellValue(item.employeeCode),
      workerName: sanitizeCellValue(item.workerName),
      employmentType: sanitizeCellValue(item.employmentType),
      totalDays: item.totalSessions,
      completedDays: item.completedSessions,
      missingClockOuts: item.missingClockOuts,
      standardHours: formatMinutes(item.totalStandardMinutes),
      netWorkedHours: formatMinutes(item.totalNetWorkedMinutes),
      calculatedOt: formatMinutes(item.totalCalculatedOtMinutes),
      approvedOt: formatMinutes(item.totalApprovedOtMinutes),
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=worker_summaries_${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  return res.end();
}

/**
 * 3. GET /exports/overtime.xlsx
 * Overtime specific report with approval notes, reviewer, and status
 */
export async function exportOvertimeXlsx(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { startDate, endDate, worksiteId, status } = req.query;

  const conditions = [
    eq(attendanceSessions.orgId as any, orgId as any),
    sql`${attendanceSessions.calculatedOtMinutes} > 0`,
  ];

  if (startDate && typeof startDate === 'string') conditions.push(gte(attendanceSessions.workDate as any, startDate as any));
  if (endDate && typeof endDate === 'string') conditions.push(lte(attendanceSessions.workDate as any, endDate as any));
  if (worksiteId && typeof worksiteId === 'string') conditions.push(eq(attendanceSessions.worksiteSnapshotId as any, worksiteId as any));
  if (status && typeof status === 'string' && status !== 'ALL') conditions.push(eq(attendanceSessions.otStatus as any, status as any));

  const records = await db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      calculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      approvedOtMinutes: attendanceSessions.approvedOtMinutes,
      otStatus: attendanceSessions.otStatus,
      otReviewedAt: attendanceSessions.otReviewedAt,
      otRejectionReason: attendanceSessions.otRejectionReason,
      employeeCode: users.employeeCode,
      workerName: users.fullName,
      worksiteName: worksites.name,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .where(and(...conditions))
    .orderBy(desc(attendanceSessions.workDate));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Overtime Review Log', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = [
    { header: 'Date', key: 'workDate', width: 14 },
    { header: 'Employee Code', key: 'employeeCode', width: 16 },
    { header: 'Worker Name', key: 'workerName', width: 22 },
    { header: 'Worksite', key: 'worksiteName', width: 22 },
    { header: 'Net Worked', key: 'netWorked', width: 14 },
    { header: 'Standard (9h)', key: 'standard', width: 14 },
    { header: 'Calculated OT', key: 'calcOt', width: 16 },
    { header: 'Approved OT', key: 'appOt', width: 16 },
    { header: 'OT Status', key: 'otStatus', width: 16 },
    { header: 'Reviewed At', key: 'reviewedAt', width: 20 },
    { header: 'Rejection Reason / Notes', key: 'notes', width: 30 },
  ];

  applyHeaderStyle(worksheet.getRow(1), '0F766E'); // Teal fill

  records.forEach((r: any) => {
    const netMins = Math.floor((r.netWorkingSeconds || 0) / 60);
    worksheet.addRow({
      workDate: sanitizeCellValue(typeof r.workDate === 'string' ? r.workDate.split('T')[0] : new Date(r.workDate).toISOString().split('T')[0]),
      employeeCode: sanitizeCellValue(r.employeeCode),
      workerName: sanitizeCellValue(r.workerName),
      worksiteName: sanitizeCellValue(r.worksiteName),
      netWorked: formatMinutes(netMins),
      standard: '9h',
      calcOt: formatMinutes(r.calculatedOtMinutes),
      appOt: formatMinutes(r.approvedOtMinutes),
      otStatus: sanitizeCellValue(r.otStatus),
      reviewedAt: r.otReviewedAt ? new Date(r.otReviewedAt).toLocaleString() : 'PENDING',
      notes: sanitizeCellValue(r.otRejectionReason || ''),
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=overtime_report_${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  return res.end();
}

/**
 * 4. GET /exports/site-attendance.xlsx
 * Site-wise aggregated attendance and overtime
 */
export async function exportSiteAttendanceXlsx(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { startDate, endDate } = req.query;

  const conditions = [eq(attendanceSessions.orgId as any, orgId as any)];
  if (startDate && typeof startDate === 'string') conditions.push(gte(attendanceSessions.workDate as any, startDate as any));
  if (endDate && typeof endDate === 'string') conditions.push(lte(attendanceSessions.workDate as any, endDate as any));

  const records = await db
    .select({
      worksiteId: worksites.id,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      calculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      approvedOtMinutes: attendanceSessions.approvedOtMinutes,
      clockOutTime: attendanceSessions.clockOutTime,
      attendanceStatus: attendanceSessions.status,
    })
    .from(attendanceSessions)
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .where(and(...conditions));

  const siteMap = new Map<string, any>();
  records.forEach((r: any) => {
    if (!siteMap.has(r.worksiteId)) {
      siteMap.set(r.worksiteId, {
        worksiteCode: r.worksiteCode,
        worksiteName: r.worksiteName,
        totalSessions: 0,
        completedSessions: 0,
        missingPunches: 0,
        totalNetWorkedMins: 0,
        totalCalculatedOtMins: 0,
        totalApprovedOtMins: 0,
      });
    }
    const item = siteMap.get(r.worksiteId);
    item.totalSessions += 1;
    if (r.clockOutTime) {
      item.completedSessions += 1;
      item.totalNetWorkedMins += Math.floor((r.netWorkingSeconds || 0) / 60);
      item.totalCalculatedOtMins += (r.calculatedOtMinutes || 0);
      item.totalApprovedOtMins += (r.approvedOtMinutes || 0);
    } else {
      item.missingPunches += 1;
    }
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Site Attendance Aggregates', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = [
    { header: 'Site Code', key: 'code', width: 14 },
    { header: 'Worksite Name', key: 'name', width: 26 },
    { header: 'Total Punches', key: 'total', width: 16 },
    { header: 'Completed Shifts', key: 'completed', width: 18 },
    { header: 'Missing Punches', key: 'missing', width: 18 },
    { header: 'Total Net Hours', key: 'netHours', width: 18 },
    { header: 'Calculated OT', key: 'calcOt', width: 18 },
    { header: 'Approved OT', key: 'appOt', width: 18 },
  ];

  applyHeaderStyle(worksheet.getRow(1), '1E3A8A'); // Blue fill

  for (const item of siteMap.values()) {
    worksheet.addRow({
      code: sanitizeCellValue(item.worksiteCode),
      name: sanitizeCellValue(item.worksiteName),
      total: item.totalSessions,
      completed: item.completedSessions,
      missing: item.missingPunches,
      netHours: formatMinutes(item.totalNetWorkedMins),
      calcOt: formatMinutes(item.totalCalculatedOtMins),
      appOt: formatMinutes(item.totalApprovedOtMins),
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=site_attendance_${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  return res.end();
}

/**
 * 5. GET /exports/expenses.xlsx
 * Site expense ledger with approval status and authorized reviewer
 */
export async function exportExpensesXlsx(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { startDate, endDate, worksiteId, status, category } = req.query;

  const conditions = [eq(siteExpenses.orgId as any, orgId as any)];
  if (startDate && typeof startDate === 'string') conditions.push(gte(siteExpenses.date as any, startDate as any));
  if (endDate && typeof endDate === 'string') conditions.push(lte(siteExpenses.date as any, endDate as any));
  if (worksiteId && typeof worksiteId === 'string') conditions.push(eq(siteExpenses.worksiteId as any, worksiteId as any));
  if (status && typeof status === 'string' && status !== 'ALL') conditions.push(eq(siteExpenses.status as any, status as any));
  if (category && typeof category === 'string' && category !== 'ALL') conditions.push(eq(siteExpenses.category as any, category as any));

  const records = await db
    .select({
      id: siteExpenses.id,
      date: siteExpenses.date,
      time: siteExpenses.time,
      category: siteExpenses.category,
      amount: siteExpenses.amount,
      currency: siteExpenses.currency,
      note: siteExpenses.note,
      status: siteExpenses.status,
      receiptUrl: siteExpenses.receiptUrl,
      rejectionReason: siteExpenses.rejectionReason,
      isLocked: siteExpenses.isLocked,
      worksiteName: worksites.name,
      submitterName: users.fullName,
    })
    .from(siteExpenses)
    .innerJoin(worksites, eq(siteExpenses.worksiteId, worksites.id))
    .innerJoin(users, eq(siteExpenses.supervisorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(siteExpenses.date));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Site Expenses Ledger', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = [
    { header: 'Expense Date', key: 'date', width: 14 },
    { header: 'Worksite', key: 'worksiteName', width: 22 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Currency', key: 'currency', width: 12 },
    { header: 'Approval Status', key: 'status', width: 16 },
    { header: 'Submitted By', key: 'submitterName', width: 22 },
    { header: 'Description / Note', key: 'note', width: 32 },
    { header: 'Rejection Reason', key: 'rejectionReason', width: 26 },
    { header: 'Payroll Locked', key: 'isLocked', width: 14 },
  ];

  applyHeaderStyle(worksheet.getRow(1), 'B45309'); // Amber fill

  records.forEach((r: any) => {
    worksheet.addRow({
      date: sanitizeCellValue(typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0]),
      worksiteName: sanitizeCellValue(r.worksiteName),
      category: sanitizeCellValue(r.category),
      amount: Number(r.amount) || 0,
      currency: sanitizeCellValue(r.currency || 'INR'),
      status: sanitizeCellValue(r.status || 'PENDING'),
      submitterName: sanitizeCellValue(r.submitterName),
      note: sanitizeCellValue(r.note),
      rejectionReason: sanitizeCellValue(r.rejectionReason || ''),
      isLocked: r.isLocked ? 'YES' : 'NO',
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=site_expenses_${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  return res.end();
}

/**
 * 6. GET /exports/payroll/:periodId.xlsx
 * Complete payroll period reconciliation worksheet
 */
export async function exportPayrollReconciliationXlsx(req: Request, res: Response): Promise<any> {
  const { periodId } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [period] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.id as any, periodId as any), eq(payrollPeriods.orgId as any, orgId as any)))
    .limit(1);

  if (!period) {
    return res.status(404).json({ error: 'PERIOD_NOT_FOUND', message: 'Payroll period not found' });
  }

  // Fetch all attendance sessions in period range
  const sessions = await db
    .select({
      id: attendanceSessions.id,
      workerId: users.id,
      employeeCode: users.employeeCode,
      workerName: users.fullName,
      employmentType: users.employmentType,
      worksiteName: worksites.name,
      workDate: attendanceSessions.workDate,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      attendanceStatus: attendanceSessions.status,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      standardHoursMinutes: attendanceSessions.standardHoursMinutes,
      calculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      approvedOtMinutes: attendanceSessions.approvedOtMinutes,
      otStatus: attendanceSessions.otStatus,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .where(
      and(
        eq(attendanceSessions.orgId as any, orgId as any),
        gte(attendanceSessions.workDate as any, period.startDate as any),
        lte(attendanceSessions.workDate as any, period.endDate as any)
      )
    );

  // Fetch approved expenses in period range
  const expenses = await db
    .select({
      id: siteExpenses.id,
      workerId: siteExpenses.workerId,
      amount: siteExpenses.amount,
      category: siteExpenses.category,
      note: siteExpenses.note,
      status: siteExpenses.status,
    })
    .from(siteExpenses)
    .where(
      and(
        eq(siteExpenses.orgId as any, orgId as any),
        eq(siteExpenses.status as any, 'APPROVED' as any),
        gte(siteExpenses.date as any, period.startDate as any),
        lte(siteExpenses.date as any, period.endDate as any)
      )
    );

  // Fetch adjustments
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
    .where(eq(payrollAdjustments.payrollPeriodId as any, period.id as any));

  // Build workbook with 3 sheets: Worker Summary, Detailed Attendance, Adjustments
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance Tracker System';

  // Sheet 1: Worker Reconciliation Summary
  const summarySheet = workbook.addWorksheet('Payroll Summary', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  summarySheet.columns = [
    { header: 'Employee Code', key: 'code', width: 16 },
    { header: 'Worker Name', key: 'name', width: 24 },
    { header: 'Employment Type', key: 'type', width: 18 },
    { header: 'Standard Hours', key: 'stdHours', width: 16 },
    { header: 'Net Worked Hours', key: 'workedHours', width: 18 },
    { header: 'Approved OT Hours', key: 'appOt', width: 18 },
    { header: 'Approved Expenses (₹)', key: 'expenses', width: 22 },
    { header: 'Reconciliation Status', key: 'status', width: 22 },
  ];
  applyHeaderStyle(summarySheet.getRow(1), '15803D'); // Emerald fill

  // Aggregate by worker
  const workerTotals = new Map<string, any>();
  sessions.forEach((s: any) => {
    if (!workerTotals.has(s.workerId)) {
      workerTotals.set(s.workerId, {
        code: s.employeeCode,
        name: s.workerName,
        type: s.employmentType,
        stdMins: 0,
        workedMins: 0,
        appOtMins: 0,
        approvedExpenses: 0,
        hasFlag: false,
      });
    }
    const item = workerTotals.get(s.workerId);
    if (s.clockOutTime && s.attendanceStatus === 'APPROVED') {
      item.stdMins += (s.standardHoursMinutes || 540);
      item.workedMins += Math.floor((s.netWorkingSeconds || 0) / 60);
      item.appOtMins += (s.approvedOtMinutes || 0);
    } else {
      item.hasFlag = true;
    }
  });

  expenses.forEach((e: any) => {
    if (e.workerId && workerTotals.has(e.workerId)) {
      workerTotals.get(e.workerId).approvedExpenses += Number(e.amount) || 0;
    }
  });

  for (const item of workerTotals.values()) {
    summarySheet.addRow({
      code: sanitizeCellValue(item.code),
      name: sanitizeCellValue(item.name),
      type: sanitizeCellValue(item.type),
      stdHours: formatMinutes(item.stdMins),
      workedHours: formatMinutes(item.workedMins),
      appOt: formatMinutes(item.appOtMins),
      expenses: item.approvedExpenses,
      status: item.hasFlag ? 'FLAGGED (INCOMPLETE)' : 'RECONCILED',
    });
  }

  // Sheet 2: Adjustments Sheet
  const adjSheet = workbook.addWorksheet('Payroll Adjustments', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  adjSheet.columns = [
    { header: 'Worker ID', key: 'workerId', width: 24 },
    { header: 'Adjustment Type', key: 'type', width: 18 },
    { header: 'Amount / Minutes', key: 'value', width: 18 },
    { header: 'Mandatory Reason', key: 'reason', width: 36 },
    { header: 'Adjusted By', key: 'adjustedBy', width: 22 },
    { header: 'Timestamp', key: 'timestamp', width: 20 },
  ];
  applyHeaderStyle(adjSheet.getRow(1), '4338CA');

  adjustments.forEach((adj: any) => {
    adjSheet.addRow({
      workerId: sanitizeCellValue(adj.workerId),
      type: sanitizeCellValue(adj.adjustmentType),
      value: adj.amountOrMinutes,
      reason: sanitizeCellValue(adj.reason),
      adjustedBy: sanitizeCellValue(adj.adjustedByName),
      timestamp: new Date(adj.createdAt).toLocaleString(),
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=payroll_reconciliation_${period.name.replace(/\s+/g, '_')}.xlsx`);

  await workbook.xlsx.write(res);
  return res.end();
}
