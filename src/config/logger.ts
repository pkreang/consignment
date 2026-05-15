import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        }
      : undefined,
  base: { service: 'consignment-erp-lite' },
  redact: {
    paths: ['req.headers.authorization', 'password', 'password_hash'],
    censor: '[REDACTED]',
  },
});
