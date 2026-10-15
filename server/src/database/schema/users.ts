import { pgTable, uuid, varchar, boolean, timestamp, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { siteAssignments, siteAssignmentWorkers } from './assignments';
import { attendanceSessions } from './attendance';
import { approvalActions } from './approvals';
import { attendanceAdjustmentRequests } from './adjustments';
import { leaveRequests } from './leaves';
import { notifications } from './notifications';
import { auditLogs } from './audit';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  employeeCode: varchar('employee_code', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  dob: varchar('dob', { length: 20 }), // Date of birth YYYY-MM-DD
  photoUrl: text('photo_url'), // Profile Photo URL / Avatar
  nativePlace: varchar('native_place', { length: 255 }), // Native place / hometown
  emergencyPhone: varchar('emergency_phone', { length: 50 }), // Emergency contact number
  bloodGroup: varchar('blood_group', { length: 10 }), // Blood Group e.g. O+, A+, B+
  gender: varchar('gender', { length: 20 }), // Gender
  address: text('address'), // Residential address
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // 'SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'WORKER'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  roles: many(userRoles),
  supervisedAssignments: many(siteAssignments, { relationName: 'supervisor' }),
  createdAssignments: many(siteAssignments, { relationName: 'creator' }),
  workerAssignments: many(siteAssignmentWorkers),
  attendanceSessions: many(attendanceSessions, { relationName: 'worker' }),
  supervisorSnapshotSessions: many(attendanceSessions, { relationName: 'supervisorSnapshot' }),
  approvalActions: many(approvalActions),
  adjustmentRequests: many(attendanceAdjustmentRequests, { relationName: 'requester' }),
  reviewedAdjustmentRequests: many(attendanceAdjustmentRequests, { relationName: 'reviewer' }),
  leaveRequests: many(leaveRequests, { relationName: 'user' }),
  reviewedLeaveRequests: many(leaveRequests, { relationName: 'reviewer' }),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
