import jwt from 'jsonwebtoken';
import { getDb } from '../database/db.js';
import { users, userRoles } from '../database/schema.js';
import { eq } from 'drizzle-orm';
const JWT_SECRET = process.env.JWT_SECRET || 'attendance_dev_jwt_secret_key_2026';
export function generateToken(user) {
    return jwt.sign({
        id: user.id,
        orgId: user.orgId,
        email: user.email,
        roles: user.roles,
    }, JWT_SECRET, { expiresIn: '7d' });
}
export async function authenticate(req, res, next) {
    let token;
    if (req.cookies && req.cookies.attendance_token) {
        token = req.cookies.attendance_token;
    } else if (req.headers.cookie) {
        const raw = req.headers.cookie.split(';');
        for (const c of raw) {
            const [k, ...v] = c.trim().split('=');
            if (k === 'attendance_token') {
                token = decodeURIComponent(v.join('='));
                break;
            }
        }
    }
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    if (!token) {
        return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Authentication token required',
        });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
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
        const roles = rolesRecords.map((r) => r.role);
        req.user = {
            id: userRecord.id,
            orgId: userRecord.orgId,
            employeeCode: userRecord.employeeCode,
            email: userRecord.email,
            fullName: userRecord.fullName,
            roles,
        };
        next();
    }
    catch (err) {
        return res.status(401).json({
            error: 'INVALID_TOKEN',
            message: 'Session token has expired or is invalid',
        });
    }
}
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
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
