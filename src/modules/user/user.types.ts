import { UserRole } from '@prisma/client';

export type CreateUserInput = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
};

export type UpdateUserInput = {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isActive?: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
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

export type AuthResponse = {
  user: UserResponse;
  token: string;
};

export type UserQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
};

