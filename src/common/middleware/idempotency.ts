import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ConflictError } from '../errors/AppError';

/**
 * Idempotency-Key middleware.
 *
 * Clients send `Idempotency-Key: <opaque-string>` on POSTs to mutation endpoints.
 *
 * Semantics:
 *   - First request with the key stores (status, response_body) atomically AFTER the
 *     handler succeeds. The cache is keyed by (key, user_id) so two different users
 *     can't accidentally collide.
 *   - Subsequent retries with the SAME key and the SAME request body replay the
 *     cached status + body verbatim.
 *   - Retries with the SAME key but a DIFFERENT body return 409 to surface the bug.
 *
 * The middleware is a no-op when the header is missing — only callers that opt in
 * pay the storage cost.
 */
export function idempotency() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('Idempotency-Key') ?? req.header('idempotency-key');
    if (!key) {
      next();
      return;
    }
    if (key.length > 200) {
      next(new ConflictError('Idempotency-Key too long (max 200 chars)'));
      return;
    }

    const user = req.user;
    const userId = user?.userId ? BigInt(user.userId) : null;
    const bodyString = req.body ? JSON.stringify(req.body) : '';
    const requestHash = crypto
      .createHash('sha256')
      .update(`${req.method}:${req.originalUrl}:${bodyString}`)
      .digest('hex');

    const cached = userId
      ? await prisma.idempotencyKey.findUnique({
          where: { key_user_id: { key, user_id: userId } },
        })
      : await prisma.idempotencyKey.findFirst({
          where: { key, user_id: null },
        });

    if (cached) {
      if (cached.request_hash !== requestHash) {
        next(
          new ConflictError(
            'Idempotency-Key reuse with a different request body. Use a new key.',
          ),
        );
        return;
      }
      res
        .status(cached.status_code)
        .setHeader('Idempotent-Replay', 'true')
        .json(cached.response_body);
      return;
    }

    const originalJson = res.json.bind(res);
    let captured: unknown = undefined;
    let captureFailed = false;

    res.json = ((body?: unknown) => {
      try {
        captured = body;
      } catch {
        captureFailed = true;
      }
      return originalJson(body);
    }) as Response['json'];

    res.on('finish', () => {
      const status = res.statusCode;
      if (captureFailed) return;
      if (status < 200 || status >= 300) return;
      // Persist asynchronously; if we race with another retry, the unique
      // constraint protects against double writes.
      prisma.idempotencyKey
        .create({
          data: {
            key,
            user_id: userId,
            method: req.method,
            path: req.originalUrl.slice(0, 500),
            request_hash: requestHash,
            status_code: status,
            response_body: (captured ?? {}) as Prisma.InputJsonValue,
          },
        })
        .catch((e) => {
          // P2002 = unique violation (concurrent retry already wrote) — fine.
          if (
            !(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
          ) {
            console.warn('idempotency: failed to persist key', key, e);
          }
        });
    });

    next();
  };
}
