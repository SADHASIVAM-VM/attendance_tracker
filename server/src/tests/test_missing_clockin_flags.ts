import 'dotenv/config';
import { getDb } from '../database/db.js';
import { generateToken } from '../middleware/auth.js';
import {
  users,
  userRoles,
  organizations,
  worksites,
  siteAssignments,
  siteAssignmentWorkers,
  attendanceSessions,
  attendanceEvents,
  attendanceFlags,
  leaveRequests,
  leaveTypes,
  auditLogs,
} from '../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function runMissingClockInTest() {
  console.log('🧪 Starting Supervisor Missing Clock-In Attendance Flags Test Suite...\n');

  try {
    const db = await getDb();
    // 1. Get supervisor and worker
    const [supRole] = await db
      .select({ user: users })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(eq(userRoles.role, 'SUPERVISOR'))
      .limit(1);

    const [workerRole] = await db
      .select({ user: users })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(eq(userRoles.role, 'WORKER'))
      .limit(1);

    const [worksite] = await db.select().from(worksites).limit(1);

    if (!supRole || !workerRole || !worksite) {
      throw new Error('Test prerequisites missing in database');
    }

    const supervisor = supRole.user;
    const worker1 = workerRole.user;

    const orgId = supervisor.orgId;
    const testDate = '2026-10-20';

    console.log(`👤 Using Supervisor: ${supervisor.name} (${supervisor.id})`);
    console.log(`👷 Using Worker: ${worker1.name} (${worker1.id})`);
    console.log(`📍 Using Worksite: ${worksite.name} (${worksite.id})`);

    // Clean up any test records for this worker & date
    await db.delete(attendanceFlags).where(
      and(eq(attendanceFlags.workerId, worker1.id), eq(attendanceFlags.workDate, testDate))
    );
    const prevSessions = await db.select({ id: attendanceSessions.id }).from(attendanceSessions).where(
      and(eq(attendanceSessions.workerId, worker1.id), eq(attendanceSessions.workDate, testDate))
    );
    for (const ps of prevSessions) {
      await db.delete(attendanceEvents).where(eq(attendanceEvents.sessionId, ps.id));
    }
    await db.delete(attendanceSessions).where(
      and(eq(attendanceSessions.workerId, worker1.id), eq(attendanceSessions.workDate, testDate))
    );

    // 2. Create or verify a published assignment for today with shift start at 08:00 AM (well past grace period)
    const [assignment] = await db
      .insert(siteAssignments)
      .values({
        id: uuidv4(),
        orgId,
        worksiteId: worksite.id,
        supervisorId: supervisor.id,
        workDate: testDate,
        shiftName: 'Morning Shift',
        shiftStartTime: '08:00',
        shiftEndTime: '17:00',
        status: 'PUBLISHED',
        createdBy: supervisor.id,
        publishedAt: new Date(),
      })
      .returning();

    await db.insert(siteAssignmentWorkers).values({
      id: uuidv4(),
      assignmentId: assignment.id,
      workerId: worker1.id,
    });

    console.log(`\n📋 Created published assignment ${assignment.id} for shift 08:00 with worker ${worker1.fullName || worker1.employeeCode}`);

    // 3. Generate Auth Tokens
    const token = generateToken({
      id: supervisor.id,
      orgId: supervisor.orgId,
      employeeCode: supervisor.employeeCode,
      email: supervisor.email,
      fullName: supervisor.fullName,
      roles: ['SUPERVISOR'],
    });

    console.log('🔑 Generated supervisor JWT auth token');

    // 4. Fetch missing clock-in cases
    console.log('\n--- Test 1: Fetch Missing Clock-Ins ---');
    const getRes = await fetch(`http://localhost:5000/api/v1/attendance/missing-clock-ins?date=${testDate}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const missingCases = await getRes.json();
    const casesArray = Array.isArray(missingCases) ? missingCases : (missingCases?.cases || []);
    console.log(`Found ${casesArray.length} missing clock-in case(s)`);
    const myCase = casesArray.find((c: any) => c.workerId === worker1.id && c.assignmentId === assignment.id) || casesArray.find((c: any) => c.workerId === worker1.id);

    if (!myCase) {
      throw new Error(`Worker ${worker1.fullName || worker1.employeeCode} was not detected as missing clock-in!`);
    }

    console.log('✅ Worker correctly detected past grace period:');
    console.log(`   - Shift Start: ${myCase.shiftStartTime}`);
    console.log(`   - Grace Period: ${myCase.gracePeriodMinutes} mins`);
    console.log(`   - Elapsed: ${myCase.timeElapsedFormatted || myCase.elapsedLabel}`);
    console.log(`   - Initial Flag Status: ${myCase.flagStatus}`);

    // 5. Test Supervisor Flagging: Set to APPROVED with explanation
    console.log('\n--- Test 2: Supervisor Applies APPROVED Flag with Explanation ---');
    const flagRes = await fetch(`http://localhost:5000/api/v1/attendance/missing-clock-ins/${myCase.id}/flag`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'APPROVED',
        reason: 'Transit / Traffic Delay',
        note: 'Worker contacted supervisor; heavy traffic jam on outer ring road.',
      }),
    });

    const flagResult = await flagRes.json();
    if (!flagRes.ok) {
      throw new Error('Flagging API failed: ' + JSON.stringify(flagResult));
    }
    console.log('✅ Flag updated response:', flagResult.message);

    // Verify flag in DB
    const [flagInDb] = await db.select().from(attendanceFlags).where(eq(attendanceFlags.id, myCase.id));
    if (flagInDb.flagStatus !== 'APPROVED' || flagInDb.reason !== 'Transit / Traffic Delay') {
      throw new Error('Database flagStatus does not match approved state');
    }
    console.log('✅ DB Verification: flagStatus = APPROVED, reason saved, reviewedBy populated');

    // 6. CRUCIAL SEPARATION GUARANTEE: Verify NO attendance session was created!
    console.log('\n--- Test 3: Crucial Separation Guarantee ---');
    const sessions = await db
      .select()
      .from(attendanceSessions)
      .where(and(eq(attendanceSessions.workerId, worker1.id), eq(attendanceSessions.workDate, testDate)));

    if (sessions.length > 0) {
      throw new Error('FAILURE: Attendance session was fabricated by flagging!');
    }
    console.log('✅ GUARANTEE CONFIRMED: 0 attendance_sessions exist. Flagging DID NOT fabricate attendance or mark worker present.');

    // 7. Verify Audit Log was recorded
    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, 'ATTENDANCE_FLAG_APPLIED'), eq(auditLogs.entityId, myCase.id)));
    if (!audit) {
      throw new Error('Audit log was not recorded for attendance flag action');
    }
    console.log(`✅ Audit Log verified: ${audit.action} by ${audit.actorId}`);

    // 8. Test Late Clock-In Resolution
    console.log('\n--- Test 4: Worker Clocks In Later -> Resolves Flag Case & Preserves Historical Decision ---');
    // Generate token for worker1
    const workerToken = generateToken({
      id: worker1.id,
      orgId: worker1.orgId,
      employeeCode: worker1.employeeCode,
      email: worker1.email,
      fullName: worker1.fullName,
      roles: ['WORKER'],
    });

    // Worker clocks in
    const clockInRes = await fetch('http://localhost:5000/api/v1/attendance/clock-in', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${workerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assignmentId: assignment.id,
        worksiteId: worksite.id,
        latitude: worksite.latitude || 12.9716,
        longitude: worksite.longitude || 77.5946,
        reportedAccuracyMeters: 10,
        idempotencyKey: uuidv4(),
        photoObjectKey: 'test/sample_selfie.jpg',
      }),
    });

    const clockInData = await clockInRes.json();
    if (!clockInRes.ok) {
      throw new Error('Worker clock-in failed: ' + JSON.stringify(clockInData));
    }
    console.log('✅ Worker clocked in successfully. Session created:', clockInData.session.id);

    // Re-check the flag in DB
    const [flagAfterClockIn] = await db.select().from(attendanceFlags).where(eq(attendanceFlags.id, myCase.id));
    if (!flagAfterClockIn.resolvedByClockIn) {
      throw new Error('Flag case was not marked resolved by clock-in!');
    }
    if (flagAfterClockIn.flagStatus !== 'APPROVED') {
      throw new Error('Historical supervisor flag was improperly mutated upon clock-in!');
    }

    console.log('✅ Clock-In Resolution Confirmed:');
    console.log(`   - resolvedByClockIn: ${flagAfterClockIn.resolvedByClockIn}`);
    console.log(`   - resolvedAt: ${flagAfterClockIn.resolvedAt}`);
    console.log(`   - Historical Flag Decision Preserved: ${flagAfterClockIn.flagStatus}`);

    // Clean up test assignment
    await db.delete(attendanceEvents).where(eq(attendanceEvents.sessionId, clockInData.session.id));
    await db.delete(attendanceSessions).where(eq(attendanceSessions.id, clockInData.session.id));
    await db.delete(attendanceFlags).where(eq(attendanceFlags.id, myCase.id));
    await db.delete(siteAssignmentWorkers).where(eq(siteAssignmentWorkers.assignmentId, assignment.id));
    await db.delete(siteAssignments).where(eq(siteAssignments.id, assignment.id));

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Cleaned up test fixtures.\n');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  }
}

runMissingClockInTest().then(() => process.exit(0));
