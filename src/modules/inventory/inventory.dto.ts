import { z } from 'zod';
import {
  bigIntIdSchema,
  paginationSchema,
  positiveDecimal,
} from '../../common/validators/common';

const lineItem = z.object({
  product_id: bigIntIdSchema,
  qty: positiveDecimal,
  unit_cost: positiveDecimal.optional(),
  unit_price: positiveDecimal.optional(),
});

export const warehouseStockQuery = paginationSchema.extend({
  warehouse_id: bigIntIdSchema.optional(),
  product_id: bigIntIdSchema.optional(),
  q: z.string().optional(),
  low_stock: z.enum(['true', 'false']).optional(),
});

export const consignmentStockQuery = paginationSchema.extend({
  customer_id: bigIntIdSchema.optional(),
  product_id: bigIntIdSchema.optional(),
});

export const movementListQuery = paginationSchema.extend({
  warehouse_id: bigIntIdSchema.optional(),
  customer_id: bigIntIdSchema.optional(),
  product_id: bigIntIdSchema.optional(),
  movement_type: z.string().optional(),
  ref_doc_type: z.string().optional(),
  ref_doc_id: bigIntIdSchema.optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

export const adjustmentSchema = z.object({
  warehouse_id: bigIntIdSchema,
  remark: z.string().max(500).optional(),
  lines: z
    .array(
      z.object({
        product_id: bigIntIdSchema,
        delta_qty: z.union([z.string(), z.number()]).transform((v, ctx) => {
          const s = String(v);
          if (!/^-?\d+(\.\d+)?$/.test(s)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'must be a decimal number',
            });
            return z.NEVER;
          }
          if (Number(s) === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'delta_qty must not be zero',
            });
            return z.NEVER;
          }
          return s;
        }),
        unit_cost: positiveDecimal.optional(),
      }),
    )
    .min(1),
});

export const productionReceiptSchema = z.object({
  warehouse_id: bigIntIdSchema,
  remark: z.string().max(500).optional(),
  lines: z.array(lineItem).min(1),
});

export const loadToCustomerSchema = z.object({
  customer_id: bigIntIdSchema,
  warehouse_id: bigIntIdSchema,
  remark: z.string().max(500).optional(),
  override_credit: z.boolean().optional(),
  override_reason: z.string().max(500).optional(),
  lines: z.array(lineItem).min(1),
});

export const returnFromCustomerSchema = z.object({
  customer_id: bigIntIdSchema,
  warehouse_id: bigIntIdSchema,
  remark: z.string().max(500).optional(),
  lines: z.array(lineItem).min(1),
});
