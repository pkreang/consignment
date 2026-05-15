import { z } from 'zod';
import {
  bigIntIdSchema,
  nonNegativeDecimal,
  positiveDecimal,
} from '../../common/validators/common';

export const validateCreditSchema = z.object({
  additional_value: positiveDecimal.optional(),
  lines: z
    .array(
      z.object({
        product_id: bigIntIdSchema,
        qty: positiveDecimal,
        unit_price: nonNegativeDecimal.optional(),
      }),
    )
    .optional(),
});

export const policyUpdateSchema = z.object({
  credit_limit: nonNegativeDecimal.optional(),
  credit_term_days: z.coerce.number().int().min(0).optional(),
  reason: z.string().max(2000).optional(),
});

export const creditRiskQuery = z.object({
  threshold_pct: z.coerce.number().int().min(0).max(100).optional(),
});
