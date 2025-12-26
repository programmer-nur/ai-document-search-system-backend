import prisma from './prisma';
import { logger } from './logger';

type AuditLogData = {
  workspaceId?: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Create an audit log entry
 * This should be called after important actions for compliance and security
 */
export const createAuditLog = async (data: AuditLogData): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: data.workspaceId,
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        details: data.details || {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    logger.error('Failed to create audit log', { error, data });
  }
};

/**
 * Helper to extract IP and user agent from request
 */
export const getRequestMetadata = (req: {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers?: { 'user-agent'?: string };
}): { ipAddress?: string; userAgent?: string } => {
  return {
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
  };
};
