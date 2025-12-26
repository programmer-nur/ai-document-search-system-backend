import AWS from 'aws-sdk';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/apiError';

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  region: env.AWS_REGION,
});

export class S3Service {
  /**
   * Generate pre-signed URL for file upload
   */
  static async getUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const params = {
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        ContentType: contentType,
        Expires: expiresIn,
      };

      const url = await s3.getSignedUrlPromise('putObject', params);

      logger.info('Pre-signed upload URL generated', { key, contentType });

      return url;
    } catch (error) {
      logger.error('Failed to generate upload URL', { error, key });
      throw ApiError.internal('Failed to generate upload URL');
    }
  }

  /**
   * Generate pre-signed URL for file download
   */
  static async getDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const params = {
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Expires: expiresIn,
      };

      const url = await s3.getSignedUrlPromise('getObject', params);

      logger.info('Pre-signed download URL generated', { key });

      return url;
    } catch (error) {
      logger.error('Failed to generate download URL', { error, key });
      throw ApiError.internal('Failed to generate download URL');
    }
  }

  /**
   * Download file from S3
   */
  static async downloadFile(key: string): Promise<Buffer> {
    try {
      const params = {
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
      };

      const data = await s3.getObject(params).promise();

      if (!data.Body) {
        throw ApiError.notFound('File not found in S3');
      }

      logger.info('File downloaded from S3', { key, size: data.ContentLength });

      return data.Body as Buffer;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to download file from S3', { error, key });
      throw ApiError.internal('Failed to download file');
    }
  }

  /**
   * Delete file from S3
   */
  static async deleteFile(key: string): Promise<void> {
    try {
      const params = {
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
      };

      await s3.deleteObject(params).promise();

      logger.info('File deleted from S3', { key });
    } catch (error) {
      logger.error('Failed to delete file from S3', { error, key });
      throw ApiError.internal('Failed to delete file');
    }
  }

  /**
   * Check if file exists in S3
   */
  static async fileExists(key: string): Promise<boolean> {
    try {
      const params = {
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
      };

      await s3.headObject(params).promise();
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound' || error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
  }> {
    try {
      const params = {
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
      };

      const data = await s3.headObject(params).promise();

      return {
        size: data.ContentLength || 0,
        contentType: data.ContentType || 'application/octet-stream',
        lastModified: data.LastModified || new Date(),
      };
    } catch (error) {
      logger.error('Failed to get file metadata', { error, key });
      throw ApiError.internal('Failed to get file metadata');
    }
  }
}

