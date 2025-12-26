import express from 'express';
import cors from 'cors';
import { getLogger, errorHandler, notFoundHandler } from './middlewares';
import { env } from './config/env';

const app = express();

// Trust proxy (for production behind reverse proxy)
app.set('trust proxy', 1);

// CORS
app.use(cors());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(getLogger());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// API routes
import router from './router';
app.use('/api', router);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;
