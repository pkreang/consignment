import { PrismaClient, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type Tx = Prisma.TransactionClient;

/**
 * Run a unit of work inside a serializable Prisma transaction.
 * All write paths that touch balances/credit/AR must use this.
 */
export async function withTx<T>(
  fn: (tx: Tx) => Promise<T>,
  options?: {
    isolationLevel?: Prisma.TransactionIsolationLevel;
    maxWait?: number;
    timeout?: number;
  },
): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel:
      options?.isolationLevel ?? Prisma.TransactionIsolationLevel.Serializable,
    maxWait: options?.maxWait ?? 10_000,
    timeout: options?.timeout ?? 30_000,
  });
}

export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.warn({ err }, 'Failed to disconnect prisma');
  }
}
