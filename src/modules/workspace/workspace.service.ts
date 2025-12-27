import { WorkspaceRole } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { createAuditLog } from '../../utils/auditLog';
import prisma from '../../utils/prisma';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceResponse,
  WorkspaceMemberInput,
  WorkspaceMemberResponse,
  WorkspaceQueryParams,
} from './workspace.types';

export class WorkspaceService {
  /**
   * Generate slug from name
   */
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Format workspace response
   */
  private static formatWorkspaceResponse(workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logo: string | null;
    isActive: boolean;
    settings: any;
    createdAt: Date;
    updatedAt: Date;
  }): WorkspaceResponse {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      logo: workspace.logo,
      isActive: workspace.isActive,
      settings: (workspace.settings as Record<string, unknown>) || null,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  /**
   * Create a new workspace
   */
  static async createWorkspace(
    data: CreateWorkspaceInput,
    ownerId: string
  ): Promise<WorkspaceResponse> {
    // Generate slug if not provided
    const slug = data.slug || this.generateSlug(data.name);

    // Check if slug already exists
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug },
    });

    if (existingWorkspace) {
      throw ApiError.conflict('Workspace with this slug already exists');
    }

    // Create workspace and add owner as workspace owner
    const workspace = await prisma.workspace.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        logo: data.logo,
        settings: (data.settings || {}) as any,
        members: {
          create: {
            userId: ownerId,
            role: WorkspaceRole.OWNER,
            joinedAt: new Date(),
          },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      workspaceId: workspace.id,
      userId: ownerId,
      action: 'workspace.create',
      resourceType: 'workspace',
      resourceId: workspace.id,
      details: { name: workspace.name, slug: workspace.slug },
    });

    logger.info('Workspace created', { workspaceId: workspace.id, ownerId });

    return this.formatWorkspaceResponse(workspace);
  }

  /**
   * Get workspace by ID
   */
  static async getWorkspaceById(id: string, userId: string): Promise<WorkspaceResponse> {
    // Verify user is a member
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: id,
        userId,
        deletedAt: null,
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of this workspace');
    }

    if (membership.workspace.deletedAt) {
      throw ApiError.notFound('Workspace not found');
    }

    return this.formatWorkspaceResponse(membership.workspace);
  }

  /**
   * Get all workspaces for a user
   */
  static async getWorkspaces(userId: string, params: WorkspaceQueryParams) {
    const { page = 1, limit = 10, search, isActive } = params;
    const skip = (page - 1) * limit;

    // Build filter
    const where: {
      members: {
        some: {
          userId: string;
          deletedAt: null;
        };
      };
      deletedAt?: null;
      name?: { contains: string; mode: 'insensitive' };
      isActive?: boolean;
    } = {
      members: {
        some: {
          userId,
          deletedAt: null,
        },
      },
      deletedAt: null,
    };

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get workspaces and total count
    const [workspaces, total] = await Promise.all([
      prisma.workspace.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workspace.count({ where }),
    ]);

    return {
      data: workspaces.map(ws => this.formatWorkspaceResponse(ws)),
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
   * Update workspace
   */
  static async updateWorkspace(
    id: string,
    data: UpdateWorkspaceInput,
    userId: string
  ): Promise<WorkspaceResponse> {
    // Verify user has permission (owner or admin)
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: id,
        userId,
        role: {
          in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
        },
        deletedAt: null,
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You do not have permission to update this workspace');
    }

    // Update workspace
    const updateData: any = {
      name: data.name,
      description: data.description,
      logo: data.logo,
      isActive: data.isActive,
    };
    
    if (data.settings !== undefined) {
      updateData.settings = data.settings as any;
    }
    
    const workspace = await prisma.workspace.update({
      where: { id },
      data: updateData,
    });

    // Create audit log
    await createAuditLog({
      workspaceId: id,
      userId,
      action: 'workspace.update',
      resourceType: 'workspace',
      resourceId: id,
      details: { updatedFields: Object.keys(data) },
    });

    logger.info('Workspace updated', { workspaceId: id, userId });

    return this.formatWorkspaceResponse(workspace);
  }

  /**
   * Delete workspace (soft delete)
   */
  static async deleteWorkspace(id: string, userId: string): Promise<void> {
    // Verify user is owner
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: id,
        userId,
        role: WorkspaceRole.OWNER,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw ApiError.forbidden('Only workspace owners can delete workspaces');
    }

    // Soft delete
    await prisma.workspace.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Create audit log
    await createAuditLog({
      workspaceId: id,
      userId,
      action: 'workspace.delete',
      resourceType: 'workspace',
      resourceId: id,
    });

    logger.info('Workspace deleted', { workspaceId: id, userId });
  }

  /**
   * Add member to workspace
   */
  static async addMember(
    workspaceId: string,
    data: WorkspaceMemberInput,
    inviterId: string
  ): Promise<WorkspaceMemberResponse> {
    // Verify inviter has permission (owner or admin)
    const inviterMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: inviterId,
        role: {
          in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
        },
        deletedAt: null,
      },
    });

    if (!inviterMembership) {
      throw ApiError.forbidden('You do not have permission to add members');
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    // Check if already a member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: data.userId,
        deletedAt: null,
      },
    });

    if (existingMember) {
      throw ApiError.conflict('User is already a member of this workspace');
    }

    // Add member
    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: data.userId,
        role: data.role,
        invitedBy: inviterId,
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      workspaceId,
      userId: inviterId,
      action: 'workspace.member.add',
      resourceType: 'workspace_member',
      resourceId: member.id,
      details: { addedUserId: data.userId, role: data.role },
    });

    logger.info('Member added to workspace', { workspaceId, memberId: member.id });

    return {
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role,
      user: member.user,
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
    };
  }

  /**
   * Update member role
   */
  static async updateMemberRole(
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
    updaterId: string
  ): Promise<WorkspaceMemberResponse> {
    // Verify updater has permission (owner or admin)
    const updaterMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: updaterId,
        role: {
          in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
        },
        deletedAt: null,
      },
    });

    if (!updaterMembership) {
      throw ApiError.forbidden('You do not have permission to update members');
    }

    // Prevent changing owner role (only owner can change owner)
    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (member?.role === WorkspaceRole.OWNER && updaterMembership.role !== WorkspaceRole.OWNER) {
      throw ApiError.forbidden('Only workspace owners can change owner role');
    }

    // Update member
    const updatedMember = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      workspaceId,
      userId: updaterId,
      action: 'workspace.member.update',
      resourceType: 'workspace_member',
      resourceId: memberId,
      details: { newRole: role },
    });

    logger.info('Member role updated', { workspaceId, memberId });

    return {
      id: updatedMember.id,
      workspaceId: updatedMember.workspaceId,
      userId: updatedMember.userId,
      role: updatedMember.role,
      user: updatedMember.user,
      joinedAt: updatedMember.joinedAt,
      createdAt: updatedMember.createdAt,
    };
  }

  /**
   * Remove member from workspace
   */
  static async removeMember(
    workspaceId: string,
    memberId: string,
    removerId: string
  ): Promise<void> {
    // Verify remover has permission (owner or admin)
    const removerMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: removerId,
        role: {
          in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
        },
        deletedAt: null,
      },
    });

    if (!removerMembership) {
      throw ApiError.forbidden('You do not have permission to remove members');
    }

    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.deletedAt) {
      throw ApiError.notFound('Member not found');
    }

    // Prevent removing owner
    if (member.role === WorkspaceRole.OWNER) {
      throw ApiError.forbidden('Cannot remove workspace owner');
    }

    // Prevent self-removal by owner
    if (member.userId === removerId && removerMembership.role === WorkspaceRole.OWNER) {
      throw ApiError.badRequest('Workspace owner cannot remove themselves');
    }

    // Soft delete member
    await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { deletedAt: new Date() },
    });

    // Create audit log
    await createAuditLog({
      workspaceId,
      userId: removerId,
      action: 'workspace.member.remove',
      resourceType: 'workspace_member',
      resourceId: memberId,
      details: { removedUserId: member.userId },
    });

    logger.info('Member removed from workspace', { workspaceId, memberId });
  }

  /**
   * Get workspace members
   */
  static async getWorkspaceMembers(workspaceId: string, userId: string) {
    // Verify user is a member
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of this workspace');
    }

    // Get all members
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // Owners first
        { joinedAt: 'asc' },
      ],
    });

    return members.map(member => ({
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role,
      user: member.user,
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
    }));
  }
}

