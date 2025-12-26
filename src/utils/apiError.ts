import { StatusCodes } from 'http-status-codes';
import { CustomError } from '../middlewares/errorHandler';

/**
 * Creates a standardized API error
 */
export class ApiError extends CustomError {
  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    errors?: unknown
  ) {
    super(message, statusCode, errors);
    this.name = 'ApiError';
  }

  static badRequest(message: string, errors?: unknown): ApiError {
    return new ApiError(message, StatusCodes.BAD_REQUEST, errors);
  }

  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(message, StatusCodes.UNAUTHORIZED);
  }

  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(message, StatusCodes.FORBIDDEN);
  }

  static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError(message, StatusCodes.NOT_FOUND);
  }

  static conflict(message: string, errors?: unknown): ApiError {
    return new ApiError(message, StatusCodes.CONFLICT, errors);
  }

  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(message, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  static validation(message: string, errors?: unknown): ApiError {
    return new ApiError(message, StatusCodes.UNPROCESSABLE_ENTITY, errors);
  }

  static tooManyRequests(message: string = 'Too many requests'): ApiError {
    return new ApiError(message, StatusCodes.TOO_MANY_REQUESTS);
  }
}

