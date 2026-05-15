import rateLimit from 'express-rate-limit';

/**
 * Two-tier rate limiting:
 *   - global: per-IP soft cap to soak DDoS-ish bursts on cheap endpoints.
 *   - mutation: per-IP+user tighter cap on the financial mutations.
 *   - login: per-IP very tight cap to slow credential stuffing.
 *
 * Health/metrics/docs endpoints bypass the global limiter so an alerting
 * scraper doesn't get throttled.
 */

const SKIP_PATHS = new Set(['/health', '/ready', '/metrics']);

export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => SKIP_PATHS.has(req.path) || req.path.startsWith('/docs'),
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

export const mutationRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as { user?: { userId?: bigint | string } }).user?.userId;
    return `${req.ip ?? 'unknown'}:${userId ?? 'anon'}`;
  },
  message: {
    error: {
      code: 'MUTATION_RATE_LIMITED',
      message: 'Too many mutation requests; slow down',
    },
  },
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: 'LOGIN_RATE_LIMITED',
      message: 'Too many failed logins; try again later',
    },
  },
});
