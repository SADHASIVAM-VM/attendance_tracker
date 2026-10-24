import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import { users, userRoles } from '../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';

const createUserSchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required'),
  email: z.string().email('Valid work email is required'),
  fullName: z.string().min(1, 'Full name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(8, 'Valid mobile number is required'),
  personalEmail: z.string().email().optional().or(z.literal('')),
  dob: z.string().optional(),
  age: z.coerce.number().min(16).max(100).optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  photoUrl: z.string().optional(),
  employmentType: z.string().default('full-time'),
  roles: z.array(z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'WORKER'])).min(1),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
  personalEmail: z.string().email().optional().or(z.literal('')),
  dob: z.string().optional(),
  age: z.coerce.number().min(16).max(100).optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  photoUrl: z.string().optional(),
  employmentType: z.string().optional(),
  employeeCode: z.string().optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  roles: z.array(z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'WORKER'])).optional(),
});

export async function getUsers(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  const hasPaginationParams =
    req.query.page !== undefined ||
    req.query.limit !== undefined ||
    req.query.offset !== undefined ||
    req.query.sortBy !== undefined ||
    req.query.search !== undefined;

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '10'), 10) || 10));
  const offset = req.query.offset !== undefined
    ? Math.max(0, parseInt(String(req.query.offset), 10) || 0)
    : (page - 1) * limit;

  // Sorting params: sort based on name (asc, desc), newest first use createdAt
  const sortBy = String(req.query.sortBy || 'createdAt');
  const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase();

  const search = String(req.query.search || '').trim().toLowerCase();
  const roleFilter = String(req.query.role || 'ALL');
  const typeFilter = String(req.query.employmentType || 'ALL').toLowerCase();
  const statusFilter = String(req.query.status || 'ALL');

  const allUsers = await db
    .select({
      id: users.id,
      employeeCode: users.employeeCode,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      personalEmail: users.personalEmail,
      dob: users.dob,
      age: users.age,
      gender: users.gender,
      bloodGroup: users.bloodGroup,
      currentAddress: users.currentAddress,
      permanentAddress: users.permanentAddress,
      address: users.address,
      emergencyContactName: users.emergencyContactName,
      emergencyContactPhone: users.emergencyContactPhone,
      photoUrl: users.photoUrl,
      employmentType: users.employmentType,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.orgId as any, orgId as any));

  const allRoles = await db
    .select()
    .from(userRoles);

  const roleMap: Record<string, string[]> = {};
  for (const r of allRoles) {
    if (!roleMap[r.userId]) {
      roleMap[r.userId] = [];
    }
    roleMap[r.userId].push(r.role);
  }

  let result = allUsers.map((u: any) => ({
    ...u,
    roles: roleMap[u.id] || [],
  }));

  // Apply search query
  if (search) {
    result = result.filter((u: any) => {
      const matchName = u.fullName?.toLowerCase().includes(search);
      const matchCode = u.employeeCode?.toLowerCase().includes(search);
      const matchEmail = u.email?.toLowerCase().includes(search);
      const matchPhone = u.phone?.toLowerCase().includes(search);
      const matchAddr = (u.currentAddress || u.address || '').toLowerCase().includes(search);
      return matchName || matchCode || matchEmail || matchPhone || matchAddr;
    });
  }

  // Apply role filter
  if (roleFilter !== 'ALL') {
    result = result.filter((u: any) => u.roles.includes(roleFilter));
  }

  // Apply employment type filter
  if (typeFilter !== 'all') {
    result = result.filter((u: any) => (u.employmentType || 'full-time').toLowerCase() === typeFilter);
  }

  // Apply status filter
  if (statusFilter === 'ACTIVE') {
    result = result.filter((u: any) => u.isActive);
  } else if (statusFilter === 'INACTIVE') {
    result = result.filter((u: any) => !u.isActive);
  }

  // Sort based on name, asc, desc, newest first use createdAt
  result.sort((a: any, b: any) => {
    if (sortBy === 'name') {
      const nameA = (a.fullName || '').toLowerCase();
      const nameB = (b.fullName || '').toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    }
    // Default: createdAt (newest first if desc, oldest first if asc)
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

  if (!hasPaginationParams && req.query.all !== 'false') {
    return res.json(result);
  }

  const total = result.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginatedUsers = result.slice(offset, offset + limit);

  return res.json({
    data: paginatedUsers,
    pagination: {
      total,
      page,
      limit,
      offset,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
}

export async function getUserById(req: Request, res: Response): Promise<any> {
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

  const rolesRecords = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId as any, userRecord.id as any));

  return res.json({
    id: userRecord.id,
    employeeCode: userRecord.employeeCode,
    email: userRecord.email,
    fullName: userRecord.fullName,
    phone: userRecord.phone,
    personalEmail: userRecord.personalEmail,
    dob: userRecord.dob,
    age: userRecord.age,
    gender: userRecord.gender,
    bloodGroup: userRecord.bloodGroup,
    currentAddress: userRecord.currentAddress,
    permanentAddress: userRecord.permanentAddress,
    address: userRecord.address,
    emergencyContactName: userRecord.emergencyContactName,
    emergencyContactPhone: userRecord.emergencyContactPhone,
    photoUrl: userRecord.photoUrl,
    employmentType: userRecord.employmentType,
    isActive: userRecord.isActive,
    createdAt: userRecord.createdAt,
    roles: rolesRecords.map((r: any) => r.role),
  });
}

export async function createUser(req: Request, res: Response): Promise<any> {
  const parseResult = createUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid user data provided',
      details: parseResult.error.issues,
    });
  }

  const data = parseResult.data;
  const db = await getDb();
  const orgId = req.user!.orgId;

  // 1. Check if email already exists
  const existingEmail = await db
    .select()
    .from(users)
    .where(eq(users.email as any, data.email.toLowerCase().trim() as any))
    .limit(1);

  if (existingEmail.length > 0) {
    return res.status(409).json({
      error: 'EMAIL_EXISTS',
      message: 'Work email address is already registered to another account.',
    });
  }

  // 2. Check if mobile number already exists (unique constraint)
  if (data.phone) {
    const existingPhone = await db
      .select()
      .from(users)
      .where(eq(users.phone as any, data.phone.trim() as any))
      .limit(1);

    if (existingPhone.length > 0) {
      return res.status(409).json({
        error: 'PHONE_EXISTS',
        message: `Mobile number ${data.phone} is already registered to another account.`,
      });
    }
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
      phone: data.phone.trim(),
      personalEmail: data.personalEmail?.trim() || null,
      dob: data.dob || null,
      age: data.age,
      gender: data.gender || null,
      bloodGroup: data.bloodGroup || null,
      currentAddress: data.currentAddress || data.address || null,
      permanentAddress: data.permanentAddress || null,
      address: data.currentAddress || data.address || null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      photoUrl: data.photoUrl || null,
      employmentType: data.employmentType || 'full-time',
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
    afterValues: {
      email: data.email,
      phone: data.phone,
      fullName: data.fullName,
      employmentType: data.employmentType,
    },
  });

  return res.status(201).json({
    id: newUser.id,
    employeeCode: newUser.employeeCode,
    email: newUser.email,
    fullName: newUser.fullName,
    phone: newUser.phone,
    personalEmail: newUser.personalEmail,
    dob: newUser.dob,
    age: newUser.age,
    gender: newUser.gender,
    bloodGroup: newUser.bloodGroup,
    currentAddress: newUser.currentAddress,
    permanentAddress: newUser.permanentAddress,
    emergencyContactName: newUser.emergencyContactName,
    emergencyContactPhone: newUser.emergencyContactPhone,
    photoUrl: newUser.photoUrl,
    employmentType: newUser.employmentType,
    isActive: newUser.isActive,
    roles: data.roles,
  });
}

export async function updateUser(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = updateUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid input data',
      details: parseResult.error.issues,
    });
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

  // Check unique phone if being changed
  if (data.phone && data.phone !== userRecord.phone) {
    const existingPhone = await db
      .select()
      .from(users)
      .where(eq(users.phone as any, data.phone.trim() as any))
      .limit(1);

    if (existingPhone.length > 0 && existingPhone[0].id !== id) {
      return res.status(409).json({
        error: 'PHONE_EXISTS',
        message: `Mobile number ${data.phone} is already registered to another account.`,
      });
    }
  }

  const updates: any = { updatedAt: new Date() };
  if (data.fullName !== undefined) updates.fullName = data.fullName;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.personalEmail !== undefined) updates.personalEmail = data.personalEmail;
  if (data.dob !== undefined) updates.dob = data.dob;
  if (data.age !== undefined) updates.age = data.age;
  if (data.gender !== undefined) updates.gender = data.gender;
  if (data.bloodGroup !== undefined) updates.bloodGroup = data.bloodGroup;
  if (data.currentAddress !== undefined) {
    updates.currentAddress = data.currentAddress;
    updates.address = data.currentAddress;
  }
  if (data.permanentAddress !== undefined) updates.permanentAddress = data.permanentAddress;
  if (data.emergencyContactName !== undefined) updates.emergencyContactName = data.emergencyContactName;
  if (data.emergencyContactPhone !== undefined) updates.emergencyContactPhone = data.emergencyContactPhone;
  if (data.photoUrl !== undefined) updates.photoUrl = data.photoUrl;
  if (data.employmentType !== undefined) updates.employmentType = data.employmentType;
  if (data.employeeCode !== undefined) updates.employeeCode = data.employeeCode.trim();
  if (data.email !== undefined) updates.email = data.email.toLowerCase().trim();
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id as any, id as any))
    .returning();

  if (data.roles) {
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
    beforeValues: { fullName: userRecord.fullName, isActive: userRecord.isActive },
    afterValues: updates,
    ipAddress: String(req.ip || ''),
  });

  const currentRoles = data.roles || (await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId as any, id as any))).map((r: any) => r.role);

  return res.json({
    id: updated.id,
    employeeCode: updated.employeeCode,
    email: updated.email,
    fullName: updated.fullName,
    phone: updated.phone,
    personalEmail: updated.personalEmail,
    dob: updated.dob,
    age: updated.age,
    gender: updated.gender,
    bloodGroup: updated.bloodGroup,
    currentAddress: updated.currentAddress,
    permanentAddress: updated.permanentAddress,
    address: updated.address,
    emergencyContactName: updated.emergencyContactName,
    emergencyContactPhone: updated.emergencyContactPhone,
    photoUrl: updated.photoUrl,
    employmentType: updated.employmentType,
    isActive: updated.isActive,
    roles: currentRoles,
  });
}

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

  await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id as any, id as any));

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'DEACTIVATE_USER',
    entityType: 'USER',
    entityId: id,
    ipAddress: String(req.ip || ''),
  });

  return res.json({ success: true, message: 'User deactivated successfully' });
}
