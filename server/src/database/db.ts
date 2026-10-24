import { drizzle } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';


let dbInstance: any = null;
let pgPoolInstance: pg.Pool | null = null;

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

      // Safe schema enhancements for supervisor attendance, location bypass, location visits, and carry forward
      try {
        await pool.query(`
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS supervisor_auto_approve BOOLEAN DEFAULT true;
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS supervisor_bypass_location BOOLEAN DEFAULT true;
          ALTER TABLE attendance_events ADD COLUMN IF NOT EXISTS is_location_bypassed BOOLEAN DEFAULT false;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS is_auto_approved BOOLEAN DEFAULT false;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS auto_approval_reason TEXT;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS approval_source VARCHAR(50) DEFAULT 'MANUAL';
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS total_duration_seconds INTEGER DEFAULT 0;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS net_working_seconds INTEGER DEFAULT 0;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS active_location_id UUID REFERENCES worksites(id);
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS active_location_started_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS clock_in_latitude DOUBLE PRECISION;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS clock_in_longitude DOUBLE PRECISION;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS clock_in_accuracy DOUBLE PRECISION;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS clock_out_latitude DOUBLE PRECISION;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS clock_out_longitude DOUBLE PRECISION;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS clock_out_accuracy DOUBLE PRECISION;
          ALTER TABLE site_assignments ADD COLUMN IF NOT EXISTS carry_forward BOOLEAN DEFAULT true;
          ALTER TABLE site_assignments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
          UPDATE site_assignments SET carry_forward = true WHERE carry_forward IS NULL;

          CREATE TABLE IF NOT EXISTS supervisor_location_visits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
            supervisor_id UUID NOT NULL REFERENCES users(id),
            location_id UUID NOT NULL REFERENCES worksites(id),
            location_name_snapshot VARCHAR(255) NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL,
            ended_at TIMESTAMP WITH TIME ZONE,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            start_latitude DOUBLE PRECISION,
            start_longitude DOUBLE PRECISION,
            end_latitude DOUBLE PRECISION,
            end_longitude DOUBLE PRECISION,
            gps_accuracy_meters DOUBLE PRECISION,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_sup_visits_session ON supervisor_location_visits(session_id);
          CREATE INDEX IF NOT EXISTS idx_sup_visits_sup_date ON supervisor_location_visits(supervisor_id, started_at);
        `);
      } catch (migrationErr) {
        console.warn('Note on schema column check:', migrationErr);
      }

      pgPoolInstance = pool;
      dbInstance = drizzlePg(pool, { schema });
      return dbInstance;
    } catch (err) {
      console.warn('⚠️ Could not connect to external PostgreSQL, falling back to embedded PostgreSQL (PGlite):', err);
    }
  }

  return dbInstance;
}