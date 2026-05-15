import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async controller so thrown errors propagate to the express
 * error handler instead of being swallowed as unhandled rejections.
 */
export const asyncHandler =
  <T extends Request = Request>(
    fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
