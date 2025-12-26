import { UserRole } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import type { UpdateUserInput, UserResponse, UserQueryParams } from './user.types';
import { logger } from '../../utils/logger';
import { createAuditLog } from '../../utils/auditLog';
import prisma from '../../utils/prisma';

export class UserService {
  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    return this.formatUserResponse(user);
  }

  /**
   * Get all users with pagination
   * Supports workspace-scoped queries for multi-tenant isolation
   */
  static async getUsers(params: UserQueryParams & { workspaceId?: string }) {
    const { page = 1, limit = 10, search, role, isActive, workspaceId } = params;
    const skip = (page - 1) * limit;

    // Build filter
    const where: {
      deletedAt?: null;
      email?: { contains: string; mode: 'insensitive' };
      role?: UserRole;
      isActive?: boolean;
      workspaceMemberships?: {
        some: {
          workspaceId: string;
          deletedAt: null;
        };
      };
    } = {
      deletedAt: null,
    };

    // If workspaceId is provided, filter by workspace membership
    if (workspaceId) {
      where.workspaceMemberships = {
        some: {
          workspaceId,
          deletedAt: null,
        },
      };
    }

    if (search) {
      where.email = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get users and total count
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users.map(user => this.formatUserResponse(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Update user
   */
  static async updateUser(
    id: string,
    data: UpdateUserInput,
    currentUserId: string
  ): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    // Check permissions (users can only update themselves unless they're admin)
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
    });

    if (!currentUser) {
      throw ApiError.unauthorized('Unauthorized');
    }

    // Only allow updating isActive if current user is admin
    if (
      data.isActive !== undefined &&
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.SUPER_ADMIN
    ) {
      throw ApiError.forbidden('Only admins can change user status');
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        avatar: data.avatar,
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: currentUserId,
      action: 'user.update',
      resourceType: 'user',
      resourceId: id,
      details: { updatedFields: Object.keys(data) },
    });

    logger.info('User updated', { userId: id, updatedBy: currentUserId });

    return this.formatUserResponse(updatedUser);
  }

  /**
   * Delete user (soft delete)
   */
  static async deleteUser(id: string, currentUserId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    // Prevent self-deletion
    if (id === currentUserId) {
      throw ApiError.badRequest('You cannot delete your own account');
    }

    // Soft delete
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Create audit log
    await createAuditLog({
      userId: currentUserId,
      action: 'user.delete',
      resourceType: 'user',
      resourceId: id,
    });

    logger.info('User deleted', { userId: id, deletedBy: currentUserId });
  }

  /**
   * Format user response (exclude sensitive data)
   */
  private static formatUserResponse(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    role: UserRole;
    isActive: boolean;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
