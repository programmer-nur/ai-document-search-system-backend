import { Queue, QueueOptions } from 'bullmq';
import { env } from '../config/env';
import redis from '../config/redis';

export interface DocumentIngestionJobData {
  documentId: string;
  workspaceId: string;
  s3Key: string;
  s3Bucket: string;
  s3Region: string;
  documentType: string;
}

const queueOptions: QueueOptions = {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

export const documentIngestionQueue = new Queue<DocumentIngestionJobData>(
  'document-ingestion',
  queueOptions
);

// Queue event listeners
documentIngestionQueue.on('error', (error) => {
  console.error('Document ingestion queue error:', error);
});

export default documentIngestionQueue;

