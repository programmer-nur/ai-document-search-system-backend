import { WorkspaceRole } from '@prisma/client';

export type CreateWorkspaceInput = {
  name: string;
  slug?: string;
  description?: string;
  logo?: string;
  settings?: Record<string, unknown>;
};

export type UpdateWorkspaceInput = {
  name?: string;
  description?: string;
  logo?: string;
  isActive?: boolean;
  settings?: Record<string, unknown>;
};

export type WorkspaceResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  isActive: boolean;
  settings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceMemberInput = {
  userId: string;
  role: WorkspaceRole;
};

export type WorkspaceMemberResponse = {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
  };
  joinedAt: Date;
  createdAt: Date;
};

export type WorkspaceQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};

