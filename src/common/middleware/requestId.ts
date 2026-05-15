import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const id =
    (req.header('x-request-id') as string | undefined) ?? randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader('x-request-id', id);
  next();
};
