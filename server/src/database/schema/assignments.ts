import { pgTable, uuid, varchar, text, timestamp, date, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { worksites } from './worksites';
import { users } from './users';
import { attendanceSessions } from './attendance';

export const siteAssignments = pgTable('site_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  worksiteId: uuid('worksite_id').references(() => worksites.id).notNull(),
  supervisorId: uuid('supervisor_id').references(() => users.id).notNull(),
  workDate: date('work_date').notNull(), // YYYY-MM-DD
  groupName: varchar('group_name', { length: 100 }),
  shiftName: varchar('shift_name', { length: 100 }).notNull(),
  shiftStartTime: varchar('shift_start_time', { length: 10 }).notNull(), // HH:mm
  shiftEndTime: varchar('shift_end_time', { length: 10 }).notNull(),   // HH:mm
  status: varchar('status', { length: 50 }).default('DRAFT').notNull(), // 'DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'
  cancellationReason: text('cancellation_reason'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const siteAssignmentWorkers = pgTable(
  'site_assignment_workers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assignmentId: uuid('assignment_id').references(() => siteAssignments.id).notNull(),
    workerId: uuid('worker_id').references(() => users.id).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('site_assignment_workers_assignment_worker_idx').on(table.assignmentId, table.workerId),
  ]
);

export const siteAssignmentsRelations = relations(siteAssignments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [siteAssignments.orgId],
    references: [organizations.id],
  }),
  worksite: one(worksites, {
    fields: [siteAssignments.worksiteId],
    references: [worksites.id],
  }),
  supervisor: one(users, {
    fields: [siteAssignments.supervisorId],
    references: [users.id],
    relationName: 'supervisor',
  }),
  createdByUser: one(users, {
    fields: [siteAssignments.createdBy],
    references: [users.id],
    relationName: 'creator',
  }),
  workers: many(siteAssignmentWorkers),
  attendanceSessions: many(attendanceSessions),
}));

export const siteAssignmentWorkersRelations = relations(siteAssignmentWorkers, ({ one }) => ({
  assignment: one(siteAssignments, {
    fields: [siteAssignmentWorkers.assignmentId],
    references: [siteAssignments.id],
  }),
  worker: one(users, {
    fields: [siteAssignmentWorkers.workerId],
    references: [users.id],
  }),
}));

export type SiteAssignment = typeof siteAssignments.$inferSelect;
export type NewSiteAssignment = typeof siteAssignments.$inferInsert;
export type SiteAssignmentWorker = typeof siteAssignmentWorkers.$inferSelect;
export type NewSiteAssignmentWorker = typeof siteAssignmentWorkers.$inferInsert;
