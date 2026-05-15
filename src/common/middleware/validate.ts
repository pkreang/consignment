import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodTypeAny } from 'zod';

export type RequestSchemas<
  TBody extends ZodTypeAny = ZodTypeAny,
  TQuery extends ZodTypeAny = ZodTypeAny,
  TParams extends ZodTypeAny = ZodTypeAny,
> = {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
};

/**
 * Validates the parts of the express request against zod schemas and
 * replaces the original payload with the parsed/transformed result.
 */
export const validate = <
  TBody extends ZodTypeAny = ZodTypeAny,
  TQuery extends ZodTypeAny = ZodTypeAny,
  TParams extends ZodTypeAny = ZodTypeAny,
>(
  schemas: RequestSchemas<TBody, TQuery, TParams>,
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = (schemas.body as ZodSchema).parse(req.body);
      }
      if (schemas.query) {
        const parsed = (schemas.query as ZodSchema).parse(req.query);
        Object.assign(req.query as Record<string, unknown>, parsed);
      }
      if (schemas.params) {
        const parsed = (schemas.params as ZodSchema).parse(req.params);
        Object.assign(req.params as Record<string, unknown>, parsed);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
