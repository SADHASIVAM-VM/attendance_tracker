import { app } from '../server';
import { getDb } from '../database/db';
import { seedDatabase } from '../database/seed/seed';
import type { Server } from 'http';

async function runAssignmentTests() {
  console.log('🧪 Running Assignment & Regional Groups Integration Tests...\n');

  await getDb();
  await seedDatabase();

  const server: Server = app.listen(5002);
  const baseUrl = 'http://localhost:5002/api/v1';

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

    // 1. Authenticate Admin
    console.log('1. Authenticating Admin and Supervisor...');
    const adminLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'admin@enterprise.com', password: 'Password123!' },
    });
    if (adminLogin.status !== 200) throw new Error('Admin login failed');
    const adminToken = adminLogin.data.token;
    console.log('  ✅ Admin authenticated');

    // 2. Authenticate Supervisor
    const supervisorLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'supervisor@enterprise.com', password: 'Password123!' },
    });
    if (supervisorLogin.status !== 200) throw new Error('Supervisor login failed');
    const supervisorToken = supervisorLogin.data.token;
    console.log('  ✅ Supervisor authenticated');

    // 3. Fetch active worksites and supervisors
    const sitesRes = await api('/worksites', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersRes = await api('/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const worksiteId = sitesRes.data[0].id;
    const supervisorId = usersRes.data.find((u: any) => u.roles.includes('SUPERVISOR')).id;
    const workerIds = usersRes.data.filter((u: any) => u.roles.includes('WORKER')).map((w: any) => w.id);

    // 4. VERIFY: Supervisor CANNOT create assignment (Super Admin & Admin only!)
    console.log('\n2. Testing Role Permission Boundary (Supervisor cannot create assignments)...');
    const testDate = '2026-10-15';
    const supCreateRes = await api('/assignments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${supervisorToken}` },
      body: {
        groupName: 'Delhi',
        worksiteId,
        supervisorId,
        workDate: testDate,
        workerIds,
      },
    });

    if (supCreateRes.status === 403) {
      console.log('  ✅ PASS: Supervisor blocked from creating assignment (HTTP 403 Forbidden)');
    } else {
      throw new Error(`Supervisor was able to create assignment or unexpected status: ${supCreateRes.status}`);
    }

    // 5. Admin creates multiple regional groups { Delhi, Chennai, Salem }
    console.log('\n3. Testing Admin creating multiple regional groups { Delhi, Chennai, Salem }...');
    const groupsToCreate = ['Delhi', 'Chennai', 'Salem'];
    const createdGroupIds: string[] = [];

    for (const gName of groupsToCreate) {
      const createRes = await api('/assignments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          groupName: gName,
          shiftName: `${gName} Standard Shift`,
          worksiteId,
          supervisorId,
          workDate: testDate,
          shiftStartTime: '08:00',
          shiftEndTime: '17:00',
          workerIds,
        },
      });

      if (createRes.status !== 201) {
        throw new Error(`Failed to create group ${gName}: ${JSON.stringify(createRes.data)}`);
      }
      console.log(`  ✅ Created group "${gName}" (ID: ${createRes.data.id})`);
      createdGroupIds.push(createRes.data.id);
    }

    // 6. Query assignments for that date
    console.log('\n4. Querying assignments by date...');
    const listRes = await api(`/assignments?date=${testDate}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (listRes.status !== 200) throw new Error('Failed to query assignments by date');
    const matchingDateGroups = listRes.data.filter((a: any) => a.workDate === testDate);
    console.log(`  ✅ Retrieved ${matchingDateGroups.length} groups for ${testDate}`);
    const returnedGroupNames = matchingDateGroups.map((g: any) => g.groupName);
    for (const gName of groupsToCreate) {
      if (!returnedGroupNames.includes(gName)) {
        throw new Error(`Group "${gName}" was not found in returned list`);
      }
    }
    console.log('  ✅ PASS: All regional groups (Delhi, Chennai, Salem) returned with groupName intact');

    // 7. Query assignments by month prefix
    console.log('\n5. Querying assignments by month prefix (calendar multi-month support)...');
    const monthRes = await api(`/assignments?month=2026-10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (monthRes.status !== 200 || monthRes.data.length < 3) {
      throw new Error('Failed to query assignments by month');
    }
    console.log(`  ✅ PASS: Calendar month query returned ${monthRes.data.length} assignments for 2026-10`);

    // 8. Publish one of the groups
    console.log('\n6. Publishing one of the draft groups...');
    const pubRes = await api(`/assignments/${createdGroupIds[0]}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (pubRes.status !== 200 || pubRes.data.status !== 'PUBLISHED') {
      throw new Error('Failed to publish assignment group');
    }
    console.log(`  ✅ PASS: Group "${groupsToCreate[0]}" published successfully`);

    console.log('\n==========================================');
    console.log('All Assignment & Regional Group Tests Passed! 🎉');
    console.log('==========================================\n');
  } finally {
    server.close();
  }
}

runAssignmentTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
