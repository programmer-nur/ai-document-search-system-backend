import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { AuthenticatedRequest } from '../modules/user/user.interface';
import prisma from '../utils/prisma';
import { WorkspaceRole } from '@prisma/client';

export interface WorkspaceRequest extends AuthenticatedRequest {
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
}

/**
 * Middleware to extract workspace from query/params and verify user membership
 */
export const requireWorkspace = async (
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    // Get workspace ID from query params or body
    const workspaceId = req.query.workspaceId as string || req.body.workspaceId || req.params.workspaceId;

    if (!workspaceId) {
      throw ApiError.badRequest('Workspace ID is required');
    }

    // Verify user is a member of the workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: req.user.userId,
        deletedAt: null,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of this workspace');
    }

    if (membership.workspace.deletedAt) {
      throw ApiError.notFound('Workspace not found');
    }

    if (!membership.workspace.isActive) {
      throw ApiError.forbidden('Workspace is inactive');
    }

    // Attach workspace context to request
    req.workspaceId = workspaceId;
    req.workspaceRole = membership.role;

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.internal('Failed to verify workspace access');
  }
};

/**
 * Middleware to check workspace role permissions
 */
export const requireWorkspaceRole = (...allowedRoles: WorkspaceRole[]) => {
  return async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.workspaceRole) {
        throw ApiError.forbidden('Workspace context required');
      }

      if (!allowedRoles.includes(req.workspaceRole)) {
        throw ApiError.forbidden('Insufficient workspace permissions');
      }

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to verify workspace permissions');
    }
  };
};

