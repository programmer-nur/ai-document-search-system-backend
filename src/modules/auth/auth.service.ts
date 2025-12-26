import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ApiError } from '../../utils/apiError';
import { signToken } from '../../utils/jwt';
import { logger } from '../../utils/logger';
import prisma from '../../utils/prisma';
import { createAuditLog } from '../../utils/auditLog';
import type { RegisterInput, LoginInput, AuthResponse, ChangePasswordInput } from './auth.types';

export class AuthService {
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
  }): AuthResponse['user'] {
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

  /**
   * Register a new user
   */
  static async register(data: RegisterInput, metadata?: { ipAddress?: string; userAgent?: string }): Promise<AuthResponse> {
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

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: 'user.register',
      resourceType: 'user',
      resourceId: user.id,
      details: { email: user.email, role: user.role },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
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
  static async login(data: LoginInput, metadata?: { ipAddress?: string; userAgent?: string }): Promise<AuthResponse> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // Log failed login attempt
      await createAuditLog({
        action: 'auth.login.failed',
        resourceType: 'user',
        details: { email: data.email, reason: 'user_not_found' },
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      await createAuditLog({
        userId: user.id,
        action: 'auth.login.failed',
        resourceType: 'user',
        resourceId: user.id,
        details: { email: data.email, reason: 'account_deactivated' },
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });
      throw ApiError.forbidden('Your account has been deactivated');
    }

    // Check if user is deleted
    if (user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      // Log failed login attempt
      await createAuditLog({
        userId: user.id,
        action: 'auth.login.failed',
        resourceType: 'user',
        resourceId: user.id,
        details: { email: data.email, reason: 'invalid_password' },
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });
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

    // Log successful login
    await createAuditLog({
      userId: user.id,
      action: 'auth.login.success',
      resourceType: 'user',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    return {
      user: this.formatUserResponse(user),
      token,
    };
  }

  /**
   * Change password
   */
  static async changePassword(
    userId: string,
    data: ChangePasswordInput,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password);

    if (!isPasswordValid) {
      await createAuditLog({
        userId,
        action: 'auth.password.change.failed',
        resourceType: 'user',
        resourceId: userId,
        details: { reason: 'invalid_current_password' },
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });
      throw ApiError.unauthorized('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Log password change
    await createAuditLog({
      userId,
      action: 'auth.password.change.success',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    logger.info('Password changed successfully', { userId });
  }

  /**
   * Get current user profile (for auth context)
   */
  static async getCurrentUser(userId: string): Promise<AuthResponse['user']> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    return this.formatUserResponse(user);
  }
}

