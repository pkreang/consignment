import { InvoiceStatus, PaymentMethod, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma, Tx, withTx } from '../../database/prisma';
import {
  ConflictError,
  InvalidStateError,
  NotFoundError,
} from '../../common/errors/AppError';
import {
  paginate,
  Pagination,
  parseSort,
} from '../../common/validators/common';
import { nextDocNumber } from '../../common/utils/docNumber';
import { min, money, plus, times, toDecimal } from '../../common/utils/money';

export type InvoiceLineInput = {
  product_id: bigint;
  qty: string;
  unit_price: string;
};

function nextStatus(outstanding: Decimal): InvoiceStatus {
  return outstanding.isZero() ? 'PAID' : 'PARTIAL';
}

export async function createInvoiceTx(params: {
  tx: Tx;
  customer_id: bigint;
  visit_id?: bigint | null;
  invoice_date?: Date;
  credit_term_days: number;
  lines: InvoiceLineInput[];
  note?: string | null;
}) {
  const { tx } = params;
  const invoiceDate = params.invoice_date ?? new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + params.credit_term_days);

  let total = new Decimal(0);
  const linesData = params.lines.map((l) => {
    const qty = toDecimal(l.qty);
    const price = toDecimal(l.unit_price);
    const line_amount = money(times(qty, price));
    total = total.plus(line_amount);
    return {
      product_id: l.product_id,
      qty: qty.toFixed(2),
      unit_price: price.toFixed(2),
      line_amount: line_amount.toFixed(2),
    };
  });

  const invoice_no = await nextDocNumber(tx, 'INV', 'seq_invoice_no', invoiceDate);
  const invoice = await tx.arInvoice.create({
    data: {
      invoice_no,
      customer_id: params.customer_id,
      visit_id: params.visit_id ?? null,
      invoice_date: invoiceDate,
      due_date: dueDate,
      total_amount: total.toFixed(2),
      outstanding_amount: total.toFixed(2),
      status: 'OPEN',
      note: params.note ?? null,
      items: { createMany: { data: linesData } },
    },
    include: { items: true },
  });
  return invoice;
}

export async function applyPaymentTx(params: {
  tx: Tx;
  ar_invoice_id: bigint;
  amount: string;
  payment_method: PaymentMethod;
  reference_no?: string | null;
  collection_id?: bigint | null;
  payment_date?: Date;
}) {
  const { tx } = params;
  // Lock invoice row
  await tx.$queryRaw`SELECT ar_invoice_id FROM ar_invoice WHERE ar_invoice_id = ${params.ar_invoice_id} FOR UPDATE`;
  const invoice = await tx.arInvoice.findUnique({
    where: { ar_invoice_id: params.ar_invoice_id },
  });
  if (!invoice) throw new NotFoundError('AR invoice not found');
  if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
    throw new InvalidStateError(
      `Cannot apply payment to ${invoice.status} invoice`,
    );
  }
  const amount = toDecimal(params.amount);
  if (amount.lte(0)) throw new ConflictError('Payment amount must be > 0');
  const outstanding = toDecimal(invoice.outstanding_amount);
  if (amount.gt(outstanding)) {
    throw new ConflictError('Payment exceeds outstanding amount', {
      outstanding: outstanding.toFixed(2),
      requested: amount.toFixed(2),
    });
  }
  const newOutstanding = outstanding.minus(amount);
  await tx.arInvoice.update({
    where: { ar_invoice_id: params.ar_invoice_id },
    data: {
      outstanding_amount: newOutstanding.toFixed(2),
      status: nextStatus(newOutstanding),
    },
  });
  const payment = await tx.arPayment.create({
    data: {
      ar_invoice_id: params.ar_invoice_id,
      payment_amount: amount.toFixed(2),
      payment_method: params.payment_method,
      reference_no: params.reference_no ?? null,
      collection_id: params.collection_id ?? null,
      payment_date: params.payment_date ?? new Date(),
    },
  });
  return { payment, invoice_outstanding: newOutstanding.toFixed(2) };
}

/**
 * Settle FIFO across a customer's open invoices (oldest due date first).
 * Returns the per-invoice allocations actually applied.
 */
export async function settleFifoTx(params: {
  tx: Tx;
  customer_id: bigint;
  amount: string;
  payment_method: PaymentMethod;
  reference_no?: string | null;
  collection_id?: bigint | null;
  payment_date?: Date;
}): Promise<{
  allocations: Array<{ ar_invoice_id: bigint; amount: string }>;
  unapplied: string;
}> {
  const { tx } = params;
  // Lock open invoices in FIFO order
  const invoices = await tx.$queryRaw<
    {
      ar_invoice_id: bigint;
      outstanding_amount: Prisma.Decimal;
      due_date: Date;
    }[]
  >`
    SELECT ar_invoice_id, outstanding_amount, due_date
    FROM ar_invoice
    WHERE customer_id = ${params.customer_id}
      AND status IN ('OPEN', 'PARTIAL')
    ORDER BY due_date ASC, ar_invoice_id ASC
    FOR UPDATE
  `;

  let remaining = toDecimal(params.amount);
  const allocations: Array<{ ar_invoice_id: bigint; amount: string }> = [];
  for (const inv of invoices) {
    if (remaining.lte(0)) break;
    const apply = min(remaining, toDecimal(inv.outstanding_amount));
    if (apply.lte(0)) continue;
    await applyPaymentTx({
      tx,
      ar_invoice_id: inv.ar_invoice_id,
      amount: apply.toFixed(2),
      payment_method: params.payment_method,
      reference_no: params.reference_no ?? null,
      collection_id: params.collection_id ?? null,
      payment_date: params.payment_date,
    });
    allocations.push({
      ar_invoice_id: inv.ar_invoice_id,
      amount: apply.toFixed(2),
    });
    remaining = remaining.minus(apply);
  }
  return { allocations, unapplied: remaining.toFixed(2) };
}

// ---------------------------------------------------------------------------
// Readers / writers
// ---------------------------------------------------------------------------

export async function listInvoices(
  p: Pagination & {
    customer_id?: bigint;
    status?: string;
    overdue_only?: string;
  },
) {
  const where: Prisma.ArInvoiceWhereInput = {};
  if (p.customer_id) where.customer_id = p.customer_id;
  if (p.status) where.status = p.status as InvoiceStatus;
  if (p.overdue_only === 'true') {
    where.status = { in: ['OPEN', 'PARTIAL'] };
    where.due_date = { lt: new Date() };
  }
  const sort = parseSort(p.sort, ['invoice_date', 'due_date', 'total_amount']) ?? {
    field: 'invoice_date',
    order: 'desc',
  };
  const [data, total] = await Promise.all([
    prisma.arInvoice.findMany({
      where,
      include: { customer: true, items: true, payments: true },
      orderBy: { [sort.field]: sort.order },
      ...paginate(p),
    }),
    prisma.arInvoice.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getInvoice(id: bigint) {
  const invoice = await prisma.arInvoice.findUnique({
    where: { ar_invoice_id: id },
    include: {
      customer: true,
      items: { include: { product: true } },
      payments: true,
      visit: true,
    },
  });
  if (!invoice) throw new NotFoundError('AR invoice not found');
  return invoice;
}

export async function createInvoiceManual(input: {
  customer_id: bigint;
  invoice_date?: string;
  credit_term_days?: number;
  lines: InvoiceLineInput[];
  note?: string;
}) {
  const customer = await prisma.customer.findUnique({
    where: { customer_id: input.customer_id },
  });
  if (!customer) throw new NotFoundError('Customer not found');
  return withTx(async (tx) =>
    createInvoiceTx({
      tx,
      customer_id: input.customer_id,
      invoice_date: input.invoice_date ? new Date(input.invoice_date) : undefined,
      credit_term_days: input.credit_term_days ?? customer.credit_term_days,
      lines: input.lines,
      note: input.note,
    }),
  );
}

export async function recordInvoicePayment(
  ar_invoice_id: bigint,
  input: { amount: string; payment_method: PaymentMethod; reference_no?: string },
) {
  return withTx(async (tx) =>
    applyPaymentTx({
      tx,
      ar_invoice_id,
      amount: input.amount,
      payment_method: input.payment_method,
      reference_no: input.reference_no,
    }),
  );
}

export async function getOutstandingByCustomer() {
  const rows = await prisma.$queryRaw<
    {
      customer_id: bigint;
      customer_code: string;
      customer_name: string;
      open_count: number;
      total_outstanding: Prisma.Decimal | null;
    }[]
  >`
    SELECT c.customer_id, c.customer_code, c.customer_name,
           COUNT(i.ar_invoice_id)::int AS open_count,
           COALESCE(SUM(i.outstanding_amount), 0)::numeric(18,2) AS total_outstanding
    FROM customer c
    LEFT JOIN ar_invoice i
      ON i.customer_id = c.customer_id AND i.status IN ('OPEN','PARTIAL')
    GROUP BY c.customer_id
    HAVING COALESCE(SUM(i.outstanding_amount), 0) > 0
    ORDER BY total_outstanding DESC
  `;
  return rows.map((r) => ({
    customer_id: r.customer_id.toString(),
    customer_code: r.customer_code,
    customer_name: r.customer_name,
    open_count: r.open_count,
    total_outstanding: (r.total_outstanding ?? new Decimal(0)).toString(),
  }));
}

export async function getAgingReport(p: { customer_id?: bigint }) {
  const where: Prisma.Sql = p.customer_id
    ? Prisma.sql`WHERE i.customer_id = ${p.customer_id}`
    : Prisma.sql``;
  const rows = await prisma.$queryRaw<
    {
      ar_invoice_id: bigint;
      invoice_no: string;
      customer_id: bigint;
      customer_code: string;
      customer_name: string;
      invoice_date: Date;
      due_date: Date;
      total_amount: Prisma.Decimal;
      outstanding_amount: Prisma.Decimal;
      status: string;
      effective_status: string;
      days_overdue: number;
      aging_bucket: string;
    }[]
  >`SELECT i.ar_invoice_id, i.invoice_no, i.customer_id, i.customer_code,
            i.customer_name, i.invoice_date, i.due_date, i.total_amount,
            i.outstanding_amount, i.status, i.effective_status, i.days_overdue,
            i.aging_bucket
     FROM v_ar_aging i
     ${where}
     ORDER BY i.due_date ASC`;
  // bucket summary
  const summary: Record<string, { count: number; amount: Decimal }> = {
    CURRENT: { count: 0, amount: new Decimal(0) },
    '1_30': { count: 0, amount: new Decimal(0) },
    '31_60': { count: 0, amount: new Decimal(0) },
    '61_90': { count: 0, amount: new Decimal(0) },
    OVER_90: { count: 0, amount: new Decimal(0) },
  };
  for (const r of rows) {
    if (r.status === 'PAID' || r.status === 'CANCELLED') continue;
    const b = summary[r.aging_bucket];
    if (!b) continue;
    b.count += 1;
    b.amount = b.amount.plus(toDecimal(r.outstanding_amount));
  }
  return {
    invoices: rows.map((r) => ({
      ar_invoice_id: r.ar_invoice_id.toString(),
      invoice_no: r.invoice_no,
      customer_id: r.customer_id.toString(),
      customer_code: r.customer_code,
      customer_name: r.customer_name,
      invoice_date: r.invoice_date,
      due_date: r.due_date,
      total_amount: r.total_amount.toString(),
      outstanding_amount: r.outstanding_amount.toString(),
      status: r.status,
      effective_status: r.effective_status,
      days_overdue: r.days_overdue,
      aging_bucket: r.aging_bucket,
    })),
    summary: Object.fromEntries(
      Object.entries(summary).map(([k, v]) => [
        k,
        { count: v.count, amount: v.amount.toFixed(2) },
      ]),
    ),
  };
}

export { plus };
