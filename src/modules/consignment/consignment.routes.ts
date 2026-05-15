import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { consignmentStockQuery } from '../inventory/inventory.dto';
import * as svc from '../inventory/inventory.service';

export const consignmentRouter = Router();
consignmentRouter.use(authenticate);

consignmentRouter.get(
  '/',
  requirePermission('inventory.read'),
  validate({ query: consignmentStockQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listConsignmentStock(req.query as never)),
  ),
);
