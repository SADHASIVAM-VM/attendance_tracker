import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database/db.js';
import { worksites } from '../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { logAuditEvent } from '../utils/audit.js';
import { resolveGoogleMapsUrl } from '../utils/mapsUrlParser.js';

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

  const hasPaginationParams =
    req.query.page !== undefined ||
    req.query.limit !== undefined ||
    req.query.offset !== undefined ||
    req.query.sortBy !== undefined ||
    req.query.search !== undefined ||
    req.query.status !== undefined;

  const allSites = await db
    .select()
    .from(worksites)
    .where(eq(worksites.orgId as any, orgId as any));

  if (!hasPaginationParams) {
    return res.json(allSites);
  }

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '10'), 10) || 10));
  const offset =
    req.query.offset !== undefined
      ? Math.max(0, parseInt(String(req.query.offset), 10) || 0)
      : (page - 1) * limit;

  const sortBy = String(req.query.sortBy || 'createdAt');
  const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase();
  const search = String(req.query.search || '').trim().toLowerCase();
  const statusFilter = String(req.query.status || 'ALL').toUpperCase();

  let filtered = allSites;

  // Search filter
  if (search) {
    filtered = filtered.filter(
      (s: any) =>
        s.name.toLowerCase().includes(search) ||
        s.code.toLowerCase().includes(search) ||
        s.address.toLowerCase().includes(search) ||
        (s.description && s.description.toLowerCase().includes(search))
    );
  }

  // Status filter
  if (statusFilter === 'ACTIVE') {
    filtered = filtered.filter((s: any) => s.isActive === true);
  } else if (statusFilter === 'INACTIVE') {
    filtered = filtered.filter((s: any) => s.isActive === false);
  }

  // Sorting
  filtered.sort((a: any, b: any) => {
    let valA: any = a[sortBy];
    let valB: any = b[sortBy];

    if (sortBy === 'name' || sortBy === 'code' || sortBy === 'address') {
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    if (sortBy === 'createdAt') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }

    if (sortBy === 'radiusMeters') {
      const numA = Number(a.radiusMeters || 0);
      const numB = Number(b.radiusMeters || 0);
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    }

    return 0;
  });

  const totalCount = filtered.length;
  const paginatedData = filtered.slice(offset, offset + limit);
  const totalPages = Math.ceil(totalCount / limit);

  return res.json({
    data: paginatedData,
    pagination: {
      totalCount,
      totalPages,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
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
