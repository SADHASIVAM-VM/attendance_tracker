import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { organizations, users, userRoles, worksites, leaveTypes, siteAssignments, siteAssignmentWorkers } from '../schema/index';
import { eq, and } from 'drizzle-orm';

export async function seedDatabase() {
  const db = await getDb();

  console.log('🌱 Seeding database...');

  // 1. Get or Create Organization
  let org: any;
  const existingOrgs = await db.select().from(organizations).limit(1);
  if (existingOrgs.length > 0) {
    org = existingOrgs[0];
    console.log(`Using existing organization: ${org.name} (${org.code})`);
  } else {
    const [newOrg] = await db.insert(organizations).values({
      name: 'Global Workforce Logistics Corp',
      code: 'GWL_CORP',
      timezone: 'UTC',
      defaultGeofenceRadius: 30,
      maxLocationAccuracy: 60,
      allowAdminClockInApproval: false,
      clockOutEnabled: true,
    }).returning();
    org = newOrg;
    console.log(`Created organization: ${org.name} (${org.code})`);
  }

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 2. Helper to upsert user and role
  async function upsertUser(data: {
    employeeCode: string;
    email: string;
    fullName: string;
    phone: string;
    dob?: string;
    photoUrl?: string;
    nativePlace?: string;
    emergencyPhone?: string;
    bloodGroup?: string;
    gender?: string;
    address?: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'WORKER';
  }) {
    const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
    let userId: string;

    if (existing.length > 0) {
      userId = existing[0].id;
      // Ensure password and profile details are updated
      await db.update(users).set({
        passwordHash,
        isActive: true,
        fullName: data.fullName,
        phone: data.phone,
        dob: data.dob || null,
        photoUrl: data.photoUrl || null,
        nativePlace: data.nativePlace || null,
        emergencyPhone: data.emergencyPhone || null,
        bloodGroup: data.bloodGroup || null,
        gender: data.gender || null,
        address: data.address || null,
      }).where(eq(users.id, userId));
      console.log(`Updated user credentials for: ${data.email} (${data.role})`);
    } else {
      const [created] = await db.insert(users).values({
        orgId: org.id,
        employeeCode: data.employeeCode,
        email: data.email,
        fullName: data.fullName,
        passwordHash,
        phone: data.phone,
        dob: data.dob || null,
        photoUrl: data.photoUrl || null,
        nativePlace: data.nativePlace || null,
        emergencyPhone: data.emergencyPhone || null,
        bloodGroup: data.bloodGroup || null,
        gender: data.gender || null,
        address: data.address || null,
        isActive: true,
      }).returning();
      userId = created.id;
      console.log(`Created user: ${data.email} (${data.role})`);
    }

    // Ensure role exists in user_roles
    const existingRole = await db.select().from(userRoles).where(
      and(eq(userRoles.userId, userId), eq(userRoles.role, data.role))
    ).limit(1);

    if (existingRole.length === 0) {
      await db.insert(userRoles).values({
        userId,
        role: data.role,
      });
      console.log(`Assigned role ${data.role} to ${data.email}`);
    }

    return userId;
  }

  // Seed default role users
  const superAdminId = await upsertUser({
    employeeCode: 'EMP001',
    email: 'superadmin@enterprise.com',
    fullName: 'Eleanor Vance',
    phone: '+1 555-0101',
    dob: '1985-04-12',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
    nativePlace: 'Chicago, IL',
    emergencyPhone: '+1 555-9901',
    bloodGroup: 'O+',
    gender: 'Female',
    address: '450 North Michigan Avenue, Chicago, IL 60611',
    role: 'SUPER_ADMIN',
  });

  const adminId = await upsertUser({
    employeeCode: 'EMP002',
    email: 'admin@enterprise.com',
    fullName: 'Arthur Dent',
    phone: '+1 555-0102',
    dob: '1988-09-23',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    nativePlace: 'Austin, TX',
    emergencyPhone: '+1 555-9902',
    bloodGroup: 'A+',
    gender: 'Male',
    address: '120 Congress Ave, Austin, TX 78701',
    role: 'ADMIN',
  });

  const supervisor1Id = await upsertUser({
    employeeCode: 'EMP003',
    email: 'supervisor@enterprise.com',
    fullName: 'Marcus Brody',
    phone: '+1 555-0103',
    dob: '1990-11-15',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    nativePlace: 'Seattle, WA',
    emergencyPhone: '+1 555-9903',
    bloodGroup: 'B+',
    gender: 'Male',
    address: '78 Pike Place, Seattle, WA 98101',
    role: 'SUPERVISOR',
  });

  const supervisor2Id = await upsertUser({
    employeeCode: 'EMP004',
    email: 'supervisor2@enterprise.com',
    fullName: 'Sarah Connor',
    phone: '+1 555-0104',
    dob: '1992-06-30',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80',
    nativePlace: 'Denver, CO',
    emergencyPhone: '+1 555-9904',
    bloodGroup: 'AB+',
    gender: 'Female',
    address: '920 17th Street, Denver, CO 80202',
    role: 'SUPERVISOR',
  });

  const worker1Id = await upsertUser({
    employeeCode: 'EMP005',
    email: 'worker@enterprise.com',
    fullName: 'John Miller',
    phone: '+1 555-0105',
    dob: '1995-02-18',
    photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80',
    nativePlace: 'San Francisco, CA',
    emergencyPhone: '+1 555-9905',
    bloodGroup: 'O+',
    gender: 'Male',
    address: '320 Mission Street, San Francisco, CA 94105',
    role: 'WORKER',
  });

  const worker2Id = await upsertUser({
    employeeCode: 'EMP006',
    email: 'worker2@enterprise.com',
    fullName: 'Elena Rostova',
    phone: '+1 555-0106',
    dob: '1997-08-05',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    nativePlace: 'Portland, OR',
    emergencyPhone: '+1 555-9906',
    bloodGroup: 'A-',
    gender: 'Female',
    address: '610 SW Broadway, Portland, OR 97205',
    role: 'WORKER',
  });

  // 3. Ensure Worksites exist
  const existingSites = await db.select().from(worksites).limit(1);
  let siteAId: string;
  if (existingSites.length === 0) {
    const [siteA] = await db.insert(worksites).values({
      orgId: org.id,
      name: 'Metro Logistics Terminal A',
      code: 'MLT-01',
      address: '100 Industrial Parkway, San Francisco, CA 94107',
      description: 'Main freight logistics dock and distribution center',
      latitude: 37.774929,
      longitude: -122.419416,
      radiusMeters: 50,
      maxAccuracyMeters: 65,
      isActive: true,
    }).returning();
    siteAId = siteA.id;

    await db.insert(worksites).values({
      orgId: org.id,
      name: 'Harbor Gate Terminal B',
      code: 'HGT-02',
      address: '450 Maritime Boulevard, Oakland, CA 94607',
      description: 'Container transfer point and customs depot',
      latitude: 37.804363,
      longitude: -122.271111,
      radiusMeters: 40,
      maxAccuracyMeters: 60,
      isActive: true,
    });
    console.log('Created default worksites');
  } else {
    siteAId = existingSites[0].id;
  }

  // 4. Ensure Leave Types exist
  const existingLeaveTypes = await db.select().from(leaveTypes).limit(1);
  if (existingLeaveTypes.length === 0) {
    await db.insert(leaveTypes).values([
      { orgId: org.id, name: 'Casual Leave', code: 'CL', description: 'Standard short-duration personal leave' },
      { orgId: org.id, name: 'Sick Leave', code: 'SL', description: 'Medical recovery or hospital visits' },
      { orgId: org.id, name: 'Earned Leave', code: 'EL', description: 'Accumulated vacation and annual paid leave' },
      { orgId: org.id, name: 'Unpaid Leave', code: 'UL', description: 'Authorized unpaid absence' },
    ]);
    console.log('Created leave types');
  }

  // 5. Ensure today has an active roster assignment
  const todayStr = new Date().toISOString().split('T')[0];
  const existingAssignments = await db.select().from(siteAssignments).where(eq(siteAssignments.workDate, todayStr)).limit(1);
  if (existingAssignments.length === 0) {
    const [assignment] = await db.insert(siteAssignments).values({
      orgId: org.id,
      worksiteId: siteAId,
      supervisorId: supervisor1Id,
      workDate: todayStr,
      groupName: 'Metro Hub',
      shiftName: 'Morning Standard Shift',
      shiftStartTime: '08:00',
      shiftEndTime: '17:00',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      createdBy: adminId,
    }).returning();

    await db.insert(siteAssignmentWorkers).values([
      { assignmentId: assignment.id, workerId: worker1Id },
      { assignmentId: assignment.id, workerId: worker2Id },
    ]);
    console.log('Created today assignment schedule for demo worker');
  }

  console.log('✅ Database seed completed successfully!');
  console.log('----------------------------------------------------');
  console.log('🔑 TEST ACCOUNTS (Password: Password123!)');
  console.log('  • Super Admin: superadmin@enterprise.com');
  console.log('  • Admin:       admin@enterprise.com');
  console.log('  • Supervisor:  supervisor@enterprise.com');
  console.log('  • Worker:      worker@enterprise.com');
  console.log('----------------------------------------------------');
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('seed.ts')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
