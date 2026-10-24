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
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS clock_out_source VARCHAR(50) DEFAULT 'WORKER_SELF';
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
          ALTER TABLE site_assignments ADD COLUMN IF NOT EXISTS fallback_supervisor_id UUID REFERENCES users(id);
          ALTER TABLE site_assignments ADD COLUMN IF NOT EXISTS escalation_deadline_hours INTEGER DEFAULT 24;
          UPDATE site_assignments SET carry_forward = true WHERE carry_forward IS NULL;

          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS current_approver_id UUID REFERENCES users(id);
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT false;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS exception_status VARCHAR(50) DEFAULT 'NONE';

          ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS current_approver_id UUID REFERENCES users(id);
          ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT false;
          ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
          ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS conflict_status VARCHAR(50) DEFAULT 'NONE';
          ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS conflict_details TEXT;
          ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
          ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id);

          ALTER TABLE attendance_adjustment_requests ADD COLUMN IF NOT EXISTS current_approver_id UUID REFERENCES users(id);
          ALTER TABLE attendance_adjustment_requests ADD COLUMN IF NOT EXISTS correction_type VARCHAR(50) DEFAULT 'INCORRECT_HOURS';
          ALTER TABLE attendance_adjustment_requests ADD COLUMN IF NOT EXISTS work_date DATE;
          ALTER TABLE attendance_adjustment_requests ADD COLUMN IF NOT EXISTS supporting_evidence_url TEXT;
          ALTER TABLE attendance_adjustment_requests ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT false;
          ALTER TABLE attendance_adjustment_requests ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE attendance_adjustment_requests ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name_snapshot VARCHAR(255);
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50);
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata TEXT;

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

          CREATE TABLE IF NOT EXISTS attendance_exceptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id),
            worker_id UUID NOT NULL REFERENCES users(id),
            worksite_id UUID REFERENCES worksites(id),
            assignment_id UUID REFERENCES site_assignments(id),
            session_id UUID REFERENCES attendance_sessions(id),
            leave_request_id UUID REFERENCES leave_requests(id),
            work_date DATE NOT NULL,
            exception_type VARCHAR(50) NOT NULL,
            severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
            status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
            primary_supervisor_id UUID REFERENCES users(id),
            current_approver_id UUID REFERENCES users(id),
            is_escalated BOOLEAN NOT NULL DEFAULT false,
            escalated_at TIMESTAMP WITH TIME ZONE,
            escalation_reason TEXT,
            resolution_type VARCHAR(50),
            resolution_note TEXT,
            resolved_by UUID REFERENCES users(id),
            resolved_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_att_exceptions_org_date ON attendance_exceptions(org_id, work_date);
          CREATE INDEX IF NOT EXISTS idx_att_exceptions_worker ON attendance_exceptions(worker_id);
          CREATE INDEX IF NOT EXISTS idx_att_exceptions_status ON attendance_exceptions(status);
          CREATE INDEX IF NOT EXISTS idx_att_exceptions_approver ON attendance_exceptions(current_approver_id);

          -- Phase 3: Overtime, Expenses Approval, and Payroll Reconciliation
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS standard_hours_minutes INTEGER DEFAULT 540;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER DEFAULT 0;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS calculated_ot_minutes INTEGER DEFAULT 0;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS approved_ot_minutes INTEGER DEFAULT 0;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS ot_status VARCHAR(50) DEFAULT 'NONE';
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS ot_reviewer_id UUID REFERENCES users(id);
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS ot_reviewed_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS ot_rejection_reason TEXT;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS policy_version_snapshot VARCHAR(50) DEFAULT 'v1.0';
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS is_payroll_locked BOOLEAN DEFAULT false;
          ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS payroll_period_id UUID;

          ALTER TABLE site_expenses ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
          ALTER TABLE site_expenses ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';
          ALTER TABLE site_expenses ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id);
          ALTER TABLE site_expenses ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE site_expenses ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
          ALTER TABLE site_expenses ADD COLUMN IF NOT EXISTS payroll_period_id UUID;

          CREATE TABLE IF NOT EXISTS payroll_periods (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id),
            name VARCHAR(255) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
            total_workers INTEGER NOT NULL DEFAULT 0,
            total_standard_minutes INTEGER NOT NULL DEFAULT 0,
            total_worked_minutes INTEGER NOT NULL DEFAULT 0,
            total_calculated_ot_minutes INTEGER NOT NULL DEFAULT 0,
            total_approved_ot_minutes INTEGER NOT NULL DEFAULT 0,
            total_approved_expenses DOUBLE PRECISION NOT NULL DEFAULT 0,
            exception_count INTEGER NOT NULL DEFAULT 0,
            finalized_by UUID REFERENCES users(id),
            finalized_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS payroll_adjustments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
            worker_id UUID NOT NULL REFERENCES users(id),
            adjustment_type VARCHAR(50) NOT NULL,
            amount_or_minutes DOUBLE PRECISION NOT NULL,
            reason TEXT NOT NULL,
            adjusted_by UUID NOT NULL REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_payroll_periods_org ON payroll_periods(org_id, start_date, end_date);
          CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_period ON payroll_adjustments(payroll_period_id);
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