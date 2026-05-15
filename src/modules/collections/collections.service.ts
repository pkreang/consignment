import { PaymentMethod, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma, Tx, withTx } from '../../database/prisma';
import {
  ConflictError,
  NotFoundError,
} from '../../common/errors/AppError';
import {
  paginate,
  Pagination,
  parseSort,
} from '../../common/validators/common';
import { nextDocNumber } from '../../common/utils/docNumber';
import { settleFifoTx } from '../ar/ar.service';
import { toDecimal } from '../../common/utils/money';

export type CollectionCreateInput = {
  customer_id: bigint;
  amount_collected: string;
  payment_method: PaymentMethod;
  reference_no?: string;
  note?: string;
  collected_by?: bigint;
  collection_date?: string;
};

export async function createCollectionTx(params: {
  tx: Tx;
  customer_id: bigint;
  visit_id?: bigint | null;
  ar_invoice_id?: bigint | null;
  total_sales_amount?: string;
  amount_collected: string;
  payment_method: PaymentMethod;
  reference_no?: string | null;
  collected_by?: bigint | null;
  note?: string | null;
  collection_date?: Date;
}) {
  const { tx } = params;
  const collection_no = await nextDocNumber(
    tx,
    'COL',
    'seq_collection_no',
    params.collection_date ?? new Date(),
  );
  return tx.collection.create({
    data: {
      collection_no,
      customer_id: params.customer_id,
      visit_id: params.visit_id ?? null,
      ar_invoice_id: params.ar_invoice_id ?? null,
      collection_date: params.collection_date ?? new Date(),
      total_sales_amount: params.total_sales_amount ?? '0',
      amount_collected: params.amount_collected,
      payment_method: params.payment_method,
      reference_no: params.reference_no ?? null,
      collected_by: params.collected_by ?? null,
      note: params.note ?? null,
    },
  });
}

/**
 * Standalone collection from a customer: applies the cash to outstanding
 * AR invoices in FIFO order, then records the collection summary.
 */
export async function createCollection(input: CollectionCreateInput) {
  const customer = await prisma.customer.findUnique({
    where: { customer_id: input.customer_id },
  });
  if (!customer) throw new NotFoundError('Customer not found');

  const amount = toDecimal(input.amount_collected);
  if (amount.lte(0)) throw new ConflictError('amount_collected must be > 0');

  return withTx(async (tx) => {
    const collection = await createCollectionTx({
      tx,
      customer_id: input.customer_id,
      amount_collected: amount.toFixed(2),
      payment_method: input.payment_method,
      reference_no: input.reference_no,
      note: input.note,
      collected_by: input.collected_by,
      collection_date: input.collection_date
        ? new Date(input.collection_date)
        : undefined,
    });
    const { allocations, unapplied } = await settleFifoTx({
      tx,
      customer_id: input.customer_id,
      amount: amount.toFixed(2),
      payment_method: input.payment_method,
      reference_no: input.reference_no,
      collection_id: collection.collection_id,
    });
    if (new Decimal(unapplied).gt(0)) {
      throw new ConflictError(
        'Collection amount exceeds total outstanding AR for this customer',
        { unapplied },
      );
    }
    return { collection, allocations };
  });
}

export async function listCollections(
  p: Pagination & {
    customer_id?: bigint;
    visit_id?: bigint;
    date_from?: string;
    date_to?: string;
  },
) {
  const where: Prisma.CollectionWhereInput = {};
  if (p.customer_id) where.customer_id = p.customer_id;
  if (p.visit_id) where.visit_id = p.visit_id;
  if (p.date_from || p.date_to) {
    where.collection_date = {
      gte: p.date_from ? new Date(p.date_from) : undefined,
      lte: p.date_to ? new Date(p.date_to) : undefined,
    };
  }
  const sort = parseSort(p.sort, ['collection_date']) ?? {
    field: 'collection_date',
    order: 'desc',
  };
  const [data, total] = await Promise.all([
    prisma.collection.findMany({
      where,
      include: { customer: true, collector: true, arInvoice: true },
      orderBy: { [sort.field]: sort.order },
      ...paginate(p),
    }),
    prisma.collection.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getCollection(id: bigint) {
  const r = await prisma.collection.findUnique({
    where: { collection_id: id },
    include: { customer: true, collector: true, arInvoice: true, visit: true },
  });
  if (!r) throw new NotFoundError('Collection not found');
  return r;
}
