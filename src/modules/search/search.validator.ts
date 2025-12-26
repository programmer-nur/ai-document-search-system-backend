import { z } from 'zod';
import { QueryType } from '@prisma/client';

export const searchSchema = z.object({
  body: z.object({
    query: z.string().min(1, 'Query is required').max(1000, 'Query must be less than 1000 characters'),
    limit: z.number().int().min(1).max(100).optional(),
    documentIds: z.array(z.string().cuid()).optional(),
  }),
});

export const questionSchema = z.object({
  body: z.object({
    question: z.string().min(1, 'Question is required').max(1000, 'Question must be less than 1000 characters'),
    limit: z.number().int().min(1).max(50).optional(),
    documentIds: z.array(z.string().cuid()).optional(),
    model: z.string().optional(),
  }),
});

export const getQueryHistorySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    type: z.nativeEnum(QueryType).optional(),
  }),
});

export type SearchInput = z.infer<typeof searchSchema>['body'];
export type QuestionInput = z.infer<typeof questionSchema>['body'];
export type GetQueryHistoryQuery = z.infer<typeof getQueryHistorySchema>['query'];

