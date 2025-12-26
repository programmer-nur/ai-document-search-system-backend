import { QueryType } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { createAuditLog } from '../../utils/auditLog';
import prisma from '../../utils/prisma';
import { QdrantService } from '../../services/qdrant.service';
import { OpenAIService } from '../../services/openai.service';
import type {
  SearchInput,
  QuestionInput,
  SearchResponse,
  QuestionResponse,
  SearchResult,
  QueryHistoryParams,
} from './search.types';

export class SearchService {
  /**
   * Perform hybrid search (vector + keyword)
   * This is a placeholder - actual implementation will integrate with Qdrant and BM25
   */
  static async search(
    workspaceId: string,
    userId: string | undefined,
    data: SearchInput
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    // Verify user is a member of the workspace
    if (userId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId,
          deletedAt: null,
        },
      });

      if (!membership) {
        throw ApiError.forbidden('You are not a member of this workspace');
      }
    }

    // Build document filter
    const documentWhere: {
      workspaceId: string;
      deletedAt?: null;
      status?: any;
      id?: { in: string[] };
    } = {
      workspaceId,
      deletedAt: null,
      status: 'PROCESSED', // Only search in processed documents
    };

    if (data.documentIds && data.documentIds.length > 0) {
      documentWhere.id = { in: data.documentIds };
    }

    // Get documents that are processed and have chunks
    const documents = await prisma.document.findMany({
      where: documentWhere,
      select: {
        id: true,
        name: true,
      },
    });

    if (documents.length === 0) {
      return {
        results: [],
        total: 0,
        query: data.query,
        metadata: {
          searchTime: Date.now() - startTime,
        },
      };
    }

    const documentIds = documents.map(doc => doc.id);

    // Hybrid search: Vector + Keyword
    const limit = data.limit || 10;
    const collectionName = `workspace_${workspaceId}`;

    // 1. Vector search via Qdrant
    let vectorResults: SearchResult[] = [];
    try {
      const queryEmbedding = await OpenAIService.generateEmbedding(data.query);
      const qdrantResults = await QdrantService.searchVectors(
        collectionName,
        queryEmbedding,
        limit * 2, // Get more results for ranking
        data.documentIds
          ? {
              must: [
                {
                  key: 'documentId',
                  match: { value: data.documentIds },
                },
              ],
            }
          : undefined
      );

      // Get chunk details from database
      const chunkIds = qdrantResults.map((r) => r.id);
      const chunks = await prisma.chunk.findMany({
        where: {
          id: { in: chunkIds },
          deletedAt: null,
        },
        include: {
          document: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      vectorResults = qdrantResults
        .map((qdrantResult) => {
          const chunk = chunks.find((c) => c.id === qdrantResult.id);
          if (!chunk) return null;

          return {
            chunkId: chunk.id,
            documentId: chunk.document.id,
            documentName: chunk.document.name,
            content: chunk.content.substring(0, 500),
            score: qdrantResult.score,
            pageNumber: chunk.pageNumber || undefined,
            sectionTitle: chunk.sectionTitle || undefined,
            metadata: chunk.metadata as Record<string, unknown> | undefined,
          };
        })
        .filter((r): r is SearchResult => r !== null);
    } catch (error) {
      logger.warn('Vector search failed, falling back to keyword search', { error });
    }

    // 2. Keyword search (BM25-like via PostgreSQL)
    const keywordChunks = await prisma.chunk.findMany({
      where: {
        documentId: { in: documentIds },
        hasEmbedding: true,
        deletedAt: null,
        content: {
          contains: data.query,
          mode: 'insensitive',
        },
      },
      take: limit,
      include: {
        document: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const keywordResults: SearchResult[] = keywordChunks.map((chunk, index) => ({
      chunkId: chunk.id,
      documentId: chunk.document.id,
      documentName: chunk.document.name,
      content: chunk.content.substring(0, 500),
      score: 0.5 - index * 0.05, // Lower base score for keyword results
      pageNumber: chunk.pageNumber || undefined,
      sectionTitle: chunk.sectionTitle || undefined,
      metadata: chunk.metadata as Record<string, unknown> | undefined,
    }));

    // 3. Combine results using RRF (Reciprocal Rank Fusion)
    const combinedResults = this.combineSearchResults(vectorResults, keywordResults, limit);

    const results = combinedResults;

    // Save query to history
    if (userId) {
      await prisma.query.create({
        data: {
          workspaceId,
          userId,
          type: QueryType.SEARCH,
          query: data.query,
          resultCount: results.length,
          topChunkIds: results.map(r => r.chunkId),
          topDocumentIds: Array.from(new Set(results.map(r => r.documentId))),
          metadata: {
            searchType: 'hybrid',
            limit: data.limit || 10,
          },
        },
      });
    }

    const searchTime = Date.now() - startTime;

    logger.info('Search performed', {
      workspaceId,
      userId,
      query: data.query,
      resultCount: results.length,
      searchTime,
    });

    return {
      results,
      total: results.length,
      query: data.query,
      metadata: {
        searchTime,
      },
    };
  }

  /**
   * Ask a question and get AI-generated answer
   * This is a placeholder - actual implementation will use OpenAI
   */
  static async askQuestion(
    workspaceId: string,
    userId: string | undefined,
    data: QuestionInput
  ): Promise<QuestionResponse> {
    const startTime = Date.now();

    // Verify user is a member of the workspace
    if (userId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId,
          deletedAt: null,
        },
      });

      if (!membership) {
        throw ApiError.forbidden('You are not a member of this workspace');
      }
    }

    // First, perform search to get relevant context
    const searchResults = await this.search(
      workspaceId,
      userId,
      {
        query: data.question,
        limit: data.limit || 5,
        documentIds: data.documentIds,
      }
    );

    if (searchResults.results.length === 0) {
      // Save query even if no results
      if (userId) {
        await prisma.query.create({
          data: {
            workspaceId,
            userId,
            type: QueryType.QUESTION,
            query: data.question,
            resultCount: 0,
            aiResponse: 'I could not find any relevant information to answer your question.',
            aiModel: data.model || 'gpt-3.5-turbo',
            metadata: {
              noResults: true,
            },
          },
        });
      }

      return {
        answer: 'I could not find any relevant information to answer your question.',
        sources: [],
        query: data.question,
        metadata: {
          model: data.model || 'gpt-3.5-turbo',
          responseTime: Date.now() - startTime,
        },
      };
    }

    // Generate AI answer using OpenAI
    const context = searchResults.results
      .map((r, index) => `[Source ${index + 1}: ${r.documentName}${r.pageNumber ? `, Page ${r.pageNumber}` : ''}]\n${r.content}`)
      .join('\n\n');

    const aiResponse = await OpenAIService.generateAnswer(
      data.question,
      context,
      data.model || 'gpt-3.5-turbo'
    );

    const answer = aiResponse.answer;

    // Format sources
    const sources = searchResults.results.map(result => ({
      chunkId: result.chunkId,
      documentId: result.documentId,
      documentName: result.documentName,
      content: result.content,
      pageNumber: result.pageNumber,
    }));

    const responseTime = Date.now() - startTime;

    // Save query to history
    if (userId) {
      await prisma.query.create({
        data: {
          workspaceId,
          userId,
          type: QueryType.QUESTION,
          query: data.question,
          resultCount: sources.length,
          topChunkIds: sources.map(s => s.chunkId),
          topDocumentIds: Array.from(new Set(sources.map(s => s.documentId))),
          aiResponse: answer,
          aiModel: data.model || 'gpt-3.5-turbo',
          tokensUsed: aiResponse.tokensUsed,
          responseTime,
          metadata: {
            searchTime: searchResults.metadata?.searchTime,
          },
        },
      });
    }

    logger.info('Question answered', {
      workspaceId,
      userId,
      question: data.question,
      sourcesCount: sources.length,
      responseTime,
    });

    return {
      answer,
      sources,
      query: data.question,
      metadata: {
        model: data.model || 'gpt-3.5-turbo',
        tokensUsed: aiResponse.tokensUsed,
        responseTime,
        searchTime: searchResults.metadata?.searchTime,
      },
    };
  }

  /**
   * Get query history for a workspace
   */
  static async getQueryHistory(
    workspaceId: string,
    userId: string,
    params: QueryHistoryParams
  ) {
    // Verify user is a member
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of this workspace');
    }

    const { page = 1, limit = 20, type } = params;
    const skip = (page - 1) * limit;

    const where: {
      workspaceId: string;
      userId?: string;
      type?: QueryType;
    } = {
      workspaceId,
      userId, // Only show user's own queries
    };

    if (type) {
      where.type = type;
    }

    const [queries, total] = await Promise.all([
      prisma.query.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          query: true,
          resultCount: true,
          aiResponse: true,
          aiModel: true,
          tokensUsed: true,
          responseTime: true,
          createdAt: true,
        },
      }),
      prisma.query.count({ where }),
    ]);

    return {
      data: queries,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Combine search results using Reciprocal Rank Fusion (RRF)
   */
  private static combineSearchResults(
    vectorResults: SearchResult[],
    keywordResults: SearchResult[],
    limit: number
  ): SearchResult[] {
    const k = 60; // RRF constant
    const scoreMap = new Map<string, { result: SearchResult; rrfScore: number }>();

    // Calculate RRF scores for vector results
    vectorResults.forEach((result, index) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = scoreMap.get(result.chunkId);
      if (existing) {
        existing.rrfScore += rrfScore;
      } else {
        scoreMap.set(result.chunkId, { result, rrfScore });
      }
    });

    // Calculate RRF scores for keyword results
    keywordResults.forEach((result, index) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = scoreMap.get(result.chunkId);
      if (existing) {
        existing.rrfScore += rrfScore;
      } else {
        scoreMap.set(result.chunkId, { result, rrfScore });
      }
    });

    // Sort by RRF score and return top results
    return Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit)
      .map((item) => ({
        ...item.result,
        score: item.rrfScore, // Use RRF score as final score
      }));
  }
}

