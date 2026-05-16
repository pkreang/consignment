import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET should be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),

  DEFAULT_TIMEZONE: z.string().default('Asia/Bangkok'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  PAGINATION_DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().default(50),
  PAGINATION_MAX_PAGE_SIZE: z.coerce.number().int().positive().default(200),

  // Outbound notifications (all optional).
  NOTIFY_WEBHOOK_URL: z.string().url().optional(),
  NOTIFY_WEBHOOK_SECRET: z.string().optional(),
  LINE_NOTIFY_TOKEN: z.string().optional(),
  NOTIFY_DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // Credit watchdog
  CREDIT_ALERT_THRESHOLD_PCT: z.coerce.number().int().min(0).max(200).default(80),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.format());
    throw new Error('Invalid environment configuration');
  }
  cached = parsed.data;
  return cached;
}

export const env = loadEnv();
