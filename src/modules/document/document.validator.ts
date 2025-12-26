import { z } from 'zod';
import { DocumentType, DocumentStatus, IngestionStatus } from '@prisma/client';

export const createDocumentSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    originalName: z.string().min(1, 'Original name is required'),
    type: z.nativeEnum(DocumentType),
    mimeType: z.string().min(1, 'MIME type is required'),
    size: z.number().int().positive('Size must be positive'),
    s3Key: z.string().min(1, 'S3 key is required'),
    s3Bucket: z.string().min(1, 'S3 bucket is required'),
    s3Region: z.string().min(1, 'S3 region is required'),
    s3Url: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const updateDocumentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  params: z.object({
    id: z.string().cuid('Invalid document ID'),
  }),
});

export const getDocumentSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid document ID'),
  }),
});

export const getDocumentsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().optional(),
    type: z.nativeEnum(DocumentType).optional(),
    status: z.nativeEnum(DocumentStatus).optional(),
    ingestionStatus: z.nativeEnum(IngestionStatus).optional(),
  }),
});

export const deleteDocumentSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid document ID'),
  }),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>['body'];
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>['body'];
export type GetDocumentsQuery = z.infer<typeof getDocumentsSchema>['query'];

