import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/apiError';

// Initialize Qdrant client
const qdrantClient = new QdrantClient({
  url: env.QDRANT_URL,
  apiKey: env.QDRANT_API_KEY || undefined,
});

export class QdrantService {
  /**
   * Create or get collection for a workspace
   */
  static async getOrCreateCollection(workspaceId: string): Promise<string> {
    const collectionName = `workspace_${workspaceId}`;

    try {
      // Check if collection exists
      const collections = await qdrantClient.getCollections();
      const exists = collections.collections.some(col => col.name === collectionName);

      if (exists) {
        logger.info('Collection already exists', { collectionName });
        return collectionName;
      }

      // Create collection
      await qdrantClient.createCollection(collectionName, {
        vectors: {
          size: 1536, // OpenAI text-embedding-3-small dimension
          distance: 'Cosine',
        },
      });

      logger.info('Collection created', { collectionName });

      return collectionName;
    } catch (error) {
      logger.error('Failed to create collection', { error, collectionName });
      throw ApiError.internal('Failed to create vector collection');
    }
  }

  /**
   * Upsert vectors (points) to collection
   */
  static async upsertVectors(
    collectionName: string,
    points: Array<{
      id: string;
      vector: number[];
      payload: Record<string, unknown>;
    }>
  ): Promise<void> {
    try {
      await qdrantClient.upsert(collectionName, {
        wait: true,
        points,
      });

      logger.info('Vectors upserted', {
        collectionName,
        count: points.length,
      });
    } catch (error) {
      logger.error('Failed to upsert vectors', { error, collectionName });
      throw ApiError.internal('Failed to store vectors');
    }
  }

  /**
   * Search vectors (semantic search)
   */
  static async searchVectors(
    collectionName: string,
    queryVector: number[],
    limit: number = 10,
    filter?: Record<string, unknown>
  ): Promise<
    Array<{
      id: string;
      score: number;
      payload: Record<string, unknown>;
    }>
  > {
    try {
      const result = await qdrantClient.search(collectionName, {
        vector: queryVector,
        limit,
        filter,
        with_payload: true,
      });

      return result.map(hit => ({
        id: hit.id as string,
        score: hit.score || 0,
        payload: (hit.payload || {}) as Record<string, unknown>,
      }));
    } catch (error) {
      logger.error('Failed to search vectors', { error, collectionName });
      throw ApiError.internal('Failed to perform vector search');
    }
  }

  /**
   * Delete vectors by IDs
   */
  static async deleteVectors(collectionName: string, pointIds: string[]): Promise<void> {
    try {
      await qdrantClient.delete(collectionName, {
        wait: true,
        points: pointIds,
      });

      logger.info('Vectors deleted', {
        collectionName,
        count: pointIds.length,
      });
    } catch (error) {
      logger.error('Failed to delete vectors', { error, collectionName });
      throw ApiError.internal('Failed to delete vectors');
    }
  }

  /**
   * Delete collection
   */
  static async deleteCollection(collectionName: string): Promise<void> {
    try {
      await qdrantClient.deleteCollection(collectionName);
      logger.info('Collection deleted', { collectionName });
    } catch (error) {
      logger.error('Failed to delete collection', { error, collectionName });
      throw ApiError.internal('Failed to delete collection');
    }
  }

  /**
   * Get collection info
   */
  static async getCollectionInfo(collectionName: string): Promise<{
    pointsCount: number;
    vectorsCount: number;
  }> {
    try {
      const info = await qdrantClient.getCollection(collectionName);
      return {
        pointsCount: info.points_count || 0,
        vectorsCount: info.indexed_vectors_count || info.points_count || 0,
      };
    } catch (error) {
      logger.error('Failed to get collection info', { error, collectionName });
      throw ApiError.internal('Failed to get collection info');
    }
  }
}

export default qdrantClient;
