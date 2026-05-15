import { z } from 'zod';
import {
  bigIntIdSchema,
  nonNegativeDecimal,
  paginationSchema,
  positiveDecimal,
} from '../../common/validators/common';

export const invoiceCreateSchema = z.object({
  customer_id: bigIntIdSchema,
  invoice_date: z.string().datetime().optional(),
  credit_term_days: z.coerce.number().int().min(0).optional(),
  note: z.string().max(2000).optional(),
  lines: z
    .array(
      z.object({
        product_id: bigIntIdSchema,
        qty: positiveDecimal,
        unit_price: nonNegativeDecimal,
      }),
    )
    .min(1),
});

export const invoicePaymentSchema = z.object({
  amount: positiveDecimal,
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'QR_PAYMENT', 'OTHER']),
  reference_no: z.string().max(100).optional(),
});

export const invoiceListQuery = paginationSchema.extend({
  customer_id: bigIntIdSchema.optional(),
  status: z.enum(['OPEN', 'PARTIAL', 'PAID', 'CANCELLED']).optional(),
  overdue_only: z.enum(['true', 'false']).optional(),
});

export const agingQuery = z.object({
  customer_id: bigIntIdSchema.optional(),
});
