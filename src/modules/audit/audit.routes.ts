import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validate } from '../../common/middleware/validate';
import { paginate, paginationSchema } from '../../common/validators/common';
import { prisma } from '../../database/prisma';

export const auditRouter = Router();
auditRouter.use(authenticate);

const listQuery = paginationSchema.extend({
  table_name: z.string().optional(),
  record_id: z.string().optional(),
  action_type: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
  changed_by: z.string().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

auditRouter.get(
  '/',
  requirePermission('user.read'),
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const where: Record<string, unknown> = {};
    if (q.table_name) where.table_name = q.table_name;
    if (q.record_id) where.record_id = BigInt(q.record_id);
    if (q.action_type) where.action_type = q.action_type;
    if (q.changed_by) where.changed_by = BigInt(q.changed_by);
    if (q.date_from || q.date_to) {
      where.changed_at = {
        gte: q.date_from ? new Date(q.date_from) : undefined,
        lte: q.date_to ? new Date(q.date_to) : undefined,
      };
    }
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { changedBy: { select: { username: true, full_name: true } } },
        orderBy: { changed_at: 'desc' },
        ...paginate(q),
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ data, total, page: q.page, pageSize: q.pageSize });
  }),
);
