import { DocumentType, DocumentStatus, IngestionStatus } from '@prisma/client';

export type CreateDocumentInput = {
  name: string;
  originalName: string;
  type: DocumentType;
  mimeType: string;
  size: number;
  s3Key: string;
  s3Bucket: string;
  s3Region: string;
  s3Url?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateDocumentInput = {
  name?: string;
  metadata?: Record<string, unknown>;
};

export type DocumentResponse = {
  id: string;
  workspaceId: string;
  name: string;
  originalName: string;
  type: DocumentType;
  mimeType: string;
  size: string;
  status: DocumentStatus;
  s3Key: string;
  s3Bucket: string;
  s3Region: string;
  s3Url: string | null;
  thumbnailUrl: string | null;
  pageCount: number | null;
  wordCount: number | null;
  language: string | null;
  metadata: Record<string, unknown> | null;
  ingestionStatus: IngestionStatus;
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
};

export type DocumentQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  ingestionStatus?: IngestionStatus;
};
