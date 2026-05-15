import { z } from 'zod';
import {
  bigIntIdSchema,
  paginationSchema,
  positiveDecimal,
} from '../../common/validators/common';

export const collectionCreateSchema = z.object({
  customer_id: bigIntIdSchema,
  amount_collected: positiveDecimal,
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'QR_PAYMENT', 'OTHER']),
  reference_no: z.string().max(100).optional(),
  note: z.string().max(2000).optional(),
  collected_by: bigIntIdSchema.optional(),
  collection_date: z.string().datetime().optional(),
});

export const collectionListQuery = paginationSchema.extend({
  customer_id: bigIntIdSchema.optional(),
  visit_id: bigIntIdSchema.optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});
