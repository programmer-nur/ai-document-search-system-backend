import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

// Create Redis connection
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  logger.info('Redis connected', { host: env.REDIS_HOST, port: env.REDIS_PORT });
});

redis.on('error', (error) => {
  logger.error('Redis connection error', { error: error.message });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

export default redis;

