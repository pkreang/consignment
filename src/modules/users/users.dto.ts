import { z } from 'zod';
import {
  bigIntIdSchema,
  paginationSchema,
} from '../../common/validators/common';

export const userCreateSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(8).max(200),
  full_name: z.string().max(255).optional(),
  employee_id: bigIntIdSchema.optional(),
  role_id: bigIntIdSchema.optional(),
  active_flag: z.boolean().optional(),
});

export const userUpdateSchema = z.object({
  full_name: z.string().max(255).optional(),
  employee_id: bigIntIdSchema.optional(),
  role_id: bigIntIdSchema.optional(),
  active_flag: z.boolean().optional(),
});

export const passwordChangeSchema = z.object({
  password: z.string().min(8).max(200),
});

export const userListQuery = paginationSchema.extend({
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});
