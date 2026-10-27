import 'dotenv/config';
import { getDb } from './src/database/db.js';
import { sql } from 'drizzle-orm';

async function main() {
  const db = await getDb();

  const reqRow = await db.execute(sql`
    SELECT id, session_id, requesting_user_id, status, review_note, reviewer_id, current_approver_id, work_date, reason
    FROM attendance_adjustment_requests
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log('ALL REGULARIZATION REQUESTS:', JSON.stringify(reqRow.rows, null, 2));

  const sessionRow = await db.execute(sql`
    SELECT id, worker_id, work_date, status, exception_status, rejection_reason
    FROM attendance_sessions
    WHERE id = 'e53e4453-273d-4971-bba6-4a0d7d70395a'
  `);
  console.log('TARGET SESSION:', JSON.stringify(sessionRow.rows, null, 2));


  const angelAssignments = await db.execute(sql`
    SELECT sa.id, sa.work_date, sa.worksite_id, w.name as worksite_name, sa.supervisor_id
    FROM site_assignments sa
    LEFT JOIN worksites w ON sa.worksite_id = w.id
    WHERE sa.supervisor_id = '0fe3ad28-6194-42db-b74c-5b34eb9d44b7'
    ORDER BY sa.work_date DESC
    LIMIT 5
  `);
  console.log('ANGEL ASSIGNMENTS:', JSON.stringify(angelAssignments.rows, null, 2));
}

main().catch(console.error);

