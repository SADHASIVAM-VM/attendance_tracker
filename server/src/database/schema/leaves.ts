import { pgTable, uuid, varchar, text, boolean, timestamp, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { users } from './users';

export const leaveTypes = pgTable('leave_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isHalfDay: boolean('is_half_day').default(false).notNull(),
  halfDayPeriod: varchar('half_day_period', { length: 20 }), // 'FIRST_HALF', 'SECOND_HALF'
  reason: text('reason').notNull(),
  status: varchar('status', { length: 50 }).default('PENDING').notNull(), // 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
  reviewerId: uuid('reviewer_id').references(() => users.id),
  decisionNote: text('decision_note'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leaveTypesRelations = relations(leaveTypes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [leaveTypes.orgId],
    references: [organizations.id],
  }),
  leaveRequests: many(leaveRequests),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [leaveRequests.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [leaveRequests.userId],
    references: [users.id],
    relationName: 'user',
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveRequests.leaveTypeId],
    references: [leaveTypes.id],
  }),
  reviewer: one(users, {
    fields: [leaveRequests.reviewerId],
    references: [users.id],
    relationName: 'reviewer',
  }),
}));

export type LeaveType = typeof leaveTypes.$inferSelect;
export type NewLeaveType = typeof leaveTypes.$inferInsert;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type NewLeaveRequest = typeof leaveRequests.$inferInsert;
