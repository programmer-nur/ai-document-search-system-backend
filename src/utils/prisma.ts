import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from './logger';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    errorFormat: env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
    log:
      env.NODE_ENV === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'stdout' },
            { level: 'warn', emit: 'stdout' },
          ]
        : [{ level: 'error', emit: 'stdout' }],
  });

// Log queries in development
if (env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: unknown) => {
    const event = e as { query: string; params: string; duration: number };
    logger.debug('Prisma Query', {
      query: event.query,
      params: event.params,
      duration: `${event.duration}ms`,
    });
  });
}

// Prevent multiple instances in development (Next.js hot reload)
if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Prisma Client disconnected');
});

export default prisma;
