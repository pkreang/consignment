import { z } from 'zod';
import { paginationSchema } from '../../common/validators/common';

export const warehouseCreateSchema = z.object({
  warehouse_code: z.string().min(1).max(50),
  warehouse_name: z.string().min(1).max(255),
  active_flag: z.boolean().optional(),
});

export const warehouseUpdateSchema = warehouseCreateSchema.partial();

export const warehouseListQuery = paginationSchema.extend({
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});
