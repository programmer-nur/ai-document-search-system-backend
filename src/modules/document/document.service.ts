import { DocumentStatus, IngestionStatus } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { createAuditLog } from '../../utils/auditLog';
import prisma from '../../utils/prisma';
import { documentIngestionQueue } from '../../queues';
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentResponse,
  DocumentQueryParams,
} from './document.types';

export class DocumentService {
  /**
   * Format document response
   */
  private static formatDocumentResponse(document: {
    id: string;
    workspaceId: string;
    name: string;
    originalName: string;
    type: any;
    mimeType: string;
    size: bigint;
    status: any;
    s3Key: string;
    s3Bucket: string;
    s3Region: string;
    s3Url: string | null;
    thumbnailUrl: string | null;
    pageCount: number | null;
    wordCount: number | null;
    language: string | null;
    metadata: any;
    ingestionStatus: any;
    ingestionStartedAt: Date | null;
    ingestionCompletedAt: Date | null;
    ingestionError: string | null;
    chunkCount: number;
    embeddingCount: number;
    qdrantCollectionId: string | null;
    uploadedAt: Date | null;
    processedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): DocumentResponse {
    return {
      id: document.id,
      workspaceId: document.workspaceId,
      name: document.name,
      originalName: document.originalName,
      type: document.type,
      mimeType: document.mimeType,
      size: document.size,
      status: document.status,
      s3Key: document.s3Key,
      s3Bucket: document.s3Bucket,
      s3Region: document.s3Region,
      s3Url: document.s3Url,
      thumbnailUrl: document.thumbnailUrl,
      pageCount: document.pageCount,
      wordCount: document.wordCount,
      language: document.language,
      metadata: document.metadata as Record<string, unknown> | null,
      ingestionStatus: document.ingestionStatus,
      ingestionStartedAt: document.ingestionStartedAt,
      ingestionCompletedAt: document.ingestionCompletedAt,
      ingestionError: document.ingestionError,
      chunkCount: document.chunkCount,
      embeddingCount: document.embeddingCount,
      qdrantCollectionId: document.qdrantCollectionId,
      uploadedAt: document.uploadedAt,
      processedAt: document.processedAt,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  /**
   * Create a new document
   */
  static async createDocument(
    workspaceId: string,
    data: CreateDocumentInput,
    userId: string
  ): Promise<DocumentResponse> {
    // Verify user is a member of the workspace
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

    // Check if S3 key already exists
    const existingDocument = await prisma.document.findUnique({
      where: { s3Key: data.s3Key },
    });

    if (existingDocument) {
      throw ApiError.conflict('Document with this S3 key already exists');
    }

    // Create document
    const document = await prisma.document.create({
      data: {
        workspaceId,
        name: data.name,
        originalName: data.originalName,
        type: data.type,
        mimeType: data.mimeType,
        size: BigInt(data.size),
        status: DocumentStatus.UPLOADED,
        s3Key: data.s3Key,
        s3Bucket: data.s3Bucket,
        s3Region: data.s3Region,
        s3Url: data.s3Url,
        thumbnailUrl: data.thumbnailUrl,
        metadata: data.metadata || {},
        ingestionStatus: IngestionStatus.PENDING,
        uploadedAt: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      workspaceId,
      userId,
      action: 'document.create',
      resourceType: 'document',
      resourceId: document.id,
      details: {
        name: document.name,
        type: document.type,
        size: data.size,
      },
    });

    // Queue document for ingestion
    await documentIngestionQueue.add(
      'ingest-document',
      {
        documentId: document.id,
        workspaceId,
        s3Key: data.s3Key,
        s3Bucket: data.s3Bucket,
        s3Region: data.s3Region,
        documentType: data.type,
      },
      {
        jobId: document.id, // Use document ID as job ID for idempotency
        priority: 1,
      }
    );

    logger.info('Document created and queued for ingestion', {
      documentId: document.id,
      workspaceId,
      userId,
    });

    return this.formatDocumentResponse(document);
  }

  /**
   * Get document by ID
   */
  static async getDocumentById(id: string, userId: string): Promise<DocumentResponse> {
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!document || document.deletedAt) {
      throw ApiError.notFound('Document not found');
    }

    // Verify user is a member of the workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: document.workspaceId,
        userId,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of this workspace');
    }

    return this.formatDocumentResponse(document);
  }

  /**
   * Get all documents in a workspace
   */
  static async getDocuments(
    workspaceId: string,
    userId: string,
    params: DocumentQueryParams
  ) {
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

    const { page = 1, limit = 10, search, type, status, ingestionStatus } = params;
    const skip = (page - 1) * limit;

    // Build filter
    const where: {
      workspaceId: string;
      deletedAt?: null;
      name?: { contains: string; mode: 'insensitive' };
      type?: any;
      status?: any;
      ingestionStatus?: any;
    } = {
      workspaceId,
      deletedAt: null,
    };

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (ingestionStatus) {
      where.ingestionStatus = ingestionStatus;
    }

    // Get documents and total count
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.count({ where }),
    ]);

    return {
      data: documents.map(doc => this.formatDocumentResponse(doc)),
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
   * Update document
   */
  static async updateDocument(
    id: string,
    data: UpdateDocumentInput,
    userId: string
  ): Promise<DocumentResponse> {
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.deletedAt) {
      throw ApiError.notFound('Document not found');
    }

    // Verify user is a member
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: document.workspaceId,
        userId,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of this workspace');
    }

    // Update document
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        name: data.name,
        ...(data.metadata && { metadata: data.metadata }),
      },
    });

    // Create audit log
    await createAuditLog({
      workspaceId: document.workspaceId,
      userId,
      action: 'document.update',
      resourceType: 'document',
      resourceId: id,
      details: { updatedFields: Object.keys(data) },
    });

    logger.info('Document updated', { documentId: id, userId });

    return this.formatDocumentResponse(updatedDocument);
  }

  /**
   * Delete document (soft delete)
   */
  static async deleteDocument(id: string, userId: string): Promise<void> {
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.deletedAt) {
      throw ApiError.notFound('Document not found');
    }

    // Verify user is a member
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: document.workspaceId,
        userId,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of this workspace');
    }

    // Soft delete
    await prisma.document.update({
      where: { id },
      data: { deletedAt: new Date(), status: DocumentStatus.DELETED },
    });

    // Create audit log
    await createAuditLog({
      workspaceId: document.workspaceId,
      userId,
      action: 'document.delete',
      resourceType: 'document',
      resourceId: id,
    });

    logger.info('Document deleted', { documentId: id, userId });
  }

  /**
   * Update document ingestion status
   * This is typically called by background workers
   */
  static async updateIngestionStatus(
    id: string,
    status: IngestionStatus,
    error?: string,
    metadata?: {
      chunkCount?: number;
      embeddingCount?: number;
      qdrantCollectionId?: string;
      pageCount?: number;
      wordCount?: number;
    }
  ): Promise<DocumentResponse> {
    const updateData: any = {
      ingestionStatus: status,
    };

    if (status === IngestionStatus.PARSING) {
      updateData.ingestionStartedAt = new Date();
    }

    if (status === IngestionStatus.COMPLETED) {
      updateData.ingestionCompletedAt = new Date();
      updateData.processedAt = new Date();
      updateData.status = DocumentStatus.PROCESSED;
    }

    if (status === IngestionStatus.FAILED) {
      updateData.ingestionError = error;
      updateData.status = DocumentStatus.FAILED;
    }

    if (metadata) {
      if (metadata.chunkCount !== undefined) {
        updateData.chunkCount = metadata.chunkCount;
      }
      if (metadata.embeddingCount !== undefined) {
        updateData.embeddingCount = metadata.embeddingCount;
      }
      if (metadata.qdrantCollectionId !== undefined) {
        updateData.qdrantCollectionId = metadata.qdrantCollectionId;
      }
      if (metadata.pageCount !== undefined) {
        updateData.pageCount = metadata.pageCount;
      }
      if (metadata.wordCount !== undefined) {
        updateData.wordCount = metadata.wordCount;
      }
    }

    const document = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    logger.info('Document ingestion status updated', {
      documentId: id,
      status,
    });

    return this.formatDocumentResponse(document);
  }
}

