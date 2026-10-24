import { getDb } from '../database/db.js';
import { auditLogs } from '../database/schema.js';

export interface AuditLogParams {
  orgId?: any;
  actorId?: any;
  actorNameSnapshot?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: any;
  reason?: string;
  metadata?: any;
  ipAddress?: any;
  userAgent?: any;
  beforeValues?: any;
  afterValues?: any;
  req?: any; // Express request to safely extract authenticated user context & IP
}

/**
 * Centralized Actor-Based Audit Logging Service.
 * Snapshots actor name & role from authenticated session (never trusting client parameters),
 * sets server-generated timestamps, and persists state before & after values.
 */
export async function logAuditEvent(params: AuditLogParams) {
  try {
    const db = await getDb();

    // Derive actor context securely from Express request if provided
    let derivedActorId = params.actorId || null;
    let derivedActorName = params.actorNameSnapshot || null;
    let derivedActorRole = params.actorRole || null;
    let derivedIp = params.ipAddress || null;
    let derivedUa = params.userAgent || null;

    if (params.req) {
      if (params.req.user) {
        derivedActorId = derivedActorId || params.req.user.id;
        derivedActorName = derivedActorName || params.req.user.fullName;
        derivedActorRole = derivedActorRole || (params.req.user.roles && params.req.user.roles[0]) || 'USER';
      }
      derivedIp = derivedIp || params.req.ip || params.req.headers?.['x-forwarded-for'];
      derivedUa = derivedUa || params.req.headers?.['user-agent'];
    }

    // Fallback for system / background automated jobs
    if (!derivedActorId && !derivedActorRole) {
      derivedActorName = derivedActorName || 'System Service';
      derivedActorRole = 'SYSTEM';
    }

    const resolvedIp = Array.isArray(derivedIp) ? derivedIp[0] : derivedIp;
    const resolvedUa = Array.isArray(derivedUa) ? derivedUa[0] : derivedUa;
    const resolvedEntityId = Array.isArray(params.entityId) ? params.entityId[0] : params.entityId;

    await db.insert(auditLogs).values({
      orgId: params.orgId || (params.req?.user?.orgId ?? null),
      actorId: derivedActorId,
      actorNameSnapshot: derivedActorName ? String(derivedActorName).slice(0, 255) : null,
      actorRole: derivedActorRole ? String(derivedActorRole).slice(0, 50) : null,
      action: params.action,
      entityType: params.entityType,
      entityId: resolvedEntityId ? String(resolvedEntityId).slice(0, 255) : null,
      reason: params.reason ? String(params.reason) : null,
      metadata: params.metadata ? (typeof params.metadata === 'string' ? params.metadata : JSON.stringify(params.metadata)) : null,
      ipAddress: resolvedIp ? String(resolvedIp).slice(0, 50) : null,
      userAgent: resolvedUa ? String(resolvedUa).slice(0, 500) : null,
      beforeValues: params.beforeValues ? JSON.stringify(params.beforeValues) : null,
      afterValues: params.afterValues ? JSON.stringify(params.afterValues) : null,
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

