/**
 * Worker entry point
 * Start this file separately to run background workers
 * Usage: ts-node src/workers/worker.ts
 */

import { documentIngestionWorker } from './documentIngestion.worker';
import { logger } from '../utils/logger';

logger.info('🚀 Starting background workers...');
logger.info('📦 Document ingestion worker started');

// Keep process alive
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down workers...');
  await documentIngestionWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down workers...');
  await documentIngestionWorker.close();
  process.exit(0);
});

