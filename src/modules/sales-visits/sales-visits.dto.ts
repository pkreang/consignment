import { z } from 'zod';
import {
  bigIntIdSchema,
  decimalString,
  nonNegativeDecimal,
  paginationSchema,
} from '../../common/validators/common';

export const visitCreateSchema = z.object({
  customer_id: bigIntIdSchema,
  employee_id: bigIntIdSchema.optional(),
  route_id: bigIntIdSchema.optional(),
  visit_date: z.string().datetime().optional(),
  note: z.string().max(2000).optional(),
});

export const checkInSchema = z.object({
  gps_latitude: decimalString.optional(),
  gps_longitude: decimalString.optional(),
  photo_url: z.string().url().max(500).optional(),
});

export const checkOutSchema = z.object({
  photo_url: z.string().url().max(500).optional(),
  note: z.string().max(2000).optional(),
});

const visitItemInput = z.object({
  product_id: bigIntIdSchema,
  qty_counted: nonNegativeDecimal,
  qty_replenished: nonNegativeDecimal.default('0'),
  unit_price: nonNegativeDecimal.optional(),
});

export const recordItemsSchema = z.object({
  items: z.array(visitItemInput).min(1),
});

export const confirmSchema = z.object({
  warehouse_id: bigIntIdSchema.optional(),
  payment_method: z
    .enum(['CASH', 'BANK_TRANSFER', 'QR_PAYMENT', 'OTHER'])
    .optional(),
  amount_collected: nonNegativeDecimal.optional(),
  reference_no: z.string().max(100).optional(),
  override_credit: z.boolean().optional(),
  override_reason: z.string().max(500).optional(),
});

export const visitListQuery = paginationSchema.extend({
  customer_id: bigIntIdSchema.optional(),
  employee_id: bigIntIdSchema.optional(),
  route_id: bigIntIdSchema.optional(),
  status: z.string().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});
