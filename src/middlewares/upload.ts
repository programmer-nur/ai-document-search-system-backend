import multer from 'multer';
import multerS3 from 'multer-s3';
import AWS from 'aws-sdk';
import { Request } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/apiError';
import { WorkspaceRequest } from './workspace';

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  region: env.AWS_REGION,
});

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-powerpoint', // .ppt
  'text/plain', // .txt
  'text/markdown', // .md
  'text/csv', // .csv
];

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * File filter function
 */
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `File type not allowed. Allowed types: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, TXT, MD, CSV`
      )
    );
  }
};

/**
 * Generate S3 key for uploaded file
 */
const getS3Key = (req: WorkspaceRequest, file: Express.Multer.File): string => {
  const workspaceId = req.workspaceId || req.params.id;
  if (!workspaceId) {
    throw ApiError.badRequest('Workspace ID is required');
  }

  const timestamp = Date.now();
  const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `workspaces/${workspaceId}/documents/${timestamp}-${sanitizedFileName}`;
};

/**
 * Multer configuration for S3 storage
 */
const s3Storage = multerS3({
  s3: s3 as any, // Type compatibility with multer-s3
  bucket: env.AWS_S3_BUCKET,
  acl: 'private', // Private files, access via pre-signed URLs
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req: WorkspaceRequest, file: Express.Multer.File, cb) => {
    try {
      const key = getS3Key(req, file);
      cb(null, key);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  metadata: (req: WorkspaceRequest, file: Express.Multer.File, cb) => {
    cb(null, {
      originalName: file.originalname,
      uploadedBy: req.user?.userId || 'unknown',
      workspaceId: req.workspaceId || req.params.id,
    });
  },
});

/**
 * Multer upload middleware for single file
 */
export const uploadSingle = multer({
  storage: s3Storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
}).single('file');

/**
 * Multer upload middleware for multiple files
 */
export const uploadMultiple = multer({
  storage: s3Storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Max 10 files at once
  },
}).array('files', 10);

/**
 * Error handler for multer errors
 */
export const handleUploadError = (error: any, req: Request, res: any, next: any): void => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      throw ApiError.badRequest(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      throw ApiError.badRequest('Too many files. Maximum 10 files allowed');
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      throw ApiError.badRequest('Unexpected file field');
    }
    throw ApiError.badRequest(`Upload error: ${error.message}`);
  }
  if (error) {
    throw error;
  }
  next();
};
