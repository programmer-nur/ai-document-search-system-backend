import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DocumentService } from './document.service';
import { S3Service } from '../../services/s3.service';
import { catchAsync, sendResponse } from '../../utils';
import { WorkspaceRequest } from '../../middlewares/workspace';
import { DocumentType } from '@prisma/client';
import { ApiError } from '../../utils/apiError';

export class DocumentController {
  /**
   * Get pre-signed URL for file upload (kept for backward compatibility)
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
   * Helper function to determine document type from file
   */
  private static getDocumentType(file: Express.Multer.File): DocumentType {
    const extension = file.originalname.split('.').pop()?.toLowerCase() || '';
    const mimeType = file.mimetype.toLowerCase();

    // Map extensions to document types
    const extensionMap: Record<string, DocumentType> = {
      pdf: DocumentType.PDF,
      docx: DocumentType.DOCX,
      doc: DocumentType.DOC,
      xlsx: DocumentType.XLSX,
      xls: DocumentType.XLS,
      pptx: DocumentType.PPTX,
      ppt: DocumentType.PPT,
      txt: DocumentType.TXT,
      md: DocumentType.MD,
      csv: DocumentType.CSV,
    };

    if (extensionMap[extension]) {
      return extensionMap[extension];
    }

    // Fallback to MIME type mapping
    const mimeTypeMap: Record<string, DocumentType> = {
      'application/pdf': DocumentType.PDF,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocumentType.DOCX,
      'application/msword': DocumentType.DOC,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': DocumentType.XLSX,
      'application/vnd.ms-excel': DocumentType.XLS,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        DocumentType.PPTX,
      'application/vnd.ms-powerpoint': DocumentType.PPT,
      'text/plain': DocumentType.TXT,
      'text/markdown': DocumentType.MD,
      'text/csv': DocumentType.CSV,
    };

    return mimeTypeMap[mimeType] || DocumentType.OTHER;
  }

  /**
   * Upload document file and create document record
   * POST /api/workspaces/:id/documents/upload
   */
  static upload = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.workspaceId || !req.user) {
      throw ApiError.badRequest('Workspace context and authentication required');
    }

    const file = req.file as Express.Multer.File & { location?: string; key?: string };
    if (!file) {
      throw ApiError.badRequest('File is required');
    }

    // Get S3 key from file (set by multer-s3)
    // multer-s3 adds 'key' property to the file object
    const s3Key = (file as any).key || file.location?.split('/').slice(-1)[0];
    if (!s3Key) {
      throw ApiError.internal('Failed to get S3 key from uploaded file');
    }

    // Determine document type
    const documentType = this.getDocumentType(file);

    // Generate S3 URL (pre-signed download URL)
    const s3Url = await S3Service.getDownloadUrl(s3Key, 3600 * 24 * 7); // 7 days

    // Create document record
    const document = await DocumentService.createDocument(
      req.workspaceId,
      {
        name: file.originalname,
        originalName: file.originalname,
        type: documentType,
        mimeType: file.mimetype,
        size: file.size,
        s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET || '',
        s3Region: process.env.AWS_REGION || 'us-east-1',
        s3Url,
      },
      req.user.userId
    );

    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Document uploaded successfully',
      data: document,
    });
  });

  /**
   * Upload multiple document files and create document records
   * POST /api/workspaces/:id/documents/upload-multiple
   */
  static uploadMultiple = catchAsync(async (req: WorkspaceRequest, res: Response) => {
    if (!req.workspaceId || !req.user) {
      throw ApiError.badRequest('Workspace context and authentication required');
    }

    const files = req.files as Express.Multer.File[] & Array<{ location?: string; key?: string }>;
    if (!files || files.length === 0) {
      throw ApiError.badRequest('At least one file is required');
    }

    const documents = [];

    for (const file of files) {
      // Get S3 key from file (set by multer-s3)
      // multer-s3 adds 'key' property to the file object
      const s3Key = (file as any).key || file.location?.split('/').slice(-1)[0];
      if (!s3Key) {
        continue; // Skip files without S3 key
      }

      // Determine document type
      const documentType = this.getDocumentType(file);

      // Generate S3 URL (pre-signed download URL)
      const s3Url = await S3Service.getDownloadUrl(s3Key, 3600 * 24 * 7); // 7 days

      // Create document record
      const document = await DocumentService.createDocument(
        req.workspaceId,
        {
          name: file.originalname,
          originalName: file.originalname,
          type: documentType,
          mimeType: file.mimetype,
          size: file.size,
          s3Key,
          s3Bucket: process.env.AWS_S3_BUCKET || '',
          s3Region: process.env.AWS_REGION || 'us-east-1',
          s3Url,
        },
        req.user.userId
      );

      documents.push(document);
    }

    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: `${documents.length} document(s) uploaded successfully`,
      data: documents,
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

    const result = await DocumentService.getDocuments(req.workspaceId, req.user.userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search as string | undefined,
      type: type as any,
      status: status as any,
      ingestionStatus: ingestionStatus as any,
    });

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
