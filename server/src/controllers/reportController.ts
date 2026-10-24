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
} from '../database/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

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
      actorName: users.fullName,
      actorEmail: users.email,
      ipAddress: auditLogs.ipAddress,
      beforeValues: auditLogs.beforeValues,
      afterValues: auditLogs.afterValues,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(eq(auditLogs.orgId as any, orgId as any));

  allLogs.sort((a: any, b: any) => {
    if (sortBy === 'name') {
      const nameA = (a.actorName || '').toLowerCase();
      const nameB = (b.actorName || '').toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    }
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const total = allLogs.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginatedLogs = allLogs.slice(offset, offset + limit);

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
    .where(eq(notifications.userId as any, userId as any))
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
