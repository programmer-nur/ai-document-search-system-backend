import app from './app';
import { env } from './config/env';
import { validateEnv } from './config/validateEnv';
import { logger } from './utils/logger';

// Validate environment variables on startup
try {
  validateEnv();
} catch (error) {
  logger.error('Environment validation failed', { error });
  process.exit(1);
}

const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${env.NODE_ENV}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
});
