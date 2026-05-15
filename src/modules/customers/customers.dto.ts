import { z } from 'zod';
import {
  bigIntIdSchema,
  decimalString,
  nonNegativeDecimal,
  paginationSchema,
} from '../../common/validators/common';

export const customerGroupCreateSchema = z.object({
  group_name: z.string().min(1).max(100),
});
export const customerGroupUpdateSchema = customerGroupCreateSchema.partial();

export const customerCreateSchema = z.object({
  customer_code: z.string().min(1).max(50),
  customer_name: z.string().min(1).max(255),
  group_id: bigIntIdSchema.optional(),
  owner_name: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  line_id: z.string().max(100).optional(),
  address: z.string().optional(),
  province: z.string().max(100).optional(),
  latitude: decimalString.optional(),
  longitude: decimalString.optional(),
  visit_frequency_days: z.coerce.number().int().min(0).default(3),
  max_capacity_qty: nonNegativeDecimal.default('0'),
  credit_term_days: z.coerce.number().int().min(0).default(0),
  credit_limit: nonNegativeDecimal.default('0'),
  active_flag: z.boolean().optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const customerListQuery = paginationSchema.extend({
  q: z.string().optional(),
  group_id: bigIntIdSchema.optional(),
  active: z.enum(['true', 'false']).optional(),
  province: z.string().optional(),
});
