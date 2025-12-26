import { z } from 'zod';
import { WorkspaceRole } from '@prisma/client';

export const createWorkspaceSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .min(3, 'Slug must be at least 3 characters')
      .max(50, 'Slug must be less than 50 characters')
      .optional(),
    description: z.string().max(500, 'Description must be less than 500 characters').optional(),
    logo: z.string().url('Invalid logo URL').optional(),
    settings: z.record(z.unknown()).optional(),
  }),
});

export const updateWorkspaceSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    logo: z.string().url().optional(),
    isActive: z.boolean().optional(),
    settings: z.record(z.unknown()).optional(),
  }),
  params: z.object({
    id: z.string().cuid('Invalid workspace ID'),
  }),
});

export const getWorkspaceSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid workspace ID'),
  }),
});

export const getWorkspacesSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().optional(),
    isActive: z.string().transform(val => val === 'true').optional(),
  }),
});

export const addMemberSchema = z.object({
  body: z.object({
    userId: z.string().cuid('Invalid user ID'),
    role: z.nativeEnum(WorkspaceRole),
  }),
  params: z.object({
    id: z.string().cuid('Invalid workspace ID'),
  }),
});

export const updateMemberSchema = z.object({
  body: z.object({
    role: z.nativeEnum(WorkspaceRole),
  }),
  params: z.object({
    id: z.string().cuid('Invalid workspace ID'),
    memberId: z.string().cuid('Invalid member ID'),
  }),
});

export const removeMemberSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid workspace ID'),
    memberId: z.string().cuid('Invalid member ID'),
  }),
});

export const deleteWorkspaceSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid workspace ID'),
  }),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>['body'];
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>['body'];
export type GetWorkspacesQuery = z.infer<typeof getWorkspacesSchema>['query'];

