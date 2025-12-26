import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { SearchService } from './search.service';
import { catchAsync, sendResponse } from '../../utils';
import { WorkspaceRequest } from '../../middlewares/workspace';

export class SearchController {
  /**
   * Perform hybrid search
   * POST /api/workspaces/:id/search
   */
  static search = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.workspaceId) {
      throw new Error('Workspace context required');
    }

    const result = await SearchService.search(
      req.workspaceId,
      req.user?.userId,
      req.body
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Search completed successfully',
      data: result,
    });
  });

  /**
   * Ask a question
   * POST /api/workspaces/:id/question
   */
  static askQuestion = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.workspaceId) {
      throw new Error('Workspace context required');
    }

    const result = await SearchService.askQuestion(
      req.workspaceId,
      req.user?.userId,
      req.body
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Question answered successfully',
      data: result,
    });
  });

  /**
   * Get query history
   * GET /api/workspaces/:id/queries
   */
  static getQueryHistory = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.workspaceId || !req.user) {
      throw new Error('Workspace context and authentication required');
    }

    const { page, limit, type } = req.query;

    const result = await SearchService.getQueryHistory(
      req.workspaceId,
      req.user.userId,
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        type: type as any,
      }
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Query history retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  });
}

