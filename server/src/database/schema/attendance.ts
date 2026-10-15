import { pgTable, uuid, varchar, text, boolean, doublePrecision, timestamp, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { siteAssignments } from './assignments';
import { users } from './users';
import { worksites } from './worksites';
import { approvalActions } from './approvals';
import { attendanceAdjustmentRequests } from './adjustments';

export const attendanceSessions = pgTable('attendance_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  assignmentId: uuid('assignment_id').references(() => siteAssignments.id).notNull(),
  workerId: uuid('worker_id').references(() => users.id).notNull(),
  supervisorSnapshotId: uuid('supervisor_snapshot_id').references(() => users.id).notNull(),
  worksiteSnapshotId: uuid('worksite_snapshot_id').references(() => worksites.id).notNull(),
  workDate: date('work_date').notNull(),
  status: varchar('status', { length: 50 }).default('PENDING').notNull(), // 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),
  clockInTime: timestamp('clock_in_time', { withTimezone: true }),
  clockOutTime: timestamp('clock_out_time', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const attendanceEvents = pgTable('attendance_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => attendanceSessions.id).notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(), // 'CLOCK_IN', 'CLOCK_OUT'
  eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  reportedAccuracyMeters: doublePrecision('reported_accuracy_meters').notNull(),
  calculatedDistanceMeters: doublePrecision('calculated_distance_meters').notNull(),
  isWithinGeofence: boolean('is_within_geofence').notNull(),
  photoObjectKey: varchar('photo_object_key', { length: 500 }).notNull(),
  photoUrl: text('photo_url').notNull(),
  clientDeviceInfo: text('client_device_info'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const attendanceSessionsRelations = relations(attendanceSessions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [attendanceSessions.orgId],
    references: [organizations.id],
  }),
  assignment: one(siteAssignments, {
    fields: [attendanceSessions.assignmentId],
    references: [siteAssignments.id],
  }),
  worker: one(users, {
    fields: [attendanceSessions.workerId],
    references: [users.id],
    relationName: 'worker',
  }),
  supervisorSnapshot: one(users, {
    fields: [attendanceSessions.supervisorSnapshotId],
    references: [users.id],
    relationName: 'supervisorSnapshot',
  }),
  worksiteSnapshot: one(worksites, {
    fields: [attendanceSessions.worksiteSnapshotId],
    references: [worksites.id],
  }),
  events: many(attendanceEvents),
  approvalActions: many(approvalActions),
  adjustmentRequests: many(attendanceAdjustmentRequests),
}));

export const attendanceEventsRelations = relations(attendanceEvents, ({ one }) => ({
  session: one(attendanceSessions, {
    fields: [attendanceEvents.sessionId],
    references: [attendanceSessions.id],
  }),
}));

export type AttendanceSession = typeof attendanceSessions.$inferSelect;
export type NewAttendanceSession = typeof attendanceSessions.$inferInsert;
export type AttendanceEvent = typeof attendanceEvents.$inferSelect;
export type NewAttendanceEvent = typeof attendanceEvents.$inferInsert;
