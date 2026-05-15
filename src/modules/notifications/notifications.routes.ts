import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validate } from '../../common/middleware/validate';
import { configuredProviders, notify } from '../../common/notifications';
import { prisma } from '../../database/prisma';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/providers',
  requirePermission('report.read'),
  asyncHandler(async (_req, res) => res.json({ providers: configuredProviders() })),
);

const testSchema = z.object({
  title: z.string().min(1).max(120).default('test notification'),
  body: z.string().min(1).max(2000).default('hello from consignment-erp'),
  severity: z.enum(['info', 'warn', 'critical']).default('info'),
});

notificationsRouter.post(
  '/test',
  requirePermission('report.read'),
  validate({ body: testSchema }),
  asyncHandler(async (req, res) => {
    notify({
      event: 'manual.test',
      severity: req.body.severity,
      title: req.body.title,
      body: req.body.body,
    });
    res.json({ ok: true, providers: configuredProviders() });
  }),
);

/**
 * Scan open AR invoices that are past their due date and dispatch a single
 * grouped alert per customer. The scan never mutates anything — it just
 * reports. Operators can cron `curl ...` against this endpoint daily.
 */
notificationsRouter.post(
  '/ar-overdue-scan',
  requirePermission('ar.read'),
  asyncHandler(async (_req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = await prisma.arInvoice.findMany({
      where: {
        status: { in: ['OPEN', 'PARTIAL'] },
        due_date: { lt: today },
        outstanding_amount: { gt: 0 },
      },
      include: { customer: true },
      orderBy: { due_date: 'asc' },
    });

    const byCustomer = new Map<
      string,
      { name: string; code: string; count: number; total: number; oldest: Date }
    >();
    for (const inv of overdue) {
      const k = inv.customer_id.toString();
      const cur =
        byCustomer.get(k) ??
        {
          name: inv.customer.customer_name,
          code: inv.customer.customer_code,
          count: 0,
          total: 0,
          oldest: inv.due_date,
        };
      cur.count += 1;
      cur.total += Number(inv.outstanding_amount);
      if (inv.due_date < cur.oldest) cur.oldest = inv.due_date;
      byCustomer.set(k, cur);
    }

    for (const [id, info] of byCustomer.entries()) {
      const daysOld = Math.max(
        0,
        Math.round((today.getTime() - info.oldest.getTime()) / 86_400_000),
      );
      notify({
        event: 'ar.overdue',
        severity: daysOld >= 30 ? 'critical' : 'warn',
        title: `AR overdue: ${info.code} ${info.name}`,
        body: `${info.count} invoice(s) overdue, oldest ${daysOld} days. Total outstanding ${info.total.toFixed(2)} THB.`,
        context: { customer_id: id, days_oldest: daysOld },
      });
    }

    res.json({
      scanned: overdue.length,
      customers_alerted: byCustomer.size,
      providers: configuredProviders(),
    });
  }),
);
