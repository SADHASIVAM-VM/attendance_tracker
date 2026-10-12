import { Request, Response } from 'express';
import { getDb } from '../database/db.js';
import {
  attendanceSessions,
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

  const records = await db
    .select({
      id: attendanceSessions.id,
      workDate: attendanceSessions.workDate,
      status: attendanceSessions.status,
      clockInTime: attendanceSessions.clockInTime,
      clockOutTime: attendanceSessions.clockOutTime,
      rejectionReason: attendanceSessions.rejectionReason,
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

  let filtered = records.map((r: any) => ({
    ...r,
    historicalSupervisorName: supervisorMap[r.supervisorSnapshotId] || 'Unassigned',
    missingClockOut: r.status === 'APPROVED' && !r.clockOutTime,
  }));

  if (startDate) filtered = filtered.filter((r: any) => r.workDate >= String(startDate));
  if (endDate) filtered = filtered.filter((r: any) => r.workDate <= String(endDate));
  if (worksiteId) filtered = filtered.filter((r: any) => r.worksiteId === String(worksiteId));
  if (workerId) filtered = filtered.filter((r: any) => r.workerId === String(workerId));
  if (status) filtered = filtered.filter((r: any) => r.status === String(status));

  return res.json(filtered);
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

  const logs = await db
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
    .where(eq(auditLogs.orgId as any, orgId as any))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return res.json(logs);
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
