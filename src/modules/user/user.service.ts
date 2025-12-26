import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ApiError } from '../../utils/apiError';
import { StatusCodes } from 'http-status-codes';
import { signToken } from '../../utils/jwt';
import type {
  CreateUserInput,
  UpdateUserInput,
  LoginInput,
  UserResponse,
  AuthResponse,
  UserQueryParams,
} from './user.types';
import { logger } from '../../utils/logger';
import prisma from '../../utils/prisma';

export class UserService {
  /**
   * Register a new user
   */
  static async register(data: CreateUserInput): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw ApiError.conflict('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || UserRole.USER,
      },
    });

    // Generate token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info('User registered successfully', { userId: user.id, email: user.email });

    return {
      user: this.formatUserResponse(user),
      token,
    };
  }

  /**
   * Login user
   */
  static async login(data: LoginInput): Promise<AuthResponse> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated');
    }

    // Check if user is deleted
    if (user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    return {
      user: this.formatUserResponse(user),
      token,
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    return this.formatUserResponse(user);
  }

  /**
   * Get current user profile
   */
  static async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    return this.formatUserResponse(user);
  }

  /**
   * Get all users with pagination
   */
  static async getUsers(params: UserQueryParams) {
    const { page = 1, limit = 10, search, role, isActive } = params;
    const skip = (page - 1) * limit;

    // Build filter
    const where: {
      deletedAt?: null;
      email?: { contains: string; mode: 'insensitive' };
      role?: UserRole;
      isActive?: boolean;
    } = {
      deletedAt: null,
    };

    if (search) {
      where.email = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get users and total count
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.formatUserResponse(user)),
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
   * Update user
   */
  static async updateUser(id: string, data: UpdateUserInput, currentUserId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    // Check permissions (users can only update themselves unless they're admin)
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
    });

    if (!currentUser) {
      throw ApiError.unauthorized('Unauthorized');
    }

    // Only allow updating isActive if current user is admin
    if (data.isActive !== undefined && currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden('Only admins can change user status');
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        avatar: data.avatar,
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    logger.info('User updated', { userId: id, updatedBy: currentUserId });

    return this.formatUserResponse(updatedUser);
  }

  /**
   * Delete user (soft delete)
   */
  static async deleteUser(id: string, currentUserId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    // Prevent self-deletion
    if (id === currentUserId) {
      throw ApiError.badRequest('You cannot delete your own account');
    }

    // Soft delete
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('User deleted', { userId: id, deletedBy: currentUserId });
  }

  /**
   * Format user response (exclude sensitive data)
   */
  private static formatUserResponse(user: {
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
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

