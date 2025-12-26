import morgan from 'morgan';
import { Request, Response } from 'express';

// Custom token for request ID
morgan.token('id', (req: Request) => {
  return (req as Request & { id?: string }).id || '-';
});

// Custom format
const morganFormat = ':method :url :status :response-time ms - :res[content-length]';

// Development format with colors
export const devLogger = morgan(morganFormat);

// Production format (more concise)
export const prodLogger = morgan('combined', {
  skip: (req: Request, res: Response) => res.statusCode < 400,
});

// Get appropriate logger based on environment
export const getLogger = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'production' ? prodLogger : devLogger;
};
