import { z } from 'zod';
import { paginationSchema } from '../../common/validators/common';

export const employeeCreateSchema = z.object({
  employee_code: z.string().min(1).max(50),
  employee_name: z.string().min(1).max(255),
  mobile_no: z.string().max(50).optional(),
  active_flag: z.boolean().optional(),
});
export const employeeUpdateSchema = employeeCreateSchema.partial();
export const employeeListQuery = paginationSchema.extend({
  q: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});
