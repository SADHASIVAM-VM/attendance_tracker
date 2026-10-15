import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../database/db';
import { users, userRoles } from '../database/schema/index';
import { eq, and } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit';

const createUserSchema = z.object({
  employeeCode: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(6).default('Password123!'),
  phone: z.string().optional(),
  dob: z.string().optional(),
  photoUrl: z.string().optional(),
  nativePlace: z.string().optional(),
  emergencyPhone: z.string().optional(),
  bloodGroup: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  roles: z.array(z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'WORKER'])).min(1),
});

const updateUserSchema = z.object({
  employeeCode: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  phone: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  nativePlace: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  roles: z.array(z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'WORKER'])).optional(),
});

// GET /api/v1/users - List all workforce users
export async function getUsers(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  const allUsers = await db
    .select({
      id: users.id,
      employeeCode: users.employeeCode,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      dob: users.dob,
      photoUrl: users.photoUrl,
      nativePlace: users.nativePlace,
      emergencyPhone: users.emergencyPhone,
      bloodGroup: users.bloodGroup,
      gender: users.gender,
      address: users.address,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.orgId as any, orgId as any));

  const allRoles = await db.select().from(userRoles);

  const roleMap: Record<string, string[]> = {};
  for (const r of allRoles) {
    if (!roleMap[r.userId]) {
      roleMap[r.userId] = [];
    }
    roleMap[r.userId].push(r.role);
  }

  const result = allUsers.map((u: any) => ({
    ...u,
    roles: roleMap[u.id] || [],
  }));

  return res.json(result);
}

// GET /api/v1/users/:id - Get single user details
export async function getUserById(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [userRecord] = await db
    .select({
      id: users.id,
      orgId: users.orgId,
      employeeCode: users.employeeCode,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      dob: users.dob,
      photoUrl: users.photoUrl,
      nativePlace: users.nativePlace,
      emergencyPhone: users.emergencyPhone,
      bloodGroup: users.bloodGroup,
      gender: users.gender,
      address: users.address,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(and(eq(users.id as any, id as any), eq(users.orgId as any, orgId as any)))
    .limit(1);

  if (!userRecord) {
    return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
  }

  const rolesRecords = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId as any, userRecord.id as any));

  return res.json({
    ...userRecord,
    roles: rolesRecords.map((r: any) => r.role),
  });
}

// POST /api/v1/users - Create a new user (Create)
export async function createUser(req: Request, res: Response): Promise<any> {
  const parseResult = createUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const data = parseResult.data;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const existingEmail = await db
    .select()
    .from(users)
    .where(eq(users.email as any, data.email.toLowerCase().trim() as any))
    .limit(1);

  if (existingEmail.length > 0) {
    return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'Email is already registered' });
  }

  const existingCode = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId as any, orgId as any), eq(users.employeeCode as any, data.employeeCode.trim() as any)))
    .limit(1);

  if (existingCode.length > 0) {
    return res.status(409).json({ error: 'CODE_EXISTS', message: 'Employee Code is already in use in your organization' });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      orgId,
      employeeCode: data.employeeCode.trim(),
      email: data.email.toLowerCase().trim(),
      fullName: data.fullName.trim(),
      passwordHash,
      phone: data.phone?.trim() || null,
      dob: data.dob?.trim() || null,
      photoUrl: data.photoUrl?.trim() || null,
      nativePlace: data.nativePlace?.trim() || null,
      emergencyPhone: data.emergencyPhone?.trim() || null,
      bloodGroup: data.bloodGroup?.trim() || null,
      gender: data.gender?.trim() || null,
      address: data.address?.trim() || null,
      isActive: true,
    })
    .returning();

  for (const role of data.roles) {
    await db.insert(userRoles).values({
      userId: newUser.id,
      role,
    });
  }

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'CREATE_USER',
    entityType: 'USER',
    entityId: newUser.id,
    afterValues: { email: data.email, roles: data.roles, employeeCode: data.employeeCode },
  });

  return res.status(201).json({
    id: newUser.id,
    employeeCode: newUser.employeeCode,
    email: newUser.email,
    fullName: newUser.fullName,
    phone: newUser.phone,
    dob: newUser.dob,
    photoUrl: newUser.photoUrl,
    nativePlace: newUser.nativePlace,
    emergencyPhone: newUser.emergencyPhone,
    bloodGroup: newUser.bloodGroup,
    gender: newUser.gender,
    address: newUser.address,
    isActive: newUser.isActive,
    roles: data.roles,
  });
}

// PATCH /api/v1/users/:id - Update user details (Update)
export async function updateUser(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = updateUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const data = parseResult.data;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [userRecord] = await db
    .select()
    .from(users)
    .where(and(eq(users.id as any, id as any), eq(users.orgId as any, orgId as any)))
    .limit(1);

  if (!userRecord) {
    return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
  }

  // Check email conflict if changing
  if (data.email && data.email.toLowerCase().trim() !== userRecord.email.toLowerCase()) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email as any, data.email.toLowerCase().trim() as any))
      .limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'Email is already used by another account' });
    }
  }

  const updates: any = { updatedAt: new Date() };
  if (data.fullName !== undefined) updates.fullName = data.fullName.trim();
  if (data.employeeCode !== undefined) updates.employeeCode = data.employeeCode.trim();
  if (data.email !== undefined) updates.email = data.email.toLowerCase().trim();
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.dob !== undefined) updates.dob = data.dob;
  if (data.photoUrl !== undefined) updates.photoUrl = data.photoUrl;
  if (data.nativePlace !== undefined) updates.nativePlace = data.nativePlace;
  if (data.emergencyPhone !== undefined) updates.emergencyPhone = data.emergencyPhone;
  if (data.bloodGroup !== undefined) updates.bloodGroup = data.bloodGroup;
  if (data.gender !== undefined) updates.gender = data.gender;
  if (data.address !== undefined) updates.address = data.address;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  if (data.password) {
    updates.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id as any, id as any))
    .returning();

  if (data.roles && data.roles.length > 0) {
    await db.delete(userRoles).where(eq(userRoles.userId as any, id as any));
    for (const role of data.roles) {
      await db.insert(userRoles).values({ userId: id, role });
    }
  }

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'UPDATE_USER',
    entityType: 'USER',
    entityId: id,
    beforeValues: { fullName: userRecord.fullName, email: userRecord.email, isActive: userRecord.isActive },
    afterValues: updates,
    ipAddress: String(req.ip || ''),
  });

  const updatedRoles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId as any, id as any));

  return res.json({
    id: updated.id,
    employeeCode: updated.employeeCode,
    fullName: updated.fullName,
    email: updated.email,
    phone: updated.phone,
    dob: updated.dob,
    photoUrl: updated.photoUrl,
    nativePlace: updated.nativePlace,
    emergencyPhone: updated.emergencyPhone,
    bloodGroup: updated.bloodGroup,
    gender: updated.gender,
    address: updated.address,
    isActive: updated.isActive,
    roles: updatedRoles.map((r: any) => r.role),
  });
}

// DELETE /api/v1/users/:id - Delete user permanently (Delete)
export async function deleteUser(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  // Cannot delete yourself
  if (req.user?.id === id) {
    return res.status(400).json({ error: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own active account' });
  }

  const [userRecord] = await db
    .select()
    .from(users)
    .where(and(eq(users.id as any, id as any), eq(users.orgId as any, orgId as any)))
    .limit(1);

  if (!userRecord) {
    return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
  }

  try {
    // Delete roles first
    await db.delete(userRoles).where(eq(userRoles.userId as any, id as any));
    // Delete user
    await db.delete(users).where(eq(users.id as any, id as any));

    await logAuditEvent({
      orgId,
      actorId: req.user!.id,
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: id,
      beforeValues: { fullName: userRecord.fullName, email: userRecord.email, employeeCode: userRecord.employeeCode },
      ipAddress: String(req.ip || ''),
    });

    return res.json({ success: true, message: `User ${userRecord.fullName} deleted successfully` });
  } catch (err: any) {
    // If foreign key constraint prevents hard delete (e.g., historical attendance sessions), soft delete
    console.warn(`Foreign key prevented hard delete for ${id}, switching to soft delete/deactivate:`, err.message);
    await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id as any, id as any));
    return res.json({
      success: true,
      message: `User ${userRecord.fullName} has historical records and was safely deactivated instead of deleted.`,
    });
  }
}

// POST /api/v1/users/:id/deactivate - Deactivate or Reactivate user
export async function deactivateUser(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [userRecord] = await db
    .select()
    .from(users)
    .where(and(eq(users.id as any, id as any), eq(users.orgId as any, orgId as any)))
    .limit(1);

  if (!userRecord) {
    return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
  }

  const newStatus = !userRecord.isActive;

  await db
    .update(users)
    .set({ isActive: newStatus, updatedAt: new Date() })
    .where(eq(users.id as any, id as any));

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
    entityType: 'USER',
    entityId: id,
    ipAddress: String(req.ip || ''),
  });

  return res.json({
    success: true,
    isActive: newStatus,
    message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
  });
}
