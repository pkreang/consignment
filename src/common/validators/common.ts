import { z } from 'zod';
import { env } from '../../config/env';

export const bigIntIdSchema = z.union([z.string(), z.number()]).transform(
  (val, ctx) => {
    try {
      const s = String(val).trim();
      if (!/^\d+$/.test(s)) throw new Error('not numeric');
      return BigInt(s);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'must be a positive integer id',
      });
      return z.NEVER;
    }
  },
);

export const idParamSchema = z.object({
  id: bigIntIdSchema,
});

export const decimalString = z.union([z.string(), z.number()]).transform(
  (val, ctx) => {
    const s = String(val);
    if (!/^-?\d+(\.\d+)?$/.test(s)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'must be a decimal number',
      });
      return z.NEVER;
    }
    return s;
  },
);

export const positiveDecimal = decimalString.refine(
  (v) => Number(v) > 0,
  'must be greater than zero',
);

export const nonNegativeDecimal = decimalString.refine(
  (v) => Number(v) >= 0,
  'must be greater than or equal to zero',
);

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(env.PAGINATION_MAX_PAGE_SIZE)
    .default(env.PAGINATION_DEFAULT_PAGE_SIZE),
  sort: z.string().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function paginate(p: Pagination) {
  return {
    skip: (p.page - 1) * p.pageSize,
    take: p.pageSize,
  };
}

export function parseSort(
  sort: string | undefined,
  allowed: string[],
): { field: string; order: 'asc' | 'desc' } | undefined {
  if (!sort) return undefined;
  const [field, order] = sort.split(':');
  if (!field || !allowed.includes(field)) return undefined;
  return { field, order: order === 'desc' ? 'desc' : 'asc' };
}
