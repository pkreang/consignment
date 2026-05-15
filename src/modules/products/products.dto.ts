import { z } from 'zod';
import {
  bigIntIdSchema,
  nonNegativeDecimal,
  paginationSchema,
} from '../../common/validators/common';

export const productCategoryCreateSchema = z.object({
  category_code: z.string().min(1).max(20),
  category_name: z.string().min(1).max(100),
  active_flag: z.boolean().optional(),
});

export const productCategoryUpdateSchema = productCategoryCreateSchema.partial();

export const productCreateSchema = z.object({
  sku_code: z.string().min(1).max(50),
  barcode: z.string().max(100).optional(),
  product_name: z.string().min(1).max(255),
  category_id: bigIntIdSchema.optional(),
  unit: z.string().max(20).default('PCS'),
  cost: nonNegativeDecimal.default('0'),
  selling_price: nonNegativeDecimal.default('0'),
  shelf_life_days: z.coerce.number().int().min(0).default(0),
  min_stock: nonNegativeDecimal.default('0'),
  max_stock: nonNegativeDecimal.default('0'),
  active_flag: z.boolean().optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productListQuery = paginationSchema.extend({
  q: z.string().optional(),
  category_id: bigIntIdSchema.optional(),
  active: z.enum(['true', 'false']).optional(),
});
