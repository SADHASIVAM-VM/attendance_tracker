import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { organizations, users, userRoles, worksites, leaveTypes, siteAssignments, siteAssignmentWorkers } from '../schema.js';
export async function seedDatabase() {
    const db = await getDb();
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
        isActive: true,
    }).returning();
    const [adminUser] = await db.insert(users).values({
        orgId: org.id,
        employeeCode: 'EMP002',
        email: 'admin@enterprise.com',
        fullName: 'Arthur Dent (Operations Admin)',
        passwordHash,
        phone: '+1 555-0102',
        isActive: true,
    }).returning();
    const [supervisor1] = await db.insert(users).values({
        orgId: org.id,
        employeeCode: 'EMP003',
        email: 'supervisor@enterprise.com',
        fullName: 'Marcus Brody (Site Supervisor)',
        passwordHash,
        phone: '+1 555-0103',
        isActive: true,
    }).returning();
    const [supervisor2] = await db.insert(users).values({
        orgId: org.id,
        employeeCode: 'EMP004',
        email: 'supervisor2@enterprise.com',
        fullName: 'Sarah Connor (Relief Supervisor)',
        passwordHash,
        phone: '+1 555-0104',
        isActive: true,
    }).returning();
    const [worker1] = await db.insert(users).values({
        orgId: org.id,
        employeeCode: 'EMP005',
        email: 'worker@enterprise.com',
        fullName: 'John Miller (Field Worker)',
        passwordHash,
        phone: '+1 555-0105',
        isActive: true,
    }).returning();
    const [worker2] = await db.insert(users).values({
        orgId: org.id,
        employeeCode: 'EMP006',
        email: 'worker2@enterprise.com',
        fullName: 'Elena Rostova (Field Specialist)',
        passwordHash,
        phone: '+1 555-0106',
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
