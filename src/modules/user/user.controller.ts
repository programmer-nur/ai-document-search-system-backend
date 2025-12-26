import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserService } from './user.service';
import { catchAsync, sendResponse } from '../../utils';
import { AuthenticatedRequest } from './user.interface';

export class UserController {
  /**
   * Get user by ID
   * GET /api/users/:id
   */
  static getUserById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await UserService.getUserById(id);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'User retrieved successfully',
      data: user,
    });
  });

  /**
   * Get all users with pagination
   * GET /api/users
   */
  static getUsers = catchAsync(async (req: Request, res: Response) => {
    const { page, limit, search, role, isActive } = req.query;

    const result = await UserService.getUsers({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search as string | undefined,
      role: role as any,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Users retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  });

  /**
   * Update user
   * PATCH /api/users/:id
   */
  static updateUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    const user = await UserService.updateUser(id, req.body, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  });

  /**
   * Delete user (soft delete)
   * DELETE /api/users/:id
   */
  static deleteUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    await UserService.deleteUser(id, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'User deleted successfully',
      data: null,
    });
  });
}
