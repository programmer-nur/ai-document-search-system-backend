import { QueryType } from '@prisma/client';

export type SearchInput = {
  query: string;
  limit?: number;
  documentIds?: string[];
};

export type QuestionInput = {
  question: string;
  limit?: number;
  documentIds?: string[];
  model?: string;
};

export type SearchResult = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  pageNumber?: number;
  sectionTitle?: string;
  metadata?: Record<string, unknown>;
};

export type SearchResponse = {
  results: SearchResult[];
  total: number;
  query: string;
  metadata?: {
    vectorResults?: number;
    keywordResults?: number;
    searchTime?: number;
  };
};

export type QuestionResponse = {
  answer: string;
  sources: Array<{
    chunkId: string;
    documentId: string;
    documentName: string;
    content: string;
    pageNumber?: number;
  }>;
  query: string;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    responseTime?: number;
    searchTime?: number;
  };
};

export type QueryHistoryParams = {
  page?: number;
  limit?: number;
  type?: QueryType;
};

