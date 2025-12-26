import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import redis from '../config/redis';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/', async (req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'connected';
  } catch (error) {
    health.services.database = 'disconnected';
    health.status = 'degraded';
    logger.error('Database health check failed', { error });
  }

  try {
    // Check Redis connection
    await redis.ping();
    health.services.redis = 'connected';
  } catch (error) {
    health.services.redis = 'disconnected';
    health.status = 'degraded';
    logger.error('Redis health check failed', { error });
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
