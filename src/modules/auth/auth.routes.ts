import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { loginRateLimit } from '../../common/middleware/rateLimit';
import { loginSchema } from './auth.dto';
import * as service from './auth.service';
import { UnauthorizedError } from '../../common/errors/AppError';

export const authRouter = Router();

authRouter.post(
  '/login',
  loginRateLimit,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.login(req.body.username, req.body.password);
    res.json(result);
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    res.json(await service.me(req.user.userId));
  }),
);
