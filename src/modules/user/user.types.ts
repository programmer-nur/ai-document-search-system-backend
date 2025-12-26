import { UserRole } from '@prisma/client';

export type UpdateUserInput = {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isActive?: boolean;
};

export type UserResponse = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
};

