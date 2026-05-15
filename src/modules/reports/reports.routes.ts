import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import {
  deadStockQuery,
  productionPlanningQuery,
  rangeQuery,
  rangeWithLimit,
} from './reports.dto';
import * as svc from './reports.service';
import { getAgingReport, getOutstandingByCustomer } from '../ar/ar.service';

export const reportsRouter = Router();
reportsRouter.use(authenticate);
reportsRouter.use(requirePermission('report.read'));

reportsRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => res.json(await svc.dashboard())),
);

reportsRouter.get(
  '/sales-by-customer',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.salesByCustomer(req.query as never)),
  ),
);

reportsRouter.get(
  '/sales-by-sku',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.salesBySku(req.query as never)),
  ),
);

reportsRouter.get(
  '/sales-by-employee',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.salesByEmployee(req.query as never)),
  ),
);

reportsRouter.get(
  '/current-stock',
  asyncHandler(async (_req, res) =>
    res.json(await svc.currentWarehouseStock()),
  ),
);

reportsRouter.get(
  '/consignment-stock',
  asyncHandler(async (_req, res) =>
    res.json(await svc.consignmentStockByCustomer()),
  ),
);

reportsRouter.get(
  '/collection',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.collectionReport(req.query as never)),
  ),
);

reportsRouter.get(
  '/ar-aging',
  asyncHandler(async (req, res) =>
    res.json(
      await getAgingReport({
        customer_id: (req.query as { customer_id?: string }).customer_id
          ? BigInt((req.query as { customer_id: string }).customer_id)
          : undefined,
      }),
    ),
  ),
);

reportsRouter.get(
  '/ar-outstanding',
  asyncHandler(async (_req, res) =>
    res.json(await getOutstandingByCustomer()),
  ),
);

reportsRouter.get(
  '/best-sellers',
  validate({ query: rangeWithLimit }),
  asyncHandler(async (req, res) =>
    res.json(await svc.bestSellers(req.query as never)),
  ),
);

reportsRouter.get(
  '/slow-movers',
  validate({ query: rangeWithLimit }),
  asyncHandler(async (req, res) =>
    res.json(await svc.slowMovers(req.query as never)),
  ),
);

reportsRouter.get(
  '/dead-stock',
  validate({ query: deadStockQuery }),
  asyncHandler(async (req, res) =>
    res.json(
      await svc.deadStock(
        Number((req.query as { days?: number }).days ?? 30),
      ),
    ),
  ),
);

reportsRouter.get(
  '/production-planning',
  validate({ query: productionPlanningQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.productionPlanning(req.query as never)),
  ),
);
