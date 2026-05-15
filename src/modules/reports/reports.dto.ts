import { z } from 'zod';

export const rangeQuery = z.object({
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

export const rangeWithLimit = rangeQuery.extend({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const deadStockQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export const productionPlanningQuery = rangeQuery.extend({
  lead_time_days: z.coerce.number().int().min(1).max(180).optional(),
});
