import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../database/db.js';
import { users, userRoles } from '../database/schema.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'attendance_dev_jwt_secret_key_2026';

export interface AuthenticatedUser {
  id: string;
  orgId: string;
  employeeCode: string;
  email: string;
  fullName: string;
  roles: string[];
  phone?: string | null;
  personalEmail?: string | null;
  dob?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  employmentType?: string | null;
  photoUrl?: string | null;
  isActive?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      roles: user.roles,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication token required',
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const db = await getDb();

    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!userRecord || !userRecord.isActive) {
      return res.status(401).json({
        error: 'USER_INACTIVE_OR_NOT_FOUND',
        message: 'User account is inactive or not found',
      });
    }

    const rolesRecords = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userRecord.id));

    const roles = rolesRecords.map((r: { role: string }) => r.role);

    req.user = {
      id: userRecord.id,
      orgId: userRecord.orgId,
      employeeCode: userRecord.employeeCode,
      email: userRecord.email,
      fullName: userRecord.fullName,
      roles,
      phone: userRecord.phone,
      personalEmail: userRecord.personalEmail,
      dob: userRecord.dob ? String(userRecord.dob) : null,
      gender: userRecord.gender,
      bloodGroup: userRecord.bloodGroup,
      currentAddress: userRecord.currentAddress || userRecord.address,
      permanentAddress: userRecord.permanentAddress,
      emergencyContactName: userRecord.emergencyContactName,
      emergencyContactPhone: userRecord.emergencyContactPhone,
      employmentType: userRecord.employmentType,
      photoUrl: userRecord.photoUrl,
      isActive: userRecord.isActive,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Session token has expired or is invalid',
    });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Requires one of roles: [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
}
