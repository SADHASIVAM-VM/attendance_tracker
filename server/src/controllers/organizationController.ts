import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import { organizations } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';

const updateOrgSettingsSchema = z.object({
  defaultGeofenceRadius: z.number().int().min(5).max(5000).optional(),
  maxLocationAccuracy: z.number().int().min(5).max(1000).optional(),
  allowAdminClockInApproval: z.boolean().optional(),
  clockOutEnabled: z.boolean().optional(),
  supervisorAutoApprove: z.boolean().optional(),
  supervisorBypassLocation: z.boolean().optional(),
});

export async function getOrgSettings(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [org] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      code: organizations.code,
      timezone: organizations.timezone,
      defaultGeofenceRadius: organizations.defaultGeofenceRadius,
      maxLocationAccuracy: organizations.maxLocationAccuracy,
      allowAdminClockInApproval: organizations.allowAdminClockInApproval,
      clockOutEnabled: organizations.clockOutEnabled,
      supervisorAutoApprove: organizations.supervisorAutoApprove,
      supervisorBypassLocation: organizations.supervisorBypassLocation,
      updatedAt: organizations.updatedAt,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) {
    return res.status(404).json({ error: 'ORG_NOT_FOUND', message: 'Organization not found' });
  }

  return res.json(org);
}

export async function updateOrgSettings(req: Request, res: Response): Promise<any> {
  const parseResult = updateOrgSettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const db = await getDb();
  const orgId = req.user!.orgId;
  const data = parseResult.data;

  const [existingOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!existingOrg) {
    return res.status(404).json({ error: 'ORG_NOT_FOUND', message: 'Organization not found' });
  }

  const [updatedOrg] = await db
    .update(organizations)
    .set({
      ...(data.defaultGeofenceRadius !== undefined && { defaultGeofenceRadius: data.defaultGeofenceRadius }),
      ...(data.maxLocationAccuracy !== undefined && { maxLocationAccuracy: data.maxLocationAccuracy }),
      ...(data.allowAdminClockInApproval !== undefined && { allowAdminClockInApproval: data.allowAdminClockInApproval }),
      ...(data.clockOutEnabled !== undefined && { clockOutEnabled: data.clockOutEnabled }),
      ...(data.supervisorAutoApprove !== undefined && { supervisorAutoApprove: data.supervisorAutoApprove }),
      ...(data.supervisorBypassLocation !== undefined && { supervisorBypassLocation: data.supervisorBypassLocation }),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'UPDATE_ORGANIZATION_SETTINGS',
    entityType: 'ORGANIZATION',
    entityId: orgId,
    beforeValues: existingOrg,
    afterValues: updatedOrg,
    ipAddress: req.ip,
  });

  return res.json({
    success: true,
    message: 'Organization settings updated successfully',
    settings: updatedOrg,
  });
}
