import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { disconnectPrisma } from './database/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    `consignment-erp-lite listening on port ${env.PORT} (${env.NODE_ENV})`,
  );
});

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
