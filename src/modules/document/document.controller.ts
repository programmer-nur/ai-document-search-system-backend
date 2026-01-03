import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DocumentService } from './document.service';
import { S3Service } from '../../services/s3.service';
import { catchAsync, sendResponse } from '../../utils';
import { WorkspaceRequest } from '../../middlewares/workspace';

export class DocumentController {
  /**
   * Get pre-signed URL for file upload
   * GET /api/workspaces/:id/documents/upload-url
   */
  static getUploadUrl = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.workspaceId) {
      throw new Error('Workspace context required');
    }

    const { fileName, contentType } = req.query;

    if (!fileName || !contentType) {
      throw new Error('fileName and contentType are required');
    }

    // Generate S3 key
    const timestamp = Date.now();
    const sanitizedFileName = (fileName as string).replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `workspaces/${req.workspaceId}/documents/${timestamp}-${sanitizedFileName}`;

    // Generate pre-signed URL
    const uploadUrl = await S3Service.getUploadUrl(
      s3Key,
      contentType as string,
      3600 // 1 hour expiry
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Upload URL generated successfully',
      data: {
        uploadUrl,
        s3Key,
        expiresIn: 3600,
      },
    });
  });

  /**
   * Create a new document
   * POST /api/workspaces/:id/documents
   */
  static create = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.workspaceId) {
      throw new Error('Workspace context required');
    }

    const document = await DocumentService.createDocument(
      req.workspaceId,
      req.body,
      req.user!.userId
    );

    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Document created successfully',
      data: document,
    });
  });

  /**
   * Get document by ID
   * GET /api/documents/:id
   */
  static getById = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    const document = await DocumentService.getDocumentById(id, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Document retrieved successfully',
      data: document,
    });
  });

  /**
   * Get all documents in workspace
   * GET /api/workspaces/:id/documents
   */
  static getAll = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.workspaceId || !req.user) {
      throw new Error('Workspace context and authentication required');
    }

    const { page, limit, search, type, status, ingestionStatus } = req.query;

    const result = await DocumentService.getDocuments(
      req.workspaceId,
      req.user.userId,
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string | undefined,
        type: type as any,
        status: status as any,
        ingestionStatus: ingestionStatus as any,
      }
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Documents retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  });

  /**
   * Update document
   * PATCH /api/documents/:id
   */
  static update = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    const document = await DocumentService.updateDocument(id, req.body, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Document updated successfully',
      data: document,
    });
  });

  /**
   * Delete document
   * DELETE /api/documents/:id
   */
  static delete = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    await DocumentService.deleteDocument(id, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Document deleted successfully',
      data: null,
    });
  });

  /**
   * Re-index document
   * POST /api/documents/:id/reindex
   */
  static reindex = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { id } = req.params;
    const document = await DocumentService.reindexDocument(id, req.user.userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Document queued for re-indexing',
      data: document,
    });
  });
}
