import { Request, Response, NextFunction } from 'express';
import { runWithAudit } from '../../database/audit';

export const auditContext = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  runWithAudit(
    {
      userId: req.user?.userId,
      username: req.user?.username,
      requestId: (req as Request & { id?: string }).id,
      ip: req.ip,
    },
    async () => next(),
  );
};
