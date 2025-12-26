import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Validate required environment variables on startup
 */
export const validateEnv = (): void => {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'REDIS_HOST',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET',
    'OPENAI_API_KEY',
    'QDRANT_URL',
  ];

  const missing: string[] = [];

  for (const key of required) {
    const value = env[key as keyof typeof env];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(error);
    throw new Error(error);
  }

  // Validate JWT_SECRET strength in production
  if (env.NODE_ENV === 'production' && env.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET is too short for production. Use at least 32 characters.');
  }

  logger.info('Environment variables validated successfully');
};

