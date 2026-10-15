import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db';
import { worksites } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit';
import { resolveGoogleMapsUrl } from '../utils/mapsUrlParser';

const worksiteSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().min(1),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(5).max(5000).default(20),
  maxAccuracyMeters: z.number().int().min(5).max(1000).default(50),
  isActive: z.boolean().default(true),
});

const updateWorksiteSchema = worksiteSchema.partial();

export async function getWorksites(req: Request, res: Response): Promise<any> {
  const db = await getDb();
  const orgId = req.user!.orgId;

  const sites = await db
    .select()
    .from(worksites)
    .where(eq(worksites.orgId as any, orgId as any));

  return res.json(sites);
}

export async function getWorksiteById(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [site] = await db
    .select()
    .from(worksites)
    .where(and(eq(worksites.id as any, id as any), eq(worksites.orgId as any, orgId as any)))
    .limit(1);

  if (!site) {
    return res.status(404).json({ error: 'WORKSITE_NOT_FOUND', message: 'Worksite not found' });
  }

  return res.json(site);
}

export async function createWorksite(req: Request, res: Response): Promise<any> {
  const parseResult = worksiteSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const data = parseResult.data;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [newSite] = await db
    .insert(worksites)
    .values({
      orgId,
      name: data.name,
      code: data.code,
      address: data.address,
      description: data.description,
      latitude: data.latitude,
      longitude: data.longitude,
      radiusMeters: data.radiusMeters,
      maxAccuracyMeters: data.maxAccuracyMeters,
      isActive: data.isActive,
    })
    .returning();

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'CREATE_WORKSITE',
    entityType: 'WORKSITE',
    entityId: newSite.id,
    afterValues: newSite,
    ipAddress: String(req.ip || ''),
  });

  return res.status(201).json(newSite);
}

export async function updateWorksite(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const parseResult = updateWorksiteSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parseResult.error.issues });
  }

  const data = parseResult.data;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [existingSite] = await db
    .select()
    .from(worksites)
    .where(and(eq(worksites.id as any, id as any), eq(worksites.orgId as any, orgId as any)))
    .limit(1);

  if (!existingSite) {
    return res.status(404).json({ error: 'WORKSITE_NOT_FOUND', message: 'Worksite not found' });
  }

  const updates = {
    ...data,
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(worksites)
    .set(updates)
    .where(eq(worksites.id as any, id as any))
    .returning();

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'UPDATE_WORKSITE',
    entityType: 'WORKSITE',
    entityId: id,
    beforeValues: {
      latitude: existingSite.latitude,
      longitude: existingSite.longitude,
      radiusMeters: existingSite.radiusMeters,
      maxAccuracyMeters: existingSite.maxAccuracyMeters,
    },
    afterValues: {
      latitude: updated.latitude,
      longitude: updated.longitude,
      radiusMeters: updated.radiusMeters,
      maxAccuracyMeters: updated.maxAccuracyMeters,
    },
    ipAddress: String(req.ip || ''),
  });

  return res.json(updated);
}

export async function deactivateWorksite(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const db = await getDb();
  const orgId = req.user!.orgId;

  const [site] = await db
    .select()
    .from(worksites)
    .where(and(eq(worksites.id as any, id as any), eq(worksites.orgId as any, orgId as any)))
    .limit(1);

  if (!site) {
    return res.status(404).json({ error: 'WORKSITE_NOT_FOUND', message: 'Worksite not found' });
  }

  await db
    .update(worksites)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(worksites.id as any, id as any));

  await logAuditEvent({
    orgId,
    actorId: req.user!.id,
    action: 'DEACTIVATE_WORKSITE',
    entityType: 'WORKSITE',
    entityId: id,
    ipAddress: String(req.ip || ''),
  });

  return res.json({ success: true, message: 'Worksite deactivated' });
}

const extractRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkExtractRateLimit(key: string, maxRequests = 20, windowMs = 60000): boolean {
  const now = Date.now();
  const record = extractRateLimitMap.get(key);
  if (!record || now > record.resetAt) {
    extractRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) {
    return false;
  }
  record.count++;
  return true;
}

const extractSchema = z.object({
  mapsUrl: z.string().min(1, 'Google Maps URL is required'),
});

export async function extractCoordinates(req: Request, res: Response): Promise<any> {
  const clientKey = req.user?.id || req.ip || 'anonymous';
  if (!checkExtractRateLimit(clientKey, 20, 60000)) {
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many coordinate extraction requests. Please wait a minute before trying again.',
    });
  }

  const parseResult = extractSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'A valid Google Maps link is required.',
      details: parseResult.error.issues,
    });
  }

  try {
    const result = await resolveGoogleMapsUrl(parseResult.data.mapsUrl);
    return res.json(result);
  } catch (err: any) {
    const rawMessage = err.message || 'Failed to extract coordinates from Google Maps link';
    const parts = rawMessage.split(': ');
    const code = parts.length > 1 ? parts[0] : 'EXTRACTION_FAILED';
    const msg = parts.length > 1 ? parts.slice(1).join(': ') : rawMessage;

    return res.status(400).json({
      error: code.trim(),
      message: msg.trim(),
    });
  }
}
