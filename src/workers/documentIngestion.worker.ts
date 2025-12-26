import { Worker, Job } from 'bullmq';
import { env } from '../config/env';
import redis from '../config/redis';
import { DocumentIngestionJobData } from '../queues/documentIngestion.queue';
import { DocumentService } from '../modules/document/document.service';
import { IngestionStatus } from '@prisma/client';
import { S3Service } from '../services/s3.service';
import { FileParser } from '../utils/fileParser';
import { chunkText } from '../utils/chunking';
import { OpenAIService } from '../services/openai.service';
import { QdrantService } from '../services/qdrant.service';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';

/**
 * Document Ingestion Worker
 * Processes documents asynchronously:
 * 1. Download from S3
 * 2. Parse file
 * 3. Chunk text
 * 4. Generate embeddings
 * 5. Store in Qdrant
 * 6. Update database
 */
export const documentIngestionWorker = new Worker<DocumentIngestionJobData>(
  'document-ingestion',
  async (job: Job<DocumentIngestionJobData>) => {
    const { documentId, workspaceId, s3Key, s3Bucket, s3Region, documentType } = job.data;

    logger.info('Starting document ingestion', {
      jobId: job.id,
      documentId,
      workspaceId,
    });

    try {
      // Step 1: Update status to PARSING
      await DocumentService.updateIngestionStatus(
        documentId,
        IngestionStatus.PARSING
      );

      // Step 2: Download file from S3
      logger.info('Downloading file from S3', { s3Key });
      const fileBuffer = await S3Service.downloadFile(s3Key);

      // Step 3: Parse document
      logger.info('Parsing document', { documentType });
      const parsed = await FileParser.parseDocument(
        fileBuffer,
        documentType as any,
        'application/octet-stream'
      );

      // Normalize text
      const normalizedText = FileParser.normalizeText(parsed.text);

      // Step 4: Chunk text
      logger.info('Chunking text', { textLength: normalizedText.length });
      const chunks = chunkText(normalizedText, {
        maxChunkSize: 1000,
        chunkOverlap: 200,
      });

      // Step 5: Generate embeddings
      logger.info('Generating embeddings', { chunkCount: chunks.length });
      const chunkTexts = chunks.map((chunk) => chunk.text);
      const embeddings = await OpenAIService.generateEmbeddings(chunkTexts);

      // Step 6: Get or create Qdrant collection
      const collectionName = await QdrantService.getOrCreateCollection(workspaceId);

      // Step 7: Store chunks and embeddings in database and Qdrant
      logger.info('Storing chunks and vectors', { collectionName });
      const qdrantPoints = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const contentHash = crypto
          .createHash('sha256')
          .update(chunk.text)
          .digest('hex');

        // Create chunk in database
        const dbChunk = await prisma.chunk.create({
          data: {
            documentId,
            content: chunk.text,
            contentHash,
            chunkIndex: chunk.chunkIndex,
            startCharIndex: chunk.startIndex,
            endCharIndex: chunk.endIndex,
            pageNumber: parsed.metadata.pageCount
              ? Math.floor(chunk.startIndex / (normalizedText.length / parsed.metadata.pageCount))
              : null,
            hasEmbedding: true,
            embeddingModel: 'text-embedding-3-small',
            tokenCount: OpenAIService.estimateTokens(chunk.text),
            metadata: parsed.metadata,
          },
        });

        // Prepare Qdrant point
        qdrantPoints.push({
          id: dbChunk.id,
          vector: embedding,
          payload: {
            documentId,
            workspaceId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.text.substring(0, 500), // Store preview
            pageNumber: dbChunk.pageNumber,
          },
        });
      }

      // Batch upsert to Qdrant
      if (qdrantPoints.length > 0) {
        await QdrantService.upsertVectors(collectionName, qdrantPoints);
      }

      // Step 8: Update document status
      await DocumentService.updateIngestionStatus(
        documentId,
        IngestionStatus.COMPLETED,
        undefined,
        {
          chunkCount: chunks.length,
          embeddingCount: embeddings.length,
          qdrantCollectionId: collectionName,
          pageCount: parsed.metadata.pageCount,
          wordCount: parsed.metadata.wordCount || normalizedText.split(/\s+/).length,
        }
      );

      // Update document chunk and embedding counts
      await prisma.document.update({
        where: { id: documentId },
        data: {
          chunkCount: chunks.length,
          embeddingCount: embeddings.length,
          qdrantCollectionId: collectionName,
          pageCount: parsed.metadata.pageCount,
          wordCount: parsed.metadata.wordCount || normalizedText.split(/\s+/).length,
        },
      });

      logger.info('Document ingestion completed', {
        documentId,
        chunkCount: chunks.length,
        embeddingCount: embeddings.length,
      });

      return {
        success: true,
        chunkCount: chunks.length,
        embeddingCount: embeddings.length,
      };
    } catch (error) {
      logger.error('Document ingestion failed', {
        error,
        documentId,
        jobId: job.id,
      });

      // Update document status to FAILED
      await DocumentService.updateIngestionStatus(
        documentId,
        IngestionStatus.FAILED,
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  },
  {
    connection: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
    },
    concurrency: 2, // Process 2 documents at a time
    limiter: {
      max: 10, // Max 10 jobs per
      duration: 60000, // 1 minute
    },
  }
);

// Worker event listeners
documentIngestionWorker.on('completed', (job) => {
  logger.info('Document ingestion job completed', { jobId: job.id });
});

documentIngestionWorker.on('failed', (job, error) => {
  logger.error('Document ingestion job failed', {
    jobId: job?.id,
    error: error.message,
  });
});

documentIngestionWorker.on('error', (error) => {
  logger.error('Document ingestion worker error', { error: error.message });
});

export default documentIngestionWorker;

