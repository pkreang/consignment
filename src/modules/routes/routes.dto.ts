import { z } from 'zod';
import {
  bigIntIdSchema,
  paginationSchema,
} from '../../common/validators/common';

export const routeCreateSchema = z.object({
  route_code: z.string().min(1).max(50),
  route_name: z.string().min(1).max(255),
  active_flag: z.boolean().optional(),
});
export const routeUpdateSchema = routeCreateSchema.partial();
export const routeListQuery = paginationSchema.extend({
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});

export const customerRouteCreateSchema = z.object({
  customer_id: bigIntIdSchema,
  route_id: bigIntIdSchema,
  visit_day: z.string().max(20).optional(),
});
export const customerRouteListQuery = paginationSchema.extend({
  customer_id: bigIntIdSchema.optional(),
  route_id: bigIntIdSchema.optional(),
});
