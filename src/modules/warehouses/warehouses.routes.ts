import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idParamSchema } from '../../common/validators/common';
import {
  warehouseCreateSchema,
  warehouseListQuery,
  warehouseUpdateSchema,
} from './warehouses.dto';
import * as svc from './warehouses.service';

export const warehouseRouter = Router();
warehouseRouter.use(authenticate);

warehouseRouter.get(
  '/',
  requirePermission('warehouse.read'),
  validate({ query: warehouseListQuery }),
  asyncHandler(async (req, res) => res.json(await svc.list(req.query as never))),
);
warehouseRouter.get(
  '/:id',
  requirePermission('warehouse.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.get(req.params.id as unknown as bigint)),
  ),
);
warehouseRouter.post(
  '/',
  requirePermission('warehouse.write'),
  validate({ body: warehouseCreateSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.create(req.body)),
  ),
);
warehouseRouter.put(
  '/:id',
  requirePermission('warehouse.write'),
  validate({ params: idParamSchema, body: warehouseUpdateSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.update(req.params.id as unknown as bigint, req.body)),
  ),
);
warehouseRouter.delete(
  '/:id',
  requirePermission('warehouse.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.softDelete(req.params.id as unknown as bigint)),
  ),
);
