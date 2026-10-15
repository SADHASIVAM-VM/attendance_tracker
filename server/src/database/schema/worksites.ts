import { pgTable, uuid, varchar, text, boolean, integer, doublePrecision, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { siteAssignments } from './assignments';
import { attendanceSessions } from './attendance';

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

export const worksitesRelations = relations(worksites, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [worksites.orgId],
    references: [organizations.id],
  }),
  siteAssignments: many(siteAssignments),
  attendanceSessions: many(attendanceSessions),
}));

export type Worksite = typeof worksites.$inferSelect;
export type NewWorksite = typeof worksites.$inferInsert;
