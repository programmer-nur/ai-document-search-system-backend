import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { WorkspaceService } from './workspace.service';
import { catchAsync, sendResponse } from '../../utils';
import { AuthenticatedRequest } from '../user/user.interface';
import { WorkspaceRequest } from '../../middlewares/workspace';

export class WorkspaceController {
  /**
   * Create a new workspace
   * POST /api/workspaces
   */
  static create = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const workspace = await WorkspaceService.createWorkspace(req.body, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Workspace created successfully',
      data: workspace,
    });
  });

  /**
   * Get workspace by ID
   * GET /api/workspaces/:id
   */
  static getById = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    const workspace = await WorkspaceService.getWorkspaceById(id, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Workspace retrieved successfully',
      data: workspace,
    });
  });

  /**
   * Get all workspaces for current user
   * GET /api/workspaces
   */
  static getAll = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { page, limit, search, isActive } = req.query;

    const result = await WorkspaceService.getWorkspaces(req.user.userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search as string | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Workspaces retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  });

  /**
   * Update workspace
   * PATCH /api/workspaces/:id
   */
  static update = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    const workspace = await WorkspaceService.updateWorkspace(id, req.body, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Workspace updated successfully',
      data: workspace,
    });
  });

  /**
   * Delete workspace
   * DELETE /api/workspaces/:id
   */
  static delete = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    await WorkspaceService.deleteWorkspace(id, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Workspace deleted successfully',
      data: null,
    });
  });

  /**
   * Add member to workspace
   * POST /api/workspaces/:id/members
   */
  static addMember = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    const member = await WorkspaceService.addMember(id, req.body, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Member added successfully',
      data: member,
    });
  });

  /**
   * Update member role
   * PATCH /api/workspaces/:id/members/:memberId
   */
  static updateMember = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id, memberId } = req.params;
    const member = await WorkspaceService.updateMemberRole(id, memberId, req.body.role, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Member updated successfully',
      data: member,
    });
  });

  /**
   * Remove member from workspace
   * DELETE /api/workspaces/:id/members/:memberId
   */
  static removeMember = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id, memberId } = req.params;
    await WorkspaceService.removeMember(id, memberId, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Member removed successfully',
      data: null,
    });
  });

  /**
   * Get workspace members
   * GET /api/workspaces/:id/members
   */
  static getMembers = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    const members = await WorkspaceService.getWorkspaceMembers(id, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Members retrieved successfully',
      data: members,
    });
  });
}

