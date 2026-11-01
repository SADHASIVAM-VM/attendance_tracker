import { Request, Response } from 'express';
import { getDb } from '../database/db.js';
import {
  attendanceSessions,
  attendanceEvents,
  siteAssignments,
  worksites,
  users,
  auditLogs,
  notifications,
  siteExpenses,
  attendanceAdjustmentRequests,
} from '../database/schema.js';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { formatMinutes } from '../services/overtimeService.js';

function sanitizeCsvField(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Prevent CSV injection
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    str = "'" + str;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function getAttendanceReport(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { startDate, endDate, worksiteId, workerId, status } = req.query;

  // Pagination params (offset & limit)
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '10'), 10) || 10));
  const offset = req.query.offset !== undefined
    ? Math.max(0, parseInt(String(req.query.offset), 10) || 0)
    : (page - 1) * limit;

  // Sorting filter params (sort based on name, asc, desc, newest first use createdAt)
  const sortBy = String(req.query.sortBy || 'createdAt');
  const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase();

  const records = await db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      status: attendanceSessions.status,
      isAutoApproved: attendanceSessions.isAutoApproved,
      autoApprovalReason: attendanceSessions.autoApprovalReason,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      rejectionReason: attendanceSessions.rejectionReason,
      createdAt: attendanceSessions.createdAt,
      workerId: users.id,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      worksiteId: worksites.id,
      worksiteName: worksites.name,
      worksiteCode: worksites.code,
      shiftName: siteAssignments.shiftName,
      supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .innerJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
    .where(eq(attendanceSessions.orgId as any, orgId as any));

  const supervisorIds = [...new Set(records.map((r: any) => r.supervisorSnapshotId))];
  const supervisorMap: Record<string, string> = {};

  if (supervisorIds.length > 0) {
    const supervisors = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(sql`${users.id} IN (${sql.join(supervisorIds.map((id: string) => sql`${id}`), sql`, `)})`);

    for (const s of supervisors) {
      supervisorMap[s.id] = s.fullName;
    }
  }

  // Fetch coordinates and event details for these sessions
  const sessionIds = records.map((r: any) => r.id);
  const eventMap: Record<string, any> = {};

  if (sessionIds.length > 0) {
    const events = await db
      .select({
        sessionId: attendanceEvents.sessionId,
        latitude: attendanceEvents.latitude,
        longitude: attendanceEvents.longitude,
        reportedAccuracyMeters: attendanceEvents.reportedAccuracyMeters,
        calculatedDistanceMeters: attendanceEvents.calculatedDistanceMeters,
        isWithinGeofence: attendanceEvents.isWithinGeofence,
        isLocationBypassed: attendanceEvents.isLocationBypassed,
        eventType: attendanceEvents.eventType,
        photoUrl: attendanceEvents.photoUrl,
      })
      .from(attendanceEvents)
      .where(sql`${attendanceEvents.sessionId} IN (${sql.join(sessionIds.map((id: string) => sql`${id}`), sql`, `)})`);

    for (const ev of events) {
      if (ev.eventType === 'CLOCK_IN' || !eventMap[ev.sessionId]) {
        eventMap[ev.sessionId] = ev;
      }
    }
  }

  let filtered = records.map((r: any) => ({
    ...r,
    historicalSupervisorName: supervisorMap[r.supervisorSnapshotId] || 'Unassigned',
    missingClockOut: r.status === 'APPROVED' && !r.clockOutTime,
    latitude: eventMap[r.id]?.latitude,
    longitude: eventMap[r.id]?.longitude,
    accuracyMeters: eventMap[r.id]?.reportedAccuracyMeters,
    distanceMeters: eventMap[r.id]?.calculatedDistanceMeters,
    isWithinGeofence: eventMap[r.id]?.isWithinGeofence,
    isLocationBypassed: eventMap[r.id]?.isLocationBypassed,
    photoUrl: eventMap[r.id]?.photoUrl,
  }));

  // Apply filters
  if (startDate) filtered = filtered.filter((r: any) => r.workDate >= String(startDate));
  if (endDate) filtered = filtered.filter((r: any) => r.workDate <= String(endDate));
  if (worksiteId) filtered = filtered.filter((r: any) => r.worksiteId === String(worksiteId));
  if (workerId) filtered = filtered.filter((r: any) => r.workerId === String(workerId));
  if (status) filtered = filtered.filter((r: any) => r.status === String(status));

  // Apply sorting filter
  filtered.sort((a: any, b: any) => {
    if (sortBy === 'name') {
      const nameA = (a.workerName || '').toLowerCase();
      const nameB = (b.workerName || '').toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    }

    if (sortBy === 'workDate') {
      const dateA = String(a.workDate || '');
      const dateB = String(b.workDate || '');
      return sortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    }

    // Default: createdAt (newest first if desc, oldest first if asc)
    const timeA = new Date(a.createdAt || a.workDate).getTime() || 0;
    const timeB = new Date(b.createdAt || b.workDate).getTime() || 0;
    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginatedData = filtered.slice(offset, offset + limit);

  return res.json({
    data: paginatedData,
    pagination: {
      total,
      page,
      limit,
      offset,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
}

export async function exportAttendanceCsv(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  const records = await db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      status: attendanceSessions.status,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      worksiteName: worksites.name,
      shiftName: siteAssignments.shiftName,
      supervisorSnapshotId: attendanceSessions.supervisorSnapshotId,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .innerJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
    .where(eq(attendanceSessions.orgId as any, orgId as any))
    .orderBy(desc(attendanceSessions.workDate));

  const supervisorIds = [...new Set(records.map((r: any) => r.supervisorSnapshotId))];
  const supervisorMap: Record<string, string> = {};

  if (supervisorIds.length > 0) {
    const supervisors = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(sql`${users.id} IN (${sql.join(supervisorIds.map((id: string) => sql`${id}`), sql`, `)})`);

    for (const s of supervisors) {
      supervisorMap[s.id] = s.fullName;
    }
  }

  const headers = [
    'Work Date',
    'Employee Code',
    'Worker Name',
    'Worksite',
    'Shift',
    'Assigned Supervisor',
    'Status',
    'Clock In (UTC)',
    'Clock Out (UTC)',
  ];

  const rows = records.map((r: any) => [
    sanitizeCsvField(r.workDate),
    sanitizeCsvField(r.employeeCode),
    sanitizeCsvField(r.workerName),
    sanitizeCsvField(r.worksiteName),
    sanitizeCsvField(r.shiftName),
    sanitizeCsvField(supervisorMap[r.supervisorSnapshotId] || 'Unassigned'),
    sanitizeCsvField(r.status),
    sanitizeCsvField(r.clockInTime ? new Date(r.clockInTime).toISOString() : ''),
    sanitizeCsvField(r.clockOutTime ? new Date(r.clockOutTime).toISOString() : ''),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${Date.now()}.csv`);
  return res.send(csvContent);
}

export async function getAuditLogs(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '10'), 10) || 10));
  const offset = req.query.offset !== undefined
    ? Math.max(0, parseInt(String(req.query.offset), 10) || 0)
    : (page - 1) * limit;

  const sortBy = String(req.query.sortBy || 'createdAt');
  const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase();

  const allLogs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      actorId: auditLogs.actorId,
      actorName: users.fullName,
      actorNameSnapshot: auditLogs.actorNameSnapshot,
      actorRole: auditLogs.actorRole,
      actorEmail: users.email,
      reason: auditLogs.reason,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      beforeValues: auditLogs.beforeValues,
      afterValues: auditLogs.afterValues,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(eq(auditLogs.orgId as any, orgId as any));

  const resolvedLogs = allLogs.map((l: any) => ({
    ...l,
    actorName: l.actorNameSnapshot || l.actorName || (l.actorRole === 'SYSTEM' ? 'System Automated Service' : 'System User'),
    actorRole: l.actorRole || 'USER',
  }));

  resolvedLogs.sort((a: any, b: any) => {
    if (sortBy === 'name') {
      const nameA = (a.actorName || '').toLowerCase();
      const nameB = (b.actorName || '').toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    }
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const total = resolvedLogs.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginatedLogs = resolvedLogs.slice(offset, offset + limit);

  return res.json({
    data: paginatedLogs,
    pagination: {
      total,
      page,
      limit,
      offset,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
}

export async function getNotifications(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const userId = req.user!.id;

  const list = await db
    .select()
    .from(notifications)
    .where(and(
      eq(notifications.userId as any, userId as any),
      eq(notifications.isRead as any, false),
    ))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return res.json(list);
}

export async function markNotificationRead(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const userId = req.user!.id;

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id as any, id as any), eq(notifications.userId as any, userId as any)));

  return res.json({ success: true });
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const userId = req.user!.id;

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId as any, userId as any), eq(notifications.isRead as any, false)));

  return res.json({ success: true, message: 'All notifications marked as read' });
}

/**
 * GET /reports/attendance-overtime
 * Filterable attendance and overtime report with summary aggregates
 */
export async function getAttendanceOvertimeReport(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { startDate, endDate, worksiteId, workerId, supervisorId, status, otStatus } = req.query;

  const conditions = [eq(attendanceSessions.orgId as any, orgId as any)];

  if (startDate && typeof startDate === 'string') {
    conditions.push(gte(attendanceSessions.workDate as any, startDate as any));
  }
  if (endDate && typeof endDate === 'string') {
    conditions.push(lte(attendanceSessions.workDate as any, endDate as any));
  }
  if (worksiteId && typeof worksiteId === 'string') {
    conditions.push(eq(attendanceSessions.worksiteSnapshotId as any, worksiteId as any));
  }
  if (workerId && typeof workerId === 'string') {
    conditions.push(eq(attendanceSessions.workerId as any, workerId as any));
  }
  if (supervisorId && typeof supervisorId === 'string') {
    conditions.push(eq(attendanceSessions.supervisorSnapshotId as any, supervisorId as any));
  }
  if (status && typeof status === 'string' && status !== 'ALL') {
    conditions.push(eq(attendanceSessions.status as any, status as any));
  }
  if (otStatus && typeof otStatus === 'string' && otStatus !== 'ALL') {
    conditions.push(eq(attendanceSessions.otStatus as any, otStatus as any));
  }

  const records = await db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      status: attendanceSessions.status,
      standardHoursMinutes: attendanceSessions.standardHoursMinutes,
      breakDurationMinutes: attendanceSessions.breakDurationMinutes,
      netWorkingSeconds: attendanceSessions.netWorkingSeconds,
      calculatedOtMinutes: attendanceSessions.calculatedOtMinutes,
      approvedOtMinutes: attendanceSessions.approvedOtMinutes,
      otStatus: attendanceSessions.otStatus,
      isAutoApproved: attendanceSessions.isAutoApproved,
      exceptionStatus: attendanceSessions.exceptionStatus,
      isPayrollLocked: attendanceSessions.isPayrollLocked,
      workerId: users.id,
      workerName: users.fullName,
      employeeCode: users.employeeCode,
      worksiteId: worksites.id,
      worksiteName: worksites.name,
      shiftName: siteAssignments.shiftName,
    })
    .from(attendanceSessions)
    .innerJoin(users, eq(attendanceSessions.workerId, users.id))
    .innerJoin(worksites, eq(attendanceSessions.worksiteSnapshotId, worksites.id))
    .leftJoin(siteAssignments, eq(attendanceSessions.assignmentId, siteAssignments.id))
    .where(and(...conditions))
    .orderBy(desc(attendanceSessions.workDate));

  let totalScheduledStandardMinutes = 0;
  let totalNetWorkedMinutes = 0;
  let totalCalculatedOtMinutes = 0;
  let totalApprovedOtMinutes = 0;
  let totalPendingOtMinutes = 0;
  let totalRejectedOtMinutes = 0;
  let incompleteAttendanceCount = 0;
  let regularisationCount = 0;

  const workerMap = new Map<string, any>();
  const siteMap = new Map<string, any>();

  const items = records.map((r: any) => {
    const netMins = Math.floor((r.netWorkingSeconds || 0) / 60);
    const stdMins = r.standardHoursMinutes || 540;
    const isMissingClockOut = !r.clockOutTime;
    const isRegularized = r.exceptionStatus === 'CORRECTION_APPLIED';

    if (isMissingClockOut) incompleteAttendanceCount += 1;
    if (isRegularized) regularisationCount += 1;

    if (r.status === 'APPROVED' && !isMissingClockOut) {
      totalScheduledStandardMinutes += stdMins;
      totalNetWorkedMinutes += netMins;
      totalCalculatedOtMinutes += (r.calculatedOtMinutes || 0);
      totalApprovedOtMinutes += (r.approvedOtMinutes || 0);

      if (r.otStatus === 'PENDING') totalPendingOtMinutes += (r.calculatedOtMinutes || 0);
      if (r.otStatus === 'REJECTED') totalRejectedOtMinutes += (r.calculatedOtMinutes || 0);
    }

    // Worker aggregate
    if (!workerMap.has(r.workerId)) {
      workerMap.set(r.workerId, {
        workerId: r.workerId,
        workerName: r.workerName,
        employeeCode: r.employeeCode,
        workedMinutes: 0,
        approvedOtMinutes: 0,
        calculatedOtMinutes: 0,
        sessionsCount: 0,
      });
    }
    const w = workerMap.get(r.workerId);
    w.sessionsCount += 1;
    if (r.status === 'APPROVED' && !isMissingClockOut) {
      w.workedMinutes += netMins;
      w.approvedOtMinutes += (r.approvedOtMinutes || 0);
      w.calculatedOtMinutes += (r.calculatedOtMinutes || 0);
    }

    // Site aggregate
    if (!siteMap.has(r.worksiteId)) {
      siteMap.set(r.worksiteId, {
        worksiteId: r.worksiteId,
        worksiteName: r.worksiteName,
        workedMinutes: 0,
        approvedOtMinutes: 0,
        calculatedOtMinutes: 0,
        sessionsCount: 0,
      });
    }
    const s = siteMap.get(r.worksiteId);
    s.sessionsCount += 1;
    if (r.status === 'APPROVED' && !isMissingClockOut) {
      s.workedMinutes += netMins;
      s.approvedOtMinutes += (r.approvedOtMinutes || 0);
      s.calculatedOtMinutes += (r.calculatedOtMinutes || 0);
    }

    return {
      id: r.id,
      workDate: typeof r.workDate === 'string' ? r.workDate.split('T')[0] : new Date(r.workDate).toISOString().split('T')[0],
      workerId: r.workerId,
      workerName: r.workerName,
      employeeCode: r.employeeCode,
      worksiteName: r.worksiteName,
      shiftName: r.shiftName || 'Standard',
      clockInTime: r.clockInTime,
      clockOutTime: r.clockOutTime,
      status: r.status,
      standardHoursMinutes: stdMins,
      breakDurationMinutes: r.breakDurationMinutes || 0,
      netWorkingMinutes: netMins,
      calculatedOtMinutes: r.calculatedOtMinutes || 0,
      approvedOtMinutes: r.approvedOtMinutes || 0,
      otStatus: r.otStatus,
      isAutoApproved: r.isAutoApproved,
      exceptionStatus: r.exceptionStatus,
      isPayrollLocked: Boolean(r.isPayrollLocked),
      formattedNetHours: formatMinutes(netMins),
      formattedCalculatedOt: formatMinutes(r.calculatedOtMinutes || 0),
      formattedApprovedOt: formatMinutes(r.approvedOtMinutes || 0),
      hasMissingClockOut: isMissingClockOut,
    };
  });

  return res.json({
    metrics: {
      totalRecords: records.length,
      totalScheduledStandardHoursFormatted: formatMinutes(totalScheduledStandardMinutes),
      totalNetWorkedHoursFormatted: formatMinutes(totalNetWorkedMinutes),
      totalCalculatedOtFormatted: formatMinutes(totalCalculatedOtMinutes),
      totalApprovedOtFormatted: formatMinutes(totalApprovedOtMinutes),
      totalPendingOtFormatted: formatMinutes(totalPendingOtMinutes),
      totalRejectedOtFormatted: formatMinutes(totalRejectedOtMinutes),
      incompleteAttendanceCount,
      regularisationCount,
    },
    workerTotals: Array.from(workerMap.values()).map((w) => ({
      ...w,
      formattedWorkedHours: formatMinutes(w.workedMinutes),
      formattedApprovedOt: formatMinutes(w.approvedOtMinutes),
    })),
    siteTotals: Array.from(siteMap.values()).map((s) => ({
      ...s,
      formattedWorkedHours: formatMinutes(s.workedMinutes),
      formattedApprovedOt: formatMinutes(s.approvedOtMinutes),
    })),
    records: items,
  });
}

/**
 * GET /reports/expenses-summary
 * Site expense aggregates by site and category
 */
export async function getExpensesSummaryReport(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;
  const { startDate, endDate, worksiteId, status } = req.query;

  const conditions = [eq(siteExpenses.orgId as any, orgId as any)];
  if (startDate && typeof startDate === 'string') conditions.push(gte(siteExpenses.date as any, startDate as any));
  if (endDate && typeof endDate === 'string') conditions.push(lte(siteExpenses.date as any, endDate as any));
  if (worksiteId && typeof worksiteId === 'string') conditions.push(eq(siteExpenses.worksiteId as any, worksiteId as any));
  if (status && typeof status === 'string' && status !== 'ALL') conditions.push(eq(siteExpenses.status as any, status as any));

  const records = await db
    .select({
      id: siteExpenses.id,
      amount: siteExpenses.amount,
      category: siteExpenses.category,
      status: siteExpenses.status,
      date: siteExpenses.date,
      worksiteId: siteExpenses.worksiteId,
      worksiteName: worksites.name,
    })
    .from(siteExpenses)
    .innerJoin(worksites, eq(siteExpenses.worksiteId, worksites.id))
    .where(and(...conditions));

  let totalExpensesAmount = 0;
  let totalApprovedAmount = 0;
  let totalPendingAmount = 0;
  let totalRejectedAmount = 0;

  const categoryMap = new Map<string, number>();
  const siteMap = new Map<string, { siteName: string; total: number; approved: number }>();

  records.forEach((r: any) => {
    const amt = Number(r.amount) || 0;
    totalExpensesAmount += amt;

    if (r.status === 'APPROVED') totalApprovedAmount += amt;
    else if (r.status === 'REJECTED') totalRejectedAmount += amt;
    else totalPendingAmount += amt;

    categoryMap.set(r.category, (categoryMap.get(r.category) || 0) + amt);

    if (!siteMap.has(r.worksiteId)) {
      siteMap.set(r.worksiteId, { siteName: r.worksiteName, total: 0, approved: 0 });
    }
    const s = siteMap.get(r.worksiteId)!;
    s.total += amt;
    if (r.status === 'APPROVED') s.approved += amt;
  });

  return res.json({
    totalCount: records.length,
    totalExpensesAmount,
    totalApprovedAmount,
    totalPendingAmount,
    totalRejectedAmount,
    categoryDistribution: Object.fromEntries(categoryMap),
    siteDistribution: Array.from(siteMap.entries()).map(([worksiteId, val]) => ({
      worksiteId,
      worksiteName: val.siteName,
      totalAmount: val.total,
      approvedAmount: val.approved,
    })),
  });
}

