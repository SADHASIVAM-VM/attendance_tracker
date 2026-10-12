import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import { users, userRoles, organizations } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { generateToken } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response): Promise<any> {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Email and password are required',
      details: parseResult.error.issues,
    });
  }

  const { email, password } = parseResult.data;
  const db = await getDb();

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!userRecord || !userRecord.isActive) {
    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  }

  const isPasswordValid = await bcrypt.compare(password, userRecord.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  }

  // Get user roles
  const rolesRecords = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userRecord.id));

  const roles = rolesRecords.map((r: { role: string }) => r.role);

  // Get organization
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, userRecord.orgId))
    .limit(1);

  const authUser = {
    id: userRecord.id,
    orgId: userRecord.orgId,
    employeeCode: userRecord.employeeCode,
    email: userRecord.email,
    fullName: userRecord.fullName,
    roles,
  };

  const token = generateToken(authUser);

  await logAuditEvent({
    orgId: userRecord.orgId,
    actorId: userRecord.id,
    action: 'USER_LOGIN',
    entityType: 'USER',
    entityId: userRecord.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.json({
    token,
    user: authUser,
    organization: org,
  });
}

export async function getMe(req: Request, res: Response): Promise<any> {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const db = await getDb();
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, req.user.orgId))
    .limit(1);

  return res.json({
    user: req.user,
    organization: org,
  });
}

export async function logout(req: Request, res: Response): Promise<any> {
  if (req.user) {
    await logAuditEvent({
      orgId: req.user.orgId,
      actorId: req.user.id,
      action: 'USER_LOGOUT',
      entityType: 'USER',
      entityId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
  return res.json({ success: true, message: 'Logged out successfully' });
}
