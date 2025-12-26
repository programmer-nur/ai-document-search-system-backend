import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthService } from './auth.service';
import { catchAsync, sendResponse, getRequestMetadata } from '../../utils';
import { AuthenticatedRequest } from '../user/user.interface';

export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  static register = catchAsync(async (req: Request, res: Response) => {
    const metadata = getRequestMetadata(req);
    const result = await AuthService.register(req.body, metadata);

    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  });

  /**
   * Login user
   * POST /api/auth/login
   */
  static login = catchAsync(async (req: Request, res: Response) => {
    const metadata = getRequestMetadata(req);
    const result = await AuthService.login(req.body, metadata);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Login successful',
      data: result,
    });
  });

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  static getCurrentUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const user = await AuthService.getCurrentUser(req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'User retrieved successfully',
      data: user,
    });
  });

  /**
   * Change password
   * POST /api/auth/change-password
   */
  static changePassword = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const metadata = getRequestMetadata(req);
    await AuthService.changePassword(req.user.userId, req.body, metadata);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Password changed successfully',
      data: null,
    });
  });
}

