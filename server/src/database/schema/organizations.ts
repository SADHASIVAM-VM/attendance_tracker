import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { worksites } from './worksites';
import { siteAssignments } from './assignments';
import { leaveTypes, leaveRequests } from './leaves';
import { auditLogs } from './audit';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
  defaultGeofenceRadius: integer('default_geofence_radius').default(20).notNull(),
  maxLocationAccuracy: integer('max_location_accuracy').default(50).notNull(),
  allowAdminClockInApproval: boolean('allow_admin_clock_in_approval').default(false).notNull(),
  clockOutEnabled: boolean('clock_out_enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  worksites: many(worksites),
  siteAssignments: many(siteAssignments),
  leaveTypes: many(leaveTypes),
  leaveRequests: many(leaveRequests),
  auditLogs: many(auditLogs),
}));

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
