import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { attendanceSessions } from './attendance';
import { users } from './users';

export const approvalActions = pgTable('approval_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => attendanceSessions.id).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // 'APPROVED', 'REJECTED', 'TRANSFERRED', 'ADMIN_OVERRIDE'
  reviewerId: uuid('reviewer_id').references(() => users.id).notNull(),
  previousSupervisorId: uuid('previous_supervisor_id').references(() => users.id),
  note: text('note'),
  reason: text('reason'),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const approvalActionsRelations = relations(approvalActions, ({ one }) => ({
  session: one(attendanceSessions, {
    fields: [approvalActions.sessionId],
    references: [attendanceSessions.id],
  }),
  reviewer: one(users, {
    fields: [approvalActions.reviewerId],
    references: [users.id],
  }),
  previousSupervisor: one(users, {
    fields: [approvalActions.previousSupervisorId],
    references: [users.id],
  }),
}));

export type ApprovalAction = typeof approvalActions.$inferSelect;
export type NewApprovalAction = typeof approvalActions.$inferInsert;
