import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idempotency } from '../../common/middleware/idempotency';
import { mutationRateLimit } from '../../common/middleware/rateLimit';
import { idParamSchema } from '../../common/validators/common';
import { streamVisitReceiptPdf } from '../../common/utils/pdf';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/errors/AppError';
import {
  checkInSchema,
  checkOutSchema,
  confirmSchema,
  recordItemsSchema,
  visitCreateSchema,
  visitListQuery,
} from './sales-visits.dto';
import * as svc from './sales-visits.service';

export const salesVisitRouter = Router();
salesVisitRouter.use(authenticate);

salesVisitRouter.get(
  '/',
  requirePermission('visit.read'),
  validate({ query: visitListQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listVisits(req.query as never)),
  ),
);

salesVisitRouter.get(
  '/:id',
  requirePermission('visit.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.getVisit(req.params.id as unknown as bigint)),
  ),
);

salesVisitRouter.get(
  '/:id/receipt.pdf',
  requirePermission('visit.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as unknown as bigint;
    const v = await prisma.salesVisit.findUnique({
      where: { visit_id: id },
      include: {
        customer: true,
        employee: true,
        items: { include: { product: true } },
        collections: true,
        arInvoices: true,
      },
    });
    if (!v) throw new NotFoundError('Visit not found');
    streamVisitReceiptPdf(res, {
      visit_no: v.visit_no,
      visit_date: v.visit_date,
      status: v.visit_status,
      customer: {
        customer_code: v.customer.customer_code,
        customer_name: v.customer.customer_name,
      },
      employee: { employee_name: v.employee.employee_name },
      items: v.items.map((it) => ({
        product: {
          sku_code: it.product.sku_code,
          product_name: it.product.product_name,
        },
        qty_before: it.qty_before.toString(),
        qty_counted: it.qty_counted.toString(),
        qty_sold: it.qty_sold.toString(),
        qty_replenished: it.qty_replenished.toString(),
        unit_price: it.unit_price.toString(),
        sales_amount: it.sales_amount.toString(),
      })),
      total_sales_amount: v.total_sales_amount.toString(),
      collections: v.collections.map((c) => ({
        collection_no: c.collection_no,
        amount_collected: c.amount_collected.toString(),
        payment_method: c.payment_method,
        reference_no: c.reference_no,
      })),
      ar_invoices: v.arInvoices.map((inv) => ({
        invoice_no: inv.invoice_no,
        total_amount: inv.total_amount.toString(),
        status: inv.status,
      })),
    });
  }),
);

salesVisitRouter.post(
  '/',
  requirePermission('visit.write'),
  validate({ body: visitCreateSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.createVisit(req.body, req.user)),
  ),
);

salesVisitRouter.post(
  '/:id/checkin',
  requirePermission('visit.write'),
  validate({ params: idParamSchema, body: checkInSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.checkIn(req.params.id as unknown as bigint, req.body)),
  ),
);

salesVisitRouter.post(
  '/:id/items',
  requirePermission('visit.write'),
  validate({ params: idParamSchema, body: recordItemsSchema }),
  asyncHandler(async (req, res) =>
    res.json(
      await svc.recordItems(
        req.params.id as unknown as bigint,
        req.body.items,
      ),
    ),
  ),
);

salesVisitRouter.post(
  '/:id/confirm',
  requirePermission('visit.confirm'),
  mutationRateLimit,
  idempotency(),
  validate({ params: idParamSchema, body: confirmSchema }),
  asyncHandler(async (req, res) =>
    res.json(
      await svc.confirmVisit(
        req.params.id as unknown as bigint,
        req.body,
        req.user,
      ),
    ),
  ),
);

salesVisitRouter.post(
  '/:id/checkout',
  requirePermission('visit.write'),
  validate({ params: idParamSchema, body: checkOutSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.checkOut(req.params.id as unknown as bigint, req.body)),
  ),
);

salesVisitRouter.post(
  '/:id/cancel',
  requirePermission('visit.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.cancelVisit(req.params.id as unknown as bigint)),
  ),
);
