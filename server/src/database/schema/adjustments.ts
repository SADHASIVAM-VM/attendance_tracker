import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { attendanceSessions } from './attendance';
import { users } from './users';

export const attendanceAdjustmentRequests = pgTable('attendance_adjustment_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => attendanceSessions.id).notNull(),
  requestingUserId: uuid('requesting_user_id').references(() => users.id).notNull(),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  reason: text('reason').notNull(),
  proposedClockInTime: timestamp('proposed_clock_in_time', { withTimezone: true }),
  proposedClockOutTime: timestamp('proposed_clock_out_time', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('PENDING').notNull(), // 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
  reviewNote: text('review_note'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const attendanceAdjustmentRequestsRelations = relations(attendanceAdjustmentRequests, ({ one }) => ({
  session: one(attendanceSessions, {
    fields: [attendanceAdjustmentRequests.sessionId],
    references: [attendanceSessions.id],
  }),
  requestingUser: one(users, {
    fields: [attendanceAdjustmentRequests.requestingUserId],
    references: [users.id],
    relationName: 'requester',
  }),
  reviewer: one(users, {
    fields: [attendanceAdjustmentRequests.reviewerId],
    references: [users.id],
    relationName: 'reviewer',
  }),
}));

export type AttendanceAdjustmentRequest = typeof attendanceAdjustmentRequests.$inferSelect;
export type NewAttendanceAdjustmentRequest = typeof attendanceAdjustmentRequests.$inferInsert;
