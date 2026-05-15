import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idempotency } from '../../common/middleware/idempotency';
import { idParamSchema } from '../../common/validators/common';
import {
  agingQuery,
  invoiceCreateSchema,
  invoiceListQuery,
  invoicePaymentSchema,
} from './ar.dto';
import * as svc from './ar.service';

export const arRouter = Router();
arRouter.use(authenticate);

arRouter.get(
  '/invoices',
  requirePermission('ar.read'),
  validate({ query: invoiceListQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listInvoices(req.query as never)),
  ),
);

arRouter.get(
  '/invoices/:id',
  requirePermission('ar.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.getInvoice(req.params.id as unknown as bigint)),
  ),
);

arRouter.post(
  '/invoices',
  requirePermission('ar.invoice.create_manual'),
  validate({ body: invoiceCreateSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.createInvoiceManual(req.body)),
  ),
);

arRouter.post(
  '/invoices/:id/payments',
  requirePermission('ar.payment.write'),
  idempotency(),
  validate({ params: idParamSchema, body: invoicePaymentSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(
      await svc.recordInvoicePayment(
        req.params.id as unknown as bigint,
        req.body,
      ),
    ),
  ),
);

arRouter.get(
  '/outstanding',
  requirePermission('ar.read'),
  asyncHandler(async (_req, res) => res.json(await svc.getOutstandingByCustomer())),
);

arRouter.get(
  '/aging',
  requirePermission('ar.read'),
  validate({ query: agingQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.getAgingReport(req.query as never)),
  ),
);
