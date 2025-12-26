import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';

// Simple in-memory rate limiter (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  message?: string; // Custom error message
}

export const rateLimit = (options: RateLimitOptions) => {
  const { windowMs, maxRequests, keyGenerator, message } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Generate key (default: IP address)
      const key = keyGenerator
        ? keyGenerator(req)
        : req.ip || req.socket.remoteAddress || 'unknown';

      const now = Date.now();
      const record = rateLimitStore.get(key);

      // Clean up old records periodically
      if (Math.random() < 0.01) {
        // 1% chance to clean up
        for (const [k, v] of rateLimitStore.entries()) {
          if (v.resetTime < now) {
            rateLimitStore.delete(k);
          }
        }
      }

      if (!record || record.resetTime < now) {
        // Create new record
        rateLimitStore.set(key, {
          count: 1,
          resetTime: now + windowMs,
        });
        next();
        return;
      }

      if (record.count >= maxRequests) {
        logger.warn('Rate limit exceeded', {
          key,
          count: record.count,
          path: req.path,
          ip: req.ip,
        });

        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        throw ApiError.tooManyRequests(
          message || `Too many requests. Please try again after ${retryAfter} seconds.`
        );
      }

      // Increment count
      record.count++;
      rateLimitStore.set(key, record);

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      next(error);
    }
  };
};

// Pre-configured rate limiters
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 requests per 15 minutes
  keyGenerator: (req) => {
    // Use email if available, otherwise IP
    return req.body?.email || req.ip || 'unknown';
  },
  message: 'Too many authentication attempts. Please try again later.',
});

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
});

