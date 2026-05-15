import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idempotency } from '../../common/middleware/idempotency';
import { mutationRateLimit } from '../../common/middleware/rateLimit';
import { streamInvoicePdf } from '../../common/utils/pdf';
import { NotFoundError } from '../../common/errors/AppError';
import { prisma } from '../../database/prisma';
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

arRouter.get(
  '/invoices/:id/pdf',
  requirePermission('ar.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as unknown as bigint;
    const inv = await prisma.arInvoice.findUnique({
      where: { ar_invoice_id: id },
      include: {
        customer: true,
        visit: true,
        items: { include: { product: true } },
      },
    });
    if (!inv) throw new NotFoundError('Invoice not found');
    streamInvoicePdf(res, {
      invoice_no: inv.invoice_no,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      status: inv.status,
      customer: {
        customer_code: inv.customer.customer_code,
        customer_name: inv.customer.customer_name,
        address: inv.customer.address,
      },
      visit: inv.visit ? { visit_no: inv.visit.visit_no } : null,
      total_amount: inv.total_amount.toString(),
      outstanding_amount: inv.outstanding_amount.toString(),
      items: inv.items.map((it) => ({
        product: {
          sku_code: it.product.sku_code,
          product_name: it.product.product_name,
        },
        qty: it.qty.toString(),
        unit_price: it.unit_price.toString(),
        line_amount: it.line_amount.toString(),
      })),
    });
  }),
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
  mutationRateLimit,
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
