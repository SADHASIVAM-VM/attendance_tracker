import { app } from '../server';
import { getDb } from '../database/db';
import { seedDatabase } from '../database/seed/seed';
import type { Server } from 'http';

async function runWorkerAttendanceTests() {
  console.log('🧪 Running Worker Attendance & Leave Calendar Integration Tests...\n');

  await getDb();
  await seedDatabase();

  const server: Server = app.listen(5003);
  const baseUrl = 'http://localhost:5003/api/v1';

  try {
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

    // 1. Authenticate Worker & Admin
    console.log('1. Authenticating Worker and Admin...');
    const workerLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'worker@enterprise.com', password: 'Password123!' },
    });
    if (workerLogin.status !== 200) throw new Error('Worker login failed');
    const workerToken = workerLogin.data.token;

    const adminLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'admin@enterprise.com', password: 'Password123!' },
    });
    if (adminLogin.status !== 200) throw new Error('Admin login failed');
    const adminToken = adminLogin.data.token;
    console.log('  ✅ Worker and Admin authenticated successfully');

    // 2. Fetch Worker Attendance
    console.log('\n2. Testing /attendance/me endpoint...');
    const attRes = await api('/attendance/me', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    if (attRes.status !== 200) throw new Error('Failed to fetch worker attendance');
    console.log(`  ✅ Retrieved ${attRes.data.length} historical attendance sessions`);

    // 3. Fetch Leave Types
    console.log('\n3. Testing /leave/types endpoint...');
    const typesRes = await api('/leave/types', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    if (typesRes.status !== 200 || typesRes.data.length === 0) throw new Error('Failed to fetch leave types');
    const casualLeaveType = typesRes.data[0];
    console.log(`  ✅ Retrieved ${typesRes.data.length} leave types (Selected: ${casualLeaveType.name})`);

    // 4. Worker applies for Future Leave (e.g. 2026-11-20 to 2026-11-22)
    console.log('\n4. Testing Worker applying for future leave...');
    const futureStartDate = '2026-11-20';
    const futureEndDate = '2026-11-22';
    const applyRes = await api('/leave/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: {
        leaveTypeId: casualLeaveType.id,
        startDate: futureStartDate,
        endDate: futureEndDate,
        isHalfDay: false,
        reason: 'Attending annual family convention',
      },
    });

    if (applyRes.status !== 201) throw new Error(`Leave application failed: ${JSON.stringify(applyRes.data)}`);
    const leaveId = applyRes.data.id;
    console.log(`  ✅ Created future leave request ID: ${leaveId} (Status: ${applyRes.data.status})`);

    // 5. Worker checks their leave requests
    console.log('\n5. Testing /leave/requests/me endpoint...');
    const myLeavesRes = await api('/leave/requests/me', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    if (myLeavesRes.status !== 200) throw new Error('Failed to fetch worker leave requests');
    const foundLeave = myLeavesRes.data.find((l: any) => l.id === leaveId);
    if (!foundLeave) throw new Error('Applied leave not found in /leave/requests/me');
    console.log(`  ✅ PASS: Leave request found with dates ${foundLeave.startDate} to ${foundLeave.endDate}`);

    // 6. Admin approves the future leave
    console.log('\n6. Testing Admin approval of future leave...');
    const approveRes = await api(`/leave/requests/${leaveId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { decisionNote: 'Approved. Enjoy your time off!' },
    });
    if (approveRes.status !== 200) throw new Error('Failed to approve leave request');
    console.log(`  ✅ PASS: Admin approved leave request. Status is now: ${approveRes.data.status}`);

    // 7. Verify status changed to APPROVED
    const myLeavesAfter = await api('/leave/requests/me', {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    const updatedLeave = myLeavesAfter.data.find((l: any) => l.id === leaveId);
    if (updatedLeave.status !== 'APPROVED') throw new Error(`Expected status APPROVED, got ${updatedLeave.status}`);
    console.log(`  ✅ PASS: Worker verifies approved future leave (will fill VIOLET on calendar)`);

    console.log('\n==========================================');
    console.log('All Worker Attendance & Leave Tests Passed! 🎉');
    console.log('==========================================\n');
  } finally {
    server.close();
  }
}

runWorkerAttendanceTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
