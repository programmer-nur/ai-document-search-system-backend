import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { serializeBigInt } from '../utils/serialize';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  errors?: unknown;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  errors?: unknown;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    errors?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle Prisma errors
const handlePrismaError = (err: Prisma.PrismaClientKnownRequestError): CustomError => {
  let message = 'Database operation failed';
  let statusCode = StatusCodes.BAD_REQUEST;

  switch (err.code) {
    case 'P2002':
      message = `Duplicate field value: ${err.meta?.target}`;
      statusCode = StatusCodes.CONFLICT;
      break;
    case 'P2014':
      message = `Invalid ID: ${err.meta?.target}`;
      statusCode = StatusCodes.BAD_REQUEST;
      break;
    case 'P2003':
      message = `Invalid input data`;
      statusCode = StatusCodes.BAD_REQUEST;
      break;
    case 'P2025':
      message = 'Record not found';
      statusCode = StatusCodes.NOT_FOUND;
      break;
    default:
      message = 'Database error occurred';
      statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  }

  return new CustomError(message, statusCode);
};

// Handle validation errors
const handleValidationError = (err: Error): CustomError => {
  const message = err.message || 'Validation failed';
  return new CustomError(message, StatusCodes.BAD_REQUEST);
};

// Handle JWT errors
const handleJWTError = (): CustomError => {
  return new CustomError('Invalid token. Please log in again!', StatusCodes.UNAUTHORIZED);
};

// Handle JWT expired error
const handleJWTExpiredError = (): CustomError => {
  return new CustomError('Your token has expired! Please log in again.', StatusCodes.UNAUTHORIZED);
};

// Production error response
const sendErrorProd = (err: AppError, res: Response): void => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response: Record<string, unknown> = {
      success: false,
      statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
      message: err.message,
    };

    if (err.errors) {
      response.errors = serializeBigInt(err.errors);
    }

    res.status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(serializeBigInt(response));
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('ERROR 💥', err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong!',
    });
  }
};

// Development error response
const sendErrorDev = (err: AppError, res: Response): void => {
  const response: Record<string, unknown> = {
    success: false,
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    message: err.message,
    error: err,
    stack: err.stack,
  };

  if (err.errors) {
    response.errors = serializeBigInt(err.errors);
  }

  res.status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(serializeBigInt(response));
};

export const errorHandler = (
  err: AppError | Prisma.PrismaClientKnownRequestError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error: AppError = err as AppError;

  // Log error
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // Handle specific error types
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  } else if (err.name === 'ValidationError' || err.name === 'ZodError') {
    error = handleValidationError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  } else if (!(err instanceof CustomError)) {
    // Unknown error, create a generic one
    error = new CustomError(
      err.message || 'Internal Server Error',
      (err as AppError).statusCode || StatusCodes.INTERNAL_SERVER_ERROR
    );
  }

  // Send error response based on environment
  if (process.env.NODE_ENV === 'production') {
    sendErrorProd(error, res);
  } else {
    sendErrorDev(error, res);
  }
};
