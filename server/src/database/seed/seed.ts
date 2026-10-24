import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg'
import * as schema from '../schema.js';
import dotenv from 'dotenv';
dotenv.config();
import { organizations, users, userRoles, worksites, leaveTypes, siteAssignments, siteAssignmentWorkers } from '../schema.js';

export async function seedDatabase() {
  try {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    const db = drizzle(pool, { schema });

    console.log('🌱 Seeding database...');

    // Check if organization already exists
    const existingOrgs = await db.select().from(organizations).limit(1);
    if (existingOrgs.length > 0) {
      console.log('Database already has seeded organization, skipping initial seed.');
      return;
    }

    // 1. Create Organization
    const [org] = await db.insert(organizations).values({
      name: 'Global Workforce Logistics Corp',
      code: 'GWL_CORP',
      timezone: 'UTC',
      defaultGeofenceRadius: 30,
      maxLocationAccuracy: 60,
      allowAdminClockInApproval: false,
      clockOutEnabled: true,
    }).returning();

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 2. Create Users
    const [superAdminUser] = await db.insert(users).values({
      orgId: org.id,
      employeeCode: 'EMP001',
      email: 'superadmin@enterprise.com',
      fullName: 'Eleanor Vance (Super Admin)',
      passwordHash,
      phone: '+1 555-0101',
      personalEmail: 'eleanor.vance@gmail.com',
      dob: '1982-05-14',
      age: 44,
      gender: 'Female',
      bloodGroup: 'O+',
      currentAddress: 'Corporate HQ, 500 Enterprise Way, Suite 100',
      emergencyContactName: 'David Vance (Spouse)',
      emergencyContactPhone: '+1 555-9001',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
      employmentType: 'full-time',
      isActive: true,
    }).returning();

    const [adminUser] = await db.insert(users).values({
      orgId: org.id,
      employeeCode: 'EMP002',
      email: 'admin@enterprise.com',
      fullName: 'Arthur Dent (Operations Admin)',
      passwordHash,
      phone: '+1 555-0102',
      personalEmail: 'arthur.dent@galaxy.org',
      dob: '1984-04-01',
      age: 42,
      gender: 'Male',
      bloodGroup: 'B-',
      currentAddress: '101 Whitefield Main Road, Bengaluru',
      emergencyContactName: 'Trillian Astra (Partner)',
      emergencyContactPhone: '+1 555-9002',
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
      employmentType: 'full-time',
      isActive: true,
    }).returning();

    const [supervisor1] = await db.insert(users).values({
      orgId: org.id,
      employeeCode: 'EMP003',
      email: 'supervisor@enterprise.com',
      fullName: 'Marcus Brody (Site Supervisor)',
      passwordHash,
      phone: '+1 555-0103',
      personalEmail: 'brody.marcus@yahoo.com',
      dob: '1988-11-05',
      age: 38,
      gender: 'Male',
      bloodGroup: 'A+',
      currentAddress: '12/A Green Glen Layout, Bellandur, Bengaluru',
      emergencyContactName: 'Elena Brody (Wife)',
      emergencyContactPhone: '+1 555-9003',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      employmentType: 'full-time',
      isActive: true,
    }).returning();

    const [supervisor2] = await db.insert(users).values({
      orgId: org.id,
      employeeCode: 'EMP004',
      email: 'supervisor2@enterprise.com',
      fullName: 'Sarah Connor (Relief Supervisor)',
      passwordHash,
      phone: '+1 555-0104',
      personalEmail: 'sconnor.ops@proton.me',
      dob: '1990-09-28',
      age: 36,
      gender: 'Female',
      bloodGroup: 'A-',
      currentAddress: '29 Koramangala 5th Block, Bengaluru',
      emergencyContactName: 'John Connor (Son)',
      emergencyContactPhone: '+1 555-9004',
      photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80',
      employmentType: 'full-time',
      isActive: true,
    }).returning();

    const [worker1] = await db.insert(users).values({
      orgId: org.id,
      employeeCode: 'EMP005',
      email: 'worker@enterprise.com',
      fullName: 'John Miller (Field Worker)',
      passwordHash,
      phone: '+1 555-0105',
      personalEmail: 'jmiller.field@gmail.com',
      dob: '1997-06-14',
      age: 29,
      gender: 'Male',
      bloodGroup: 'O+',
      currentAddress: 'Flat 402, Sunrise Towers, Outer Ring Road, Bengaluru',
      emergencyContactName: 'Sunita Miller (Spouse)',
      emergencyContactPhone: '+1 555-9005',
      photoUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=300&q=80',
      employmentType: 'full-time',
      isActive: true,
    }).returning();

    const [worker2] = await db.insert(users).values({
      orgId: org.id,
      employeeCode: 'EMP006',
      email: 'worker2@enterprise.com',
      fullName: 'Elena Rostova (Field Specialist)',
      passwordHash,
      phone: '+1 555-0106',
      personalEmail: 'elena.rostova@outlook.com',
      dob: '1999-03-22',
      age: 27,
      gender: 'Female',
      bloodGroup: 'B+',
      currentAddress: 'Plot 18, 4th Cross, Indiranagar, Bengaluru',
      emergencyContactName: 'K. Rostova (Father)',
      emergencyContactPhone: '+1 555-9006',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      employmentType: 'contract',
      isActive: true,
    }).returning();

    // 3. Assign Roles
    await db.insert(userRoles).values([
      { userId: superAdminUser.id, role: 'SUPER_ADMIN' },
      { userId: adminUser.id, role: 'ADMIN' },
      { userId: supervisor1.id, role: 'SUPERVISOR' },
      { userId: supervisor2.id, role: 'SUPERVISOR' },
      { userId: worker1.id, role: 'WORKER' },
      { userId: worker2.id, role: 'WORKER' },
    ]);

    // 4. Create Worksites
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

    const [siteB] = await db.insert(worksites).values({
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
    }).returning();

    // 5. Create Leave Types
    await db.insert(leaveTypes).values([
      { orgId: org.id, name: 'Casual Leave', code: 'CL', description: 'Standard short-duration personal leave' },
      { orgId: org.id, name: 'Sick Leave', code: 'SL', description: 'Medical recovery or hospital visits' },
      { orgId: org.id, name: 'Earned Leave', code: 'EL', description: 'Accumulated vacation and annual paid leave' },
      { orgId: org.id, name: 'Unpaid Leave', code: 'UL', description: 'Authorized unpaid absence' },
    ]);

    // 6. Create today's published assignment for Worker 1 under Supervisor 1 at Site A
    const todayStr = new Date().toISOString().split('T')[0];
    const [assignment] = await db.insert(siteAssignments).values({
      orgId: org.id,
      worksiteId: siteA.id,
      supervisorId: supervisor1.id,
      workDate: todayStr,
      groupName: 'Metro Hub',
      shiftName: 'Morning Standard Shift',
      shiftStartTime: '08:00',
      shiftEndTime: '17:00',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      createdBy: adminUser.id,
    }).returning();

    await db.insert(siteAssignmentWorkers).values([
      { assignmentId: assignment.id, workerId: worker1.id },
      { assignmentId: assignment.id, workerId: worker2.id },
    ]);

    console.log('✅ Seed complete with 4 primary test accounts and sample worksites/assignments.');
  }
  catch (err) {
    console.log("DB Coonection Failed")
  }
}

(async () => {
  await seedDatabase();
})()