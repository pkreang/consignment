/**
 * Mobile-friendly endpoints for the van-sales app.
 *
 * Design goals:
 *   - Chatty backend OK; few HTTP round-trips on a phone with bad signal.
 *   - `/today` lists my visits for today plus the latest consignment balance
 *     for each customer in one shot (so the rep can open without internet).
 *   - `/visits/:id/sync` is an idempotent batch: it accepts gps+items+remarks
 *     in one call and runs check-in (if needed) + items.
 *   - `/uploads/sign` is a pre-signed URL STUB: the file is never persisted
 *     server-side. Production should swap in S3/GCS — the contract here is
 *     stable so the mobile client doesn't have to change.
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idParamSchema, bigIntIdSchema, nonNegativeDecimal, positiveDecimal } from '../../common/validators/common';
import { prisma } from '../../database/prisma';
import { ConflictError, NotFoundError } from '../../common/errors/AppError';
import * as visitSvc from '../sales-visits/sales-visits.service';

export const mobileRouter = Router();
mobileRouter.use(authenticate);

mobileRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) throw new NotFoundError('User not found');
    res.json({
      userId: user.userId.toString(),
      username: user.username,
      employeeId: user.employeeId?.toString() ?? null,
      permissions: user.permissions,
    });
  }),
);

mobileRouter.get(
  '/today',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.employeeId) {
      throw new ConflictError(
        'Logged-in user has no employee link; cannot list mobile-assigned visits',
      );
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const visits = await prisma.salesVisit.findMany({
      where: {
        employee_id: user.employeeId,
        visit_date: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        customer: {
          select: {
            customer_id: true,
            customer_code: true,
            customer_name: true,
            phone: true,
            latitude: true,
            longitude: true,
            address: true,
            credit_term_days: true,
            credit_limit: true,
            max_capacity_qty: true,
          },
        },
        items: true,
      },
      orderBy: [{ visit_status: 'asc' }, { visit_date: 'asc' }],
    });

    const customerIds = Array.from(new Set(visits.map((v) => v.customer_id)));
    const stocks = await prisma.consignmentStock.findMany({
      where: { customer_id: { in: customerIds } },
      include: { product: true },
    });
    const stocksByCustomer = new Map<string, typeof stocks>();
    for (const s of stocks) {
      const k = s.customer_id.toString();
      const arr = stocksByCustomer.get(k) ?? [];
      arr.push(s);
      stocksByCustomer.set(k, arr);
    }
    res.json({
      employee_id: user.employeeId.toString(),
      today: startOfDay.toISOString(),
      visits: visits.map((v) => ({
        ...v,
        consignment_stock: stocksByCustomer.get(v.customer_id.toString()) ?? [],
      })),
    });
  }),
);

const syncSchema = z.object({
  checkin: z
    .object({
      gps_latitude: z.string().optional(),
      gps_longitude: z.string().optional(),
      photo_url: z.string().url().optional(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        product_id: bigIntIdSchema,
        qty_counted: nonNegativeDecimal,
        qty_replenished: nonNegativeDecimal.default('0'),
        unit_price: positiveDecimal.optional(),
      }),
    )
    .min(1),
  note: z.string().max(2000).optional(),
});

mobileRouter.post(
  '/visits/:id/sync',
  validate({ params: idParamSchema, body: syncSchema }),
  asyncHandler(async (req, res) => {
    const visitId = req.params.id as unknown as bigint;
    const body = req.body as z.infer<typeof syncSchema>;

    const visit = await prisma.salesVisit.findUnique({ where: { visit_id: visitId } });
    if (!visit) throw new NotFoundError('Visit not found');

    if (visit.visit_status === 'DRAFT' && body.checkin) {
      await visitSvc.checkIn(visitId, body.checkin);
    }

    const updated = await visitSvc.recordItems(visitId, body.items);
    if (body.note) {
      await prisma.salesVisit.update({
        where: { visit_id: visitId },
        data: { note: body.note },
      });
    }
    res.json(updated);
  }),
);

const signSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(100).optional(),
  purpose: z.enum(['visit_photo', 'product', 'avatar']).default('visit_photo'),
});

mobileRouter.post(
  '/uploads/sign',
  validate({ body: signSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof signSchema>;
    // STUB: real implementation should call S3/GCS and return a presigned PUT
    // URL. The structure matches what mobile clients expect.
    const objectKey = `${body.purpose}/${Date.now()}-${crypto
      .randomBytes(6)
      .toString('hex')}-${body.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const expiresIn = 600;
    res.json({
      upload_url: `https://example-bucket.example.com/${objectKey}?X-Amz-Signature=stub`,
      method: 'PUT',
      headers: {
        'Content-Type': body.content_type ?? 'application/octet-stream',
      },
      expires_in: expiresIn,
      asset_url: `https://cdn.example.com/${objectKey}`,
      object_key: objectKey,
      note: 'STUB: replace this endpoint with real S3/GCS signing in production.',
    });
  }),
);
