import { getDb } from '../database/db';
import { auditLogs } from '../database/schema';

interface AuditLogParams {
  orgId?: any;
  actorId?: any;
  action: string;
  entityType: string;
  entityId?: any;
  ipAddress?: any;
  userAgent?: any;
  beforeValues?: any;
  afterValues?: any;
}

export async function logAuditEvent(params: AuditLogParams) {
  try {
    const db = await getDb();
    const resolvedIp = Array.isArray(params.ipAddress) ? params.ipAddress[0] : params.ipAddress;
    const resolvedUa = Array.isArray(params.userAgent) ? params.userAgent[0] : params.userAgent;
    const resolvedEntityId = Array.isArray(params.entityId) ? params.entityId[0] : params.entityId;

    await db.insert(auditLogs).values({
      orgId: params.orgId || null,
      actorId: params.actorId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: resolvedEntityId ? String(resolvedEntityId).slice(0, 255) : null,
      ipAddress: resolvedIp ? String(resolvedIp).slice(0, 50) : null,
      userAgent: resolvedUa ? String(resolvedUa) : null,
      beforeValues: params.beforeValues ? JSON.stringify(params.beforeValues) : null,
      afterValues: params.afterValues ? JSON.stringify(params.afterValues) : null,
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
