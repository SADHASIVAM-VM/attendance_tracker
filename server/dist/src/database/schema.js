import { pgTable, uuid, varchar, text, boolean, integer, doublePrecision, timestamp, date } from 'drizzle-orm/pg-core';
// Organizations
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
// Users
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    employeeCode: varchar('employee_code', { length: 50 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }),
    dob: varchar('dob', { length: 20 }),
    photoUrl: text('photo_url'),
    nativePlace: varchar('native_place', { length: 255 }),
    emergencyPhone: varchar('emergency_phone', { length: 50 }),
    bloodGroup: varchar('blood_group', { length: 10 }),
    gender: varchar('gender', { length: 20 }),
    address: text('address'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// User Roles
export const userRoles = pgTable('user_roles', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    role: varchar('role', { length: 50 }).notNull(), // 'SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'WORKER'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
// Worksites
export const worksites = pgTable('worksites', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }).notNull(),
    address: text('address').notNull(),
    description: text('description'),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    radiusMeters: integer('radius_meters').default(20).notNull(),
    maxAccuracyMeters: integer('max_accuracy_meters').default(50).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// Daily Site Assignments
export const siteAssignments = pgTable('site_assignments', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    worksiteId: uuid('worksite_id').references(() => worksites.id).notNull(),
    supervisorId: uuid('supervisor_id').references(() => users.id).notNull(),
    workDate: date('work_date').notNull(), // YYYY-MM-DD
    groupName: varchar('group_name', { length: 100 }),
    shiftName: varchar('shift_name', { length: 100 }).notNull(),
    shiftStartTime: varchar('shift_start_time', { length: 10 }).notNull(), // HH:mm
    shiftEndTime: varchar('shift_end_time', { length: 10 }).notNull(), // HH:mm
    status: varchar('status', { length: 50 }).default('DRAFT').notNull(), // 'DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'
    cancellationReason: text('cancellation_reason'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// Site Assignment Workers
export const siteAssignmentWorkers = pgTable('site_assignment_workers', {
    id: uuid('id').defaultRandom().primaryKey(),
    assignmentId: uuid('assignment_id').references(() => siteAssignments.id).notNull(),
    workerId: uuid('worker_id').references(() => users.id).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
// Attendance Sessions
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
// Attendance Events
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
// Approval Actions
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
// Attendance Adjustment Requests (Regularization)
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
// Leave Types
export const leaveTypes = pgTable('leave_types', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    code: varchar('code', { length: 50 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
// Leave Requests
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
// Notifications
export const notifications = pgTable('notifications', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: uuid('entity_id'),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
// Audit Logs
export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id),
    actorId: uuid('actor_id').references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 50 }),
    userAgent: text('user_agent'),
    beforeValues: text('before_values'), // JSON string
    afterValues: text('after_values'), // JSON string
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
