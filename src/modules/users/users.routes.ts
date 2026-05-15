import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idParamSchema } from '../../common/validators/common';
import {
  passwordChangeSchema,
  userCreateSchema,
  userListQuery,
  userUpdateSchema,
} from './users.dto';
import * as svc from './users.service';

export const userRouter = Router();
userRouter.use(authenticate);

userRouter.get(
  '/',
  requirePermission('user.read'),
  validate({ query: userListQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listUsers(req.query as never)),
  ),
);
userRouter.get(
  '/:id',
  requirePermission('user.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.getUser(req.params.id as unknown as bigint)),
  ),
);
userRouter.post(
  '/',
  requirePermission('user.write'),
  validate({ body: userCreateSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.createUser(req.body)),
  ),
);
userRouter.put(
  '/:id',
  requirePermission('user.write'),
  validate({ params: idParamSchema, body: userUpdateSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.updateUser(req.params.id as unknown as bigint, req.body)),
  ),
);
userRouter.put(
  '/:id/password',
  requirePermission('user.write'),
  validate({ params: idParamSchema, body: passwordChangeSchema }),
  asyncHandler(async (req, res) =>
    res.json(
      await svc.changePassword(
        req.params.id as unknown as bigint,
        req.body.password,
      ),
    ),
  ),
);
userRouter.delete(
  '/:id',
  requirePermission('user.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.deleteUser(req.params.id as unknown as bigint)),
  ),
);
