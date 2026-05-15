import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { respondCsvOrJson } from '../../common/utils/csv';
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
    respondCsvOrJson(req, res, await svc.salesByCustomer(req.query as never), {
      filename: 'sales-by-customer',
    }),
  ),
);

reportsRouter.get(
  '/sales-by-sku',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) =>
    respondCsvOrJson(req, res, await svc.salesBySku(req.query as never), {
      filename: 'sales-by-sku',
    }),
  ),
);

reportsRouter.get(
  '/sales-by-employee',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) =>
    respondCsvOrJson(req, res, await svc.salesByEmployee(req.query as never), {
      filename: 'sales-by-employee',
    }),
  ),
);

reportsRouter.get(
  '/current-stock',
  asyncHandler(async (req, res) =>
    respondCsvOrJson(req, res, await svc.currentWarehouseStock(), {
      filename: 'current-stock',
    }),
  ),
);

reportsRouter.get(
  '/consignment-stock',
  asyncHandler(async (req, res) =>
    respondCsvOrJson(req, res, await svc.consignmentStockByCustomer(), {
      filename: 'consignment-stock',
    }),
  ),
);

reportsRouter.get(
  '/collection',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) =>
    respondCsvOrJson(req, res, await svc.collectionReport(req.query as never), {
      filename: 'collection',
    }),
  ),
);

reportsRouter.get(
  '/ar-aging',
  asyncHandler(async (req, res) => {
    const data = await getAgingReport({
      customer_id: (req.query as { customer_id?: string }).customer_id
        ? BigInt((req.query as { customer_id: string }).customer_id)
        : undefined,
    });
    respondCsvOrJson(req, res, data, {
      filename: 'ar-aging',
      rowsExtractor: (p) => p.invoices as unknown as Array<Record<string, unknown>>,
    });
  }),
);

reportsRouter.get(
  '/ar-outstanding',
  asyncHandler(async (req, res) =>
    respondCsvOrJson(req, res, await getOutstandingByCustomer(), {
      filename: 'ar-outstanding',
    }),
  ),
);

reportsRouter.get(
  '/best-sellers',
  validate({ query: rangeWithLimit }),
  asyncHandler(async (req, res) =>
    respondCsvOrJson(req, res, await svc.bestSellers(req.query as never), {
      filename: 'best-sellers',
    }),
  ),
);

reportsRouter.get(
  '/slow-movers',
  validate({ query: rangeWithLimit }),
  asyncHandler(async (req, res) =>
    respondCsvOrJson(req, res, await svc.slowMovers(req.query as never), {
      filename: 'slow-movers',
    }),
  ),
);

reportsRouter.get(
  '/dead-stock',
  validate({ query: deadStockQuery }),
  asyncHandler(async (req, res) =>
    respondCsvOrJson(
      req,
      res,
      await svc.deadStock(Number((req.query as { days?: number }).days ?? 30)),
      { filename: 'dead-stock' },
    ),
  ),
);

reportsRouter.get(
  '/production-planning',
  validate({ query: productionPlanningQuery }),
  asyncHandler(async (req, res) =>
    respondCsvOrJson(req, res, await svc.productionPlanning(req.query as never), {
      filename: 'production-planning',
    }),
  ),
);
