import { z } from 'zod';
import {
  bigIntIdSchema,
  paginationSchema,
} from '../../common/validators/common';

export const roleCreateSchema = z.object({
  role_name: z.string().min(1).max(100),
});
export const roleUpdateSchema = roleCreateSchema.partial();
export const rolePermissionsSchema = z.object({
  permission_ids: z.array(bigIntIdSchema).min(0),
});

export const permissionListQuery = paginationSchema.extend({
  module: z.string().optional(),
  q: z.string().optional(),
});
