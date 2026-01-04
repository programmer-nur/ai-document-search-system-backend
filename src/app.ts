import express from 'express';
import cors from 'cors';
import { getLogger, errorHandler, notFoundHandler } from './middlewares';
import { env } from './config/env';

const app = express();

// Trust proxy (for production behind reverse proxy)
app.set('trust proxy', 1);

// CORS
app.use(cors());

// Body parser (increased limit for file uploads)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Logging
app.use(getLogger());

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    // Check database connection
    const prisma = (await import('./utils/prisma')).default;
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'connected';
  } catch (error) {
    health.services.database = 'disconnected';
    health.status = 'degraded';
  }

  try {
    // Check Redis connection
    const redis = (await import('./config/redis')).default;
    await redis.ping();
    health.services.redis = 'connected';
  } catch (error) {
    health.services.redis = 'disconnected';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API routes
import router from './router';
app.use('/api', router);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;
