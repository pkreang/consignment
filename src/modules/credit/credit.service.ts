import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma, Tx } from '../../database/prisma';
import {
  CreditLimitExceededError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/AppError';
import {
  AuthUser,
  hasPermission,
} from '../../common/middleware/auth';
import { writeAuditLog } from '../../database/audit';
import { plus, toDecimal, gt, money } from '../../common/utils/money';
import { notify } from '../../common/notifications';
import { env } from '../../config/env';

export type Exposure = {
  customer_id: string;
  ar_outstanding: string;
  consignment_value: string;
  credit_exposure: string;
  credit_limit: string;
  available_credit: string;
  has_limit: boolean;
};

/**
 * Compute credit exposure inside a transaction. Caller must already have
 * acquired the customer + consignment_stock locks if mutating.
 */
export async function computeExposureTx(
  tx: Tx,
  customer_id: bigint,
): Promise<{
  customer: {
    customer_id: bigint;
    credit_limit: Decimal;
    credit_term_days: number;
  };
  ar_outstanding: Decimal;
  consignment_value: Decimal;
  exposure: Decimal;
}> {
  const customer = await tx.customer.findUnique({
    where: { customer_id },
    select: {
      customer_id: true,
      credit_limit: true,
      credit_term_days: true,
    },
  });
  if (!customer) throw new NotFoundError('Customer not found');

  const arRows = await tx.arInvoice.aggregate({
    where: {
      customer_id,
      status: { in: ['OPEN', 'PARTIAL'] },
    },
    _sum: { outstanding_amount: true },
  });
  const ar_outstanding = toDecimal(arRows._sum.outstanding_amount ?? 0);

  const stockRows = await tx.$queryRaw<{ stock_value: Prisma.Decimal | null }[]>`
    SELECT COALESCE(SUM(cs.qty_on_hand * p.selling_price), 0)::numeric(18,2) AS stock_value
    FROM consignment_stock cs
    JOIN product p ON p.product_id = cs.product_id
    WHERE cs.customer_id = ${customer_id}
  `;
  const consignment_value = toDecimal(stockRows[0]?.stock_value ?? 0);

  return {
    customer: {
      customer_id: customer.customer_id,
      credit_limit: toDecimal(customer.credit_limit),
      credit_term_days: customer.credit_term_days,
    },
    ar_outstanding,
    consignment_value,
    exposure: plus(ar_outstanding, consignment_value),
  };
}

export async function getCustomerExposure(customer_id: bigint): Promise<Exposure> {
  const customer = await prisma.customer.findUnique({
    where: { customer_id },
    select: { credit_limit: true, customer_id: true },
  });
  if (!customer) throw new NotFoundError('Customer not found');

  const arRows = await prisma.arInvoice.aggregate({
    where: { customer_id, status: { in: ['OPEN', 'PARTIAL'] } },
    _sum: { outstanding_amount: true },
  });
  const stockRows = await prisma.$queryRaw<{ stock_value: Prisma.Decimal | null }[]>`
    SELECT COALESCE(SUM(cs.qty_on_hand * p.selling_price), 0)::numeric(18,2) AS stock_value
    FROM consignment_stock cs
    JOIN product p ON p.product_id = cs.product_id
    WHERE cs.customer_id = ${customer_id}
  `;
  const ar_outstanding = toDecimal(arRows._sum.outstanding_amount ?? 0);
  const consignment_value = toDecimal(stockRows[0]?.stock_value ?? 0);
  const limit = toDecimal(customer.credit_limit);
  const exposure = plus(ar_outstanding, consignment_value);
  const available = Decimal.max(limit.minus(exposure), 0);

  return {
    customer_id: customer.customer_id.toString(),
    ar_outstanding: money(ar_outstanding).toFixed(2),
    consignment_value: money(consignment_value).toFixed(2),
    credit_exposure: money(exposure).toFixed(2),
    credit_limit: money(limit).toFixed(2),
    available_credit: money(available).toFixed(2),
    has_limit: limit.gt(0),
  };
}

/**
 * Enforce credit limit for a transaction that will add `additionalValue` to the
 * customer's exposure. Logs an audit record and throws when limit is exceeded
 * unless the caller has the credit.override permission AND requested override.
 */
export async function enforceCreditLimitTx(params: {
  tx: Tx;
  customer_id: bigint;
  additional_value: Decimal | string | number;
  user: AuthUser | undefined;
  override?: { requested: boolean; reason?: string };
  context?: Record<string, unknown>;
}): Promise<{ exposureAfter: Decimal; overridden: boolean }> {
  const { tx, customer_id, user, override, context } = params;
  const exposureSnapshot = await computeExposureTx(tx, customer_id);
  const additional = toDecimal(params.additional_value);
  const exposureAfter = plus(exposureSnapshot.exposure, additional);

  const hasLimit = exposureSnapshot.customer.credit_limit.gt(0);
  if (!hasLimit) {
    return { exposureAfter, overridden: false };
  }

  if (gt(exposureAfter, exposureSnapshot.customer.credit_limit)) {
    if (override?.requested) {
      if (!hasPermission(user, 'credit.override')) {
        throw new ForbiddenError(
          'Credit override requires credit.override permission',
        );
      }
      await writeAuditLog(tx, {
        tableName: 'customer',
        recordId: customer_id,
        action: 'UPDATE',
        oldValue: {
          credit_limit: exposureSnapshot.customer.credit_limit.toFixed(2),
        },
        newValue: {
          override: true,
          reason: override.reason,
          exposure_before: exposureSnapshot.exposure.toFixed(2),
          additional_value: additional.toFixed(2),
          exposure_after: exposureAfter.toFixed(2),
        },
        context: { reason: 'credit_override', ...context },
      });
      notify({
        event: 'credit.override',
        severity: 'critical',
        title: `Credit override for customer ${customer_id}`,
        body: `Override by user ${user?.username ?? 'unknown'}: ${
          override.reason ?? '(no reason)'
        }. limit=${exposureSnapshot.customer.credit_limit.toFixed(2)} projected=${exposureAfter.toFixed(
          2,
        )}`,
        context: {
          customer_id: customer_id.toString(),
          ...context,
        },
      });
      return { exposureAfter, overridden: true };
    }
    notify({
      event: 'credit.limit_exceeded',
      severity: 'critical',
      title: `Credit limit blocked for customer ${customer_id}`,
      body: `Attempted projected exposure ${exposureAfter.toFixed(2)} exceeded limit ${exposureSnapshot.customer.credit_limit.toFixed(2)}`,
      context: { customer_id: customer_id.toString(), ...context },
    });
    throw new CreditLimitExceededError(
      'Customer credit limit would be exceeded',
      {
        credit_limit: exposureSnapshot.customer.credit_limit.toFixed(2),
        current_exposure: exposureSnapshot.exposure.toFixed(2),
        additional_value: additional.toFixed(2),
        projected_exposure: exposureAfter.toFixed(2),
      },
    );
  }

  // Soft warning when usage crosses the configured threshold.
  const thresholdPct = env.CREDIT_ALERT_THRESHOLD_PCT;
  if (thresholdPct > 0) {
    const usagePct = exposureAfter
      .dividedBy(exposureSnapshot.customer.credit_limit)
      .times(100);
    if (usagePct.gte(thresholdPct)) {
      notify({
        event: 'credit.threshold_breach',
        severity: 'warn',
        title: `Credit at ${usagePct.toFixed(0)}% for customer ${customer_id}`,
        body: `Exposure ${exposureAfter.toFixed(2)} of limit ${exposureSnapshot.customer.credit_limit.toFixed(2)} (>= ${thresholdPct}% threshold).`,
        context: { customer_id: customer_id.toString(), ...context },
      });
    }
  }

  return { exposureAfter, overridden: false };
}

// --- Credit policy / history -----------------------------------------------

export async function updateCreditPolicy(
  customer_id: bigint,
  input: { credit_limit?: string; credit_term_days?: number; reason?: string },
  changed_by?: bigint,
) {
  const existing = await prisma.customer.findUnique({
    where: { customer_id },
    select: { credit_limit: true, credit_term_days: true },
  });
  if (!existing) throw new NotFoundError('Customer not found');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { customer_id },
      data: {
        credit_limit:
          input.credit_limit !== undefined ? input.credit_limit : undefined,
        credit_term_days:
          input.credit_term_days !== undefined ? input.credit_term_days : undefined,
      },
    });
    await tx.customerCreditHistory.create({
      data: {
        customer_id,
        old_credit_limit: existing.credit_limit,
        new_credit_limit: updated.credit_limit,
        old_credit_term: existing.credit_term_days,
        new_credit_term: updated.credit_term_days,
        reason: input.reason,
        changed_by,
      },
    });
    return updated;
  });
}

export async function listCreditRiskCustomers(thresholdPct = 80) {
  const rows = await prisma.$queryRaw<
    {
      customer_id: bigint;
      customer_code: string;
      customer_name: string;
      credit_limit: Prisma.Decimal;
      ar_outstanding: Prisma.Decimal;
      consignment_value: Prisma.Decimal;
      credit_exposure: Prisma.Decimal;
    }[]
  >`
    SELECT customer_id, customer_code, customer_name,
           credit_limit,
           ar_outstanding,
           consignment_value,
           credit_exposure
    FROM v_customer_exposure
    WHERE credit_limit > 0
      AND credit_exposure >= credit_limit * ${thresholdPct}::numeric / 100
    ORDER BY credit_exposure DESC
  `;
  return rows.map((r) => ({
    customer_id: r.customer_id.toString(),
    customer_code: r.customer_code,
    customer_name: r.customer_name,
    credit_limit: r.credit_limit.toString(),
    ar_outstanding: r.ar_outstanding.toString(),
    consignment_value: r.consignment_value.toString(),
    credit_exposure: r.credit_exposure.toString(),
    usage_pct: new Decimal(r.credit_exposure)
      .dividedBy(new Decimal(r.credit_limit).gt(0) ? r.credit_limit : 1)
      .times(100)
      .toFixed(2),
  }));
}
