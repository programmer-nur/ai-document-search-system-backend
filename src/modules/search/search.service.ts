import { QueryType } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { createAuditLog } from '../../utils/auditLog';
import prisma from '../../utils/prisma';
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

    // TODO: Implement actual hybrid search
    // 1. Vector search via Qdrant
    // 2. Keyword search via BM25 (PostgreSQL full-text or external service)
    // 3. Combine results using RRF (Reciprocal Rank Fusion)

    // Placeholder: Simple keyword search in chunks
    const chunks = await prisma.chunk.findMany({
      where: {
        documentId: { in: documentIds },
        hasEmbedding: true,
        deletedAt: null,
        content: {
          contains: data.query,
          mode: 'insensitive',
        },
      },
      take: data.limit || 10,
      include: {
        document: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format results
    const results: SearchResult[] = chunks.map((chunk, index) => ({
      chunkId: chunk.id,
      documentId: chunk.document.id,
      documentName: chunk.document.name,
      content: chunk.content.substring(0, 500), // Limit content preview
      score: 1 - index * 0.1, // Placeholder score
      pageNumber: chunk.pageNumber || undefined,
      sectionTitle: chunk.sectionTitle || undefined,
      metadata: chunk.metadata as Record<string, unknown> | undefined,
    }));

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

    // TODO: Implement actual AI answer generation
    // 1. Assemble context from search results
    // 2. Call OpenAI API with question and context
    // 3. Generate grounded answer with citations

    // Placeholder: Simple answer generation
    const context = searchResults.results
      .map(r => `[${r.documentName}] ${r.content}`)
      .join('\n\n');

    const answer = `Based on the documents, here's what I found:\n\n${context.substring(0, 500)}...`;

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
          tokensUsed: answer.length / 4, // Rough estimate
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
        tokensUsed: Math.ceil(answer.length / 4),
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
}

