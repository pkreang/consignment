import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idempotency } from '../../common/middleware/idempotency';
import {
  adjustmentSchema,
  consignmentStockQuery,
  loadToCustomerSchema,
  lotListQuery,
  movementListQuery,
  productionReceiptSchema,
  returnFromCustomerSchema,
  warehouseStockQuery,
} from './inventory.dto';
import * as svc from './inventory.service';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

inventoryRouter.get(
  '/warehouse',
  requirePermission('inventory.read'),
  validate({ query: warehouseStockQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listWarehouseStock(req.query as never)),
  ),
);

inventoryRouter.get(
  '/consignment',
  requirePermission('inventory.read'),
  validate({ query: consignmentStockQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listConsignmentStock(req.query as never)),
  ),
);

inventoryRouter.get(
  '/movements',
  requirePermission('inventory.read'),
  validate({ query: movementListQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listMovements(req.query as never)),
  ),
);

inventoryRouter.get(
  '/lots',
  requirePermission('inventory.read'),
  validate({ query: lotListQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listLots(req.query as never)),
  ),
);

inventoryRouter.post(
  '/adjustment',
  requirePermission('inventory.adjust'),
  validate({ body: adjustmentSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.warehouseAdjustment(req.body, req.user)),
  ),
);

inventoryRouter.post(
  '/production-receipt',
  requirePermission('inventory.production_receipt'),
  validate({ body: productionReceiptSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.productionReceipt(req.body, req.user)),
  ),
);

inventoryRouter.post(
  '/load-to-customer',
  requirePermission('inventory.load'),
  idempotency(),
  validate({ body: loadToCustomerSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.loadStockToCustomer(req.body, req.user)),
  ),
);

inventoryRouter.post(
  '/return-from-customer',
  requirePermission('inventory.return'),
  idempotency(),
  validate({ body: returnFromCustomerSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.returnStockFromCustomer(req.body, req.user)),
  ),
);
