import dotenv from 'dotenv';

dotenv.config();

export const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',

  // AWS S3
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  // Qdrant
  QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
  QDRANT_API_KEY: process.env.QDRANT_API_KEY || '',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};

