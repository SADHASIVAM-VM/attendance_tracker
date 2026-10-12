import { getDb } from '../database/db.js';
import { calculateHaversineDistance, isWithinGeofence } from '../utils/geo.js';

async function runTests() {
  console.log('🧪 Running Location-Based Attendance System Integration Tests...\n');

  // Test 1: Haversine distance calculation
  console.log('Test 1: Haversine Geofence Calculations');
  const sfLat = 37.774929;
  const sfLon = -122.419416;

  // 10 meters away
  const dist10m = calculateHaversineDistance(sfLat, sfLon, sfLat + 0.00009, sfLon);
  console.log(`- Distance for ~10m delta: ${dist10m}m`);
  if (dist10m < 15 && isWithinGeofence(dist10m, 20)) {
    console.log('  ✅ Correctly validated within 20m radius');
  } else {
    throw new Error('Haversine calculation inside radius failed');
  }

  // 500 meters away
  const dist500m = calculateHaversineDistance(sfLat, sfLon, 37.779, -122.419416);
  console.log(`- Distance for ~500m delta: ${dist500m}m`);
  if (!isWithinGeofence(dist500m, 20)) {
    console.log('  ✅ Correctly rejected outside 20m radius');
  } else {
    throw new Error('Haversine calculation outside radius failed');
  }

  // Test 2: API End-to-End Simulation
  console.log('\nTest 2: Authentication & Multi-Role Verification');
  const baseUrl = 'http://localhost:5000/api/v1';

  // Helper for requests
  async function api(path: string, options: any = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // 1. Worker login
  const workerLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'worker@enterprise.com', password: 'Password123!' },
  });
  if (workerLogin.status !== 200 || !workerLogin.data.token) {
    throw new Error(`Worker login failed: ${JSON.stringify(workerLogin.data)}`);
  }
  const workerToken = workerLogin.data.token;
  console.log('  ✅ Worker authenticated successfully');

  // 2. Supervisor login
  const supervisorLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'supervisor@enterprise.com', password: 'Password123!' },
  });
  if (supervisorLogin.status !== 200 || !supervisorLogin.data.token) {
    throw new Error(`Supervisor login failed: ${JSON.stringify(supervisorLogin.data)}`);
  }
  const supervisorToken = supervisorLogin.data.token;
  console.log('  ✅ Supervisor authenticated successfully');

  // 3. Worker queries today assignments
  const workerAssignments = await api('/workers/me/assignments', {
    headers: { Authorization: `Bearer ${workerToken}` },
  });
  if (workerAssignments.status !== 200 || workerAssignments.data.length === 0) {
    throw new Error('Worker has no published assignments today');
  }
  const myAssignment = workerAssignments.data[0];
  console.log(`  ✅ Worker retrieved assignment: ${myAssignment.shiftName} at ${myAssignment.worksiteName}`);

  // 4. Worker negative test: Clock in outside geofence
  console.log('\nTest 3: Clock-In Geofence Security Enforcement');
  const outsideClockIn = await api('/attendance/clock-in', {
    method: 'POST',
    headers: { Authorization: `Bearer ${workerToken}` },
    body: {
      assignmentId: myAssignment.id,
      latitude: 38.0, // far outside
      longitude: -122.0,
      reportedAccuracyMeters: 10,
      photoObjectKey: 'selfies/test/fake.jpg',
      idempotencyKey: `idem_outside_${Date.now()}`,
    },
  });

  if (outsideClockIn.status === 422 && outsideClockIn.data.error === 'OUTSIDE_GEOFENCE') {
    console.log('  ✅ Correctly blocked clock-in outside geofence with OUTSIDE_GEOFENCE error code');
  } else {
    throw new Error(`Expected OUTSIDE_GEOFENCE error, got: ${JSON.stringify(outsideClockIn.data)}`);
  }

  // 5. Worker negative test: Insufficient GPS accuracy
  const inaccurateClockIn = await api('/attendance/clock-in', {
    method: 'POST',
    headers: { Authorization: `Bearer ${workerToken}` },
    body: {
      assignmentId: myAssignment.id,
      latitude: myAssignment.worksiteLatitude,
      longitude: myAssignment.worksiteLongitude,
      reportedAccuracyMeters: 150, // exceeds max accuracy 65m
      photoObjectKey: 'selfies/test/fake.jpg',
      idempotencyKey: `idem_inacc_${Date.now()}`,
    },
  });

  if (inaccurateClockIn.status === 422 && inaccurateClockIn.data.error === 'LOCATION_ACCURACY_INSUFFICIENT') {
    console.log('  ✅ Correctly blocked clock-in with poor GPS accuracy with LOCATION_ACCURACY_INSUFFICIENT');
  } else {
    throw new Error(`Expected LOCATION_ACCURACY_INSUFFICIENT error, got: ${JSON.stringify(inaccurateClockIn.data)}`);
  }

  // 6. Worker valid clock-in at the worksite coordinates
  console.log('\nTest 4: Valid Clock-in, Supervisor Snapshot & Approval Flow');
  const validClockIn = await api('/attendance/clock-in', {
    method: 'POST',
    headers: { Authorization: `Bearer ${workerToken}` },
    body: {
      assignmentId: myAssignment.id,
      latitude: myAssignment.worksiteLatitude,
      longitude: myAssignment.worksiteLongitude,
      reportedAccuracyMeters: 8,
      photoObjectKey: 'selfies/test/valid_worker1.jpg',
      idempotencyKey: `idem_valid_${Date.now()}`,
      clientDeviceInfo: 'Chrome 122 / Android Mobile Test',
    },
  });

  if (validClockIn.status !== 201 || !validClockIn.data.session) {
    throw new Error(`Valid clock-in failed: ${JSON.stringify(validClockIn.data)}`);
  }
  const sessionId = validClockIn.data.session.id;
  console.log(`  ✅ Clock-in accepted in PENDING status. Session ID: ${sessionId}`);
  console.log(`  ✅ Supervisor Snapshot ID captured: ${validClockIn.data.session.supervisorSnapshotId}`);

  // 7. Supervisor views pending approvals
  const pendingApprovals = await api('/attendance/pending-approvals', {
    headers: { Authorization: `Bearer ${supervisorToken}` },
  });
  if (pendingApprovals.status !== 200 || !pendingApprovals.data.some((p: any) => p.sessionId === sessionId)) {
    throw new Error('Pending clock-in not found in supervisor queue');
  }
  console.log('  ✅ Assigned supervisor successfully received pending approval in queue');

  // 8. Supervisor approves attendance
  const approveRes = await api(`/attendance/${sessionId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${supervisorToken}` },
    body: { note: 'Verified selfie and on-site position' },
  });
  if (approveRes.status !== 200 || approveRes.data.session.status !== 'APPROVED') {
    throw new Error(`Approval failed: ${JSON.stringify(approveRes.data)}`);
  }
  console.log('  ✅ Supervisor successfully approved attendance');

  // 9. Worker checks their attendance records
  const myAttendance = await api('/attendance/me', {
    headers: { Authorization: `Bearer ${workerToken}` },
  });
  const approvedItem = myAttendance.data.find((a: any) => a.id === sessionId);
  if (!approvedItem || approvedItem.status !== 'APPROVED') {
    throw new Error('Approved attendance record not visible to worker');
  }
  console.log('  ✅ Worker views updated APPROVED attendance in history');

  // 10. Test Leave Request Flow
  console.log('\nTest 5: Leave Request & Admin Approval Flow');
  const leaveTypesRes = await api('/leave/types', {
    headers: { Authorization: `Bearer ${workerToken}` },
  });
  const sickLeave = leaveTypesRes.data.find((t: any) => t.code === 'SL');

  const leaveSubmit = await api('/leave/requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${workerToken}` },
    body: {
      leaveTypeId: sickLeave.id,
      startDate: '2026-10-20',
      endDate: '2026-10-21',
      isHalfDay: false,
      reason: 'Medical checkup and recovery',
    },
  });
  if (leaveSubmit.status !== 201) {
    throw new Error(`Leave submission failed: ${JSON.stringify(leaveSubmit.data)}`);
  }
  const leaveId = leaveSubmit.data.id;
  console.log(`  ✅ Worker submitted leave request. ID: ${leaveId}`);

  // Admin approves leave
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@enterprise.com', password: 'Password123!' },
  });
  const adminToken = adminLogin.data.token;

  const adminPendingLeaves = await api('/leave/requests/pending', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!adminPendingLeaves.data.some((l: any) => l.id === leaveId)) {
    throw new Error('Leave request not found in Admin review queue');
  }
  console.log('  ✅ Admin found leave in direct Admin review queue (independent of daily supervisor)');

  const approveLeaveRes = await api(`/leave/requests/${leaveId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { decisionNote: 'Medical documentation approved' },
  });
  if (approveLeaveRes.status !== 200 || approveLeaveRes.data.request.status !== 'APPROVED') {
    throw new Error('Admin leave approval failed');
  }
  console.log('  ✅ Admin approved leave request successfully');

  console.log('\n🎉 ALL 5 INTEGRATION TEST SUITES PASSED FLAWLESSLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
