import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import { users, userRoles } from '../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
const createUserSchema = z.object({
    employeeCode: z.string().min(1),
    email: z.string().email(),
    fullName: z.string().min(1),
    password: z.string().min(6),
    phone: z.string().optional(),
    roles: z.array(z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'WORKER'])).min(1),
});
const updateUserSchema = z.object({
    fullName: z.string().min(1).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
    roles: z.array(z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'WORKER'])).optional(),
});
export async function getUsers(req, res) {
    const db = await getDb();
    const orgId = req.user.orgId;
    const allUsers = await db
        .select({
        id: users.id,
        employeeCode: users.employeeCode,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
    })
        .from(users)
        .where(eq(users.orgId, orgId));
    const allRoles = await db
        .select()
        .from(userRoles);
    const roleMap = {};
    for (const r of allRoles) {
        if (!roleMap[r.userId]) {
            roleMap[r.userId] = [];
        }
        roleMap[r.userId].push(r.role);
    }
    const result = allUsers.map((u) => ({
        ...u,
        roles: roleMap[u.id] || [],
    }));
    return res.json(result);
}
export async function getUserById(req, res) {
    const { id } = req.params;
    const db = await getDb();
    const orgId = req.user.orgId;
    const [userRecord] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.orgId, orgId)))
        .limit(1);
    if (!userRecord) {
        return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }
    const rolesRecords = await db
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, userRecord.id));
    return res.json({
        id: userRecord.id,
        employeeCode: userRecord.employeeCode,
        email: userRecord.email,
        fullName: userRecord.fullName,
        phone: userRecord.phone,
        isActive: userRecord.isActive,
        createdAt: userRecord.createdAt,
        roles: rolesRecords.map((r) => r.role),
    });
}
export async function createUser(req, res) {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
    }
    const data = parseResult.data;
    const db = await getDb();
    const orgId = req.user.orgId;
    const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, data.email.toLowerCase().trim()))
        .limit(1);
    if (existing.length > 0) {
        return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'Email is already registered' });
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
        phone: data.phone,
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
        actorId: req.user.id,
        action: 'CREATE_USER',
        entityType: 'USER',
        entityId: newUser.id,
        afterValues: { email: data.email, roles: data.roles },
    });
    return res.status(201).json({
        id: newUser.id,
        employeeCode: newUser.employeeCode,
        email: newUser.email,
        fullName: newUser.fullName,
        phone: newUser.phone,
        isActive: newUser.isActive,
        roles: data.roles,
    });
}
export async function updateUser(req, res) {
    const { id } = req.params;
    const parseResult = updateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
    }
    const data = parseResult.data;
    const db = await getDb();
    const orgId = req.user.orgId;
    const [userRecord] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.orgId, orgId)))
        .limit(1);
    if (!userRecord) {
        return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }
    const updates = { updatedAt: new Date() };
    if (data.fullName !== undefined)
        updates.fullName = data.fullName;
    if (data.phone !== undefined)
        updates.phone = data.phone;
    if (data.email !== undefined)
        updates.email = data.email.toLowerCase().trim();
    if (data.isActive !== undefined)
        updates.isActive = data.isActive;
    const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();
    if (data.roles) {
        await db.delete(userRoles).where(eq(userRoles.userId, id));
        for (const role of data.roles) {
            await db.insert(userRoles).values({ userId: id, role });
        }
    }
    await logAuditEvent({
        orgId,
        actorId: req.user.id,
        action: 'UPDATE_USER',
        entityType: 'USER',
        entityId: id,
        beforeValues: { fullName: userRecord.fullName, isActive: userRecord.isActive },
        afterValues: updates,
        ipAddress: String(req.ip || ''),
    });
    return res.json({
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        isActive: updated.isActive,
        roles: data.roles,
    });
}
export async function deactivateUser(req, res) {
    const { id } = req.params;
    const db = await getDb();
    const orgId = req.user.orgId;
    const [userRecord] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.orgId, orgId)))
        .limit(1);
    if (!userRecord) {
        return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }
    await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, id));
    await logAuditEvent({
        orgId,
        actorId: req.user.id,
        action: 'DEACTIVATE_USER',
        entityType: 'USER',
        entityId: id,
        ipAddress: String(req.ip || ''),
    });
    return res.json({ success: true, message: 'User deactivated successfully' });
}
