import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import {
  idParamSchema,
  paginationSchema,
} from '../../common/validators/common';
import {
  permissionListQuery,
  roleCreateSchema,
  rolePermissionsSchema,
  roleUpdateSchema,
} from './security.dto';
import * as svc from './security.service';

export const roleRouter = Router();
roleRouter.use(authenticate);

roleRouter.get(
  '/',
  requirePermission('user.read'),
  validate({ query: paginationSchema.extend({}) }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listRoles(req.query as never)),
  ),
);
roleRouter.get(
  '/:id',
  requirePermission('user.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.getRole(req.params.id as unknown as bigint)),
  ),
);
roleRouter.post(
  '/',
  requirePermission('user.write'),
  validate({ body: roleCreateSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.createRole(req.body)),
  ),
);
roleRouter.put(
  '/:id',
  requirePermission('user.write'),
  validate({ params: idParamSchema, body: roleUpdateSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.updateRole(req.params.id as unknown as bigint, req.body)),
  ),
);
roleRouter.delete(
  '/:id',
  requirePermission('user.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.deleteRole(req.params.id as unknown as bigint)),
  ),
);
roleRouter.put(
  '/:id/permissions',
  requirePermission('user.write'),
  validate({ params: idParamSchema, body: rolePermissionsSchema }),
  asyncHandler(async (req, res) =>
    res.json(
      await svc.setRolePermissions(
        req.params.id as unknown as bigint,
        req.body.permission_ids,
      ),
    ),
  ),
);

export const permissionRouter = Router();
permissionRouter.use(authenticate);

permissionRouter.get(
  '/',
  requirePermission('user.read'),
  validate({ query: permissionListQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listPermissions(req.query as never)),
  ),
);
