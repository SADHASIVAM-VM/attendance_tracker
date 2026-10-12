import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
let dbInstance = null;
let pgliteInstance = null;
let pgPoolInstance = null;
export async function getDb() {
    if (dbInstance) {
        return dbInstance;
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl && !databaseUrl.startsWith('memory://') && databaseUrl.startsWith('postgres')) {
        try {
            const pool = new pg.Pool({
                connectionString: databaseUrl,
                ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
            });
            // Test connection
            await pool.query('SELECT 1');
            console.log('✅ Connected to external PostgreSQL database via DATABASE_URL');
            pgPoolInstance = pool;
            dbInstance = drizzlePg(pool, { schema });
            return dbInstance;
        }
        catch (err) {
            console.warn('⚠️ Could not connect to external PostgreSQL, falling back to embedded PostgreSQL (PGlite):', err);
        }
    }
    pgliteInstance = new PGlite();
    await pgliteInstance.waitReady;
    dbInstance = drizzle(pgliteInstance, { schema });
    console.log(`✅ Connected to embedded PostgreSQL database`);
    // Auto-create tables if they don't exist yet
    await initializeTables(pgliteInstance);
    return dbInstance;
}
async function initializeTables(client) {
    // Execute DDL for embedded postgres if needed
    await client.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      timezone VARCHAR(50) DEFAULT 'UTC' NOT NULL,
      default_geofence_radius INTEGER DEFAULT 20 NOT NULL,
      max_location_accuracy INTEGER DEFAULT 50 NOT NULL,
      allow_admin_clock_in_approval BOOLEAN DEFAULT FALSE NOT NULL,
      clock_out_enabled BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      employee_code VARCHAR(50) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      full_name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worksites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      address TEXT NOT NULL,
      description TEXT,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      radius_meters INTEGER DEFAULT 20 NOT NULL,
      max_accuracy_meters INTEGER DEFAULT 50 NOT NULL,
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      worksite_id UUID NOT NULL REFERENCES worksites(id),
      supervisor_id UUID NOT NULL REFERENCES users(id),
      work_date DATE NOT NULL,
      group_name VARCHAR(100),
      shift_name VARCHAR(100) NOT NULL,
      shift_start_time VARCHAR(10) NOT NULL,
      shift_end_time VARCHAR(10) NOT NULL,
      status VARCHAR(50) DEFAULT 'DRAFT' NOT NULL,
      cancellation_reason TEXT,
      published_at TIMESTAMPTZ,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    ALTER TABLE site_assignments ADD COLUMN IF NOT EXISTS group_name VARCHAR(100);

    CREATE TABLE IF NOT EXISTS site_assignment_workers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id UUID NOT NULL REFERENCES site_assignments(id),
      worker_id UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      UNIQUE(assignment_id, worker_id)
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      assignment_id UUID NOT NULL REFERENCES site_assignments(id),
      worker_id UUID NOT NULL REFERENCES users(id),
      supervisor_snapshot_id UUID NOT NULL REFERENCES users(id),
      worksite_snapshot_id UUID NOT NULL REFERENCES worksites(id),
      work_date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
      idempotency_key VARCHAR(255) NOT NULL UNIQUE,
      clock_in_time TIMESTAMPTZ,
      clock_out_time TIMESTAMPTZ,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES attendance_sessions(id),
      event_type VARCHAR(50) NOT NULL,
      event_timestamp TIMESTAMPTZ NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      reported_accuracy_meters DOUBLE PRECISION NOT NULL,
      calculated_distance_meters DOUBLE PRECISION NOT NULL,
      is_within_geofence BOOLEAN NOT NULL,
      photo_object_key VARCHAR(500) NOT NULL,
      photo_url TEXT NOT NULL,
      client_device_info TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approval_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES attendance_sessions(id),
      action VARCHAR(50) NOT NULL,
      reviewer_id UUID NOT NULL REFERENCES users(id),
      previous_supervisor_id UUID REFERENCES users(id),
      note TEXT,
      reason TEXT,
      performed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_adjustment_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES attendance_sessions(id),
      requesting_user_id UUID NOT NULL REFERENCES users(id),
      reviewer_id UUID REFERENCES users(id),
      reason TEXT NOT NULL,
      proposed_clock_in_time TIMESTAMPTZ,
      proposed_clock_out_time TIMESTAMPTZ,
      status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
      review_note TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leave_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      user_id UUID NOT NULL REFERENCES users(id),
      leave_type_id UUID NOT NULL REFERENCES leave_types(id),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_half_day BOOLEAN DEFAULT FALSE NOT NULL,
      half_day_period VARCHAR(20),
      reason TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
      reviewer_id UUID REFERENCES users(id),
      decision_note TEXT,
      decided_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50),
      entity_id UUID,
      is_read BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES organizations(id),
      actor_id UUID REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100) NOT NULL,
      entity_id VARCHAR(255),
      ip_address VARCHAR(50),
      user_agent TEXT,
      before_values TEXT,
      after_values TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `);
}
