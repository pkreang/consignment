import {
  PaymentMethod,
  Prisma,
  VisitStatus,
} from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma, withTx } from '../../database/prisma';
import {
  ConflictError,
  ForbiddenError,
  InsufficientStockError,
  InvalidStateError,
  NotFoundError,
} from '../../common/errors/AppError';
import { AuthUser } from '../../common/middleware/auth';
import {
  paginate,
  Pagination,
  parseSort,
} from '../../common/validators/common';
import { nextDocNumber } from '../../common/utils/docNumber';
import {
  enforceCreditLimitTx,
} from '../credit/credit.service';
import {
  applyConsignmentDelta,
  applyWarehouseDelta,
  lockOrCreateConsignmentStock,
} from '../inventory/inventory.service';
import {
  applyConsignmentLotDelta,
  applyWarehouseLotDelta,
  pickConsignmentLotsFEFO,
  pickWarehouseLotsFEFO,
  recordLotConsumption,
} from '../inventory/lot.service';
import { createCollectionTx } from '../collections/collections.service';
import { applyPaymentTx, createInvoiceTx } from '../ar/ar.service';
import { money, plus, times, toDecimal } from '../../common/utils/money';
import { writeAuditLog } from '../../database/audit';

// ---------------------------------------------------------------------------
// Visit creation & lifecycle (DRAFT -> CHECKED_IN -> COUNTED -> CONFIRMED)
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  DRAFT: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['COUNTED', 'CONFIRMED', 'CANCELLED'],
  COUNTED: ['COUNTED', 'CONFIRMED', 'CANCELLED'],
  CONFIRMED: [],
  CANCELLED: [],
};

function assertCanTransition(from: VisitStatus, to: VisitStatus) {
  if (!TRANSITIONS[from].includes(to)) {
    throw new InvalidStateError(
      `Cannot transition visit from ${from} to ${to}`,
    );
  }
}

export async function createVisit(
  input: {
    customer_id: bigint;
    employee_id?: bigint;
    route_id?: bigint;
    visit_date?: string;
    note?: string;
  },
  user: AuthUser | undefined,
) {
  const customer = await prisma.customer.findUnique({
    where: { customer_id: input.customer_id },
  });
  if (!customer) throw new NotFoundError('Customer not found');
  if (!customer.active_flag) throw new ConflictError('Customer is inactive');

  const employeeId = input.employee_id ?? user?.employeeId;
  if (!employeeId) {
    throw new ConflictError(
      'employee_id is required (or your user must be linked to an employee)',
    );
  }

  return withTx(async (tx) => {
    const visit_no = await nextDocNumber(tx, 'VST', 'seq_visit_no');
    return tx.salesVisit.create({
      data: {
        visit_no,
        customer_id: input.customer_id,
        employee_id: employeeId,
        route_id: input.route_id ?? null,
        visit_date: input.visit_date ? new Date(input.visit_date) : new Date(),
        note: input.note ?? null,
        visit_status: 'DRAFT',
      },
    });
  });
}

export async function checkIn(
  visit_id: bigint,
  input: {
    gps_latitude?: string;
    gps_longitude?: string;
    photo_url?: string;
  },
) {
  return withTx(async (tx) => {
    const visit = await tx.salesVisit.findUnique({ where: { visit_id } });
    if (!visit) throw new NotFoundError('Sales visit not found');
    assertCanTransition(visit.visit_status, 'CHECKED_IN');
    return tx.salesVisit.update({
      where: { visit_id },
      data: {
        visit_status: 'CHECKED_IN',
        checkin_time: new Date(),
        gps_latitude: input.gps_latitude,
        gps_longitude: input.gps_longitude,
        photo_url: input.photo_url ?? visit.photo_url,
      },
    });
  });
}

export async function checkOut(
  visit_id: bigint,
  input: { photo_url?: string; note?: string },
) {
  return withTx(async (tx) => {
    const visit = await tx.salesVisit.findUnique({ where: { visit_id } });
    if (!visit) throw new NotFoundError('Sales visit not found');
    if (visit.visit_status === 'CANCELLED') {
      throw new InvalidStateError('Cannot check out a cancelled visit');
    }
    return tx.salesVisit.update({
      where: { visit_id },
      data: {
        checkout_time: new Date(),
        photo_url: input.photo_url ?? visit.photo_url,
        note: input.note ?? visit.note,
      },
    });
  });
}

export async function cancelVisit(visit_id: bigint) {
  return withTx(async (tx) => {
    const visit = await tx.salesVisit.findUnique({ where: { visit_id } });
    if (!visit) throw new NotFoundError('Sales visit not found');
    if (visit.visit_status === 'CONFIRMED') {
      throw new InvalidStateError('Cannot cancel a confirmed visit');
    }
    return tx.salesVisit.update({
      where: { visit_id },
      data: { visit_status: 'CANCELLED' },
    });
  });
}

// ---------------------------------------------------------------------------
// Record items (no stock side effects yet)
// ---------------------------------------------------------------------------

export async function recordItems(
  visit_id: bigint,
  items: Array<{
    product_id: bigint;
    qty_counted: string;
    qty_replenished?: string;
    unit_price?: string;
  }>,
) {
  return withTx(async (tx) => {
    const visit = await tx.salesVisit.findUnique({ where: { visit_id } });
    if (!visit) throw new NotFoundError('Sales visit not found');
    if (!['CHECKED_IN', 'COUNTED'].includes(visit.visit_status)) {
      throw new InvalidStateError(
        `Cannot record items in ${visit.visit_status} visit (must be CHECKED_IN or COUNTED)`,
      );
    }

    const productIds = items.map((i) => i.product_id);
    const products = await tx.product.findMany({
      where: { product_id: { in: productIds } },
      select: { product_id: true, selling_price: true },
    });
    const priceMap = new Map(
      products.map((p) => [p.product_id.toString(), toDecimal(p.selling_price)]),
    );

    // Replace items for this visit (idempotent recording).
    for (const item of items) {
      const product_id = item.product_id;
      const price = item.unit_price
        ? toDecimal(item.unit_price)
        : priceMap.get(product_id.toString());
      if (!price) {
        throw new NotFoundError(`Product ${product_id} not found`);
      }

      const cs = await tx.consignmentStock.findUnique({
        where: {
          customer_id_product_id: {
            customer_id: visit.customer_id,
            product_id,
          },
        },
      });
      const qtyBefore = cs ? toDecimal(cs.qty_on_hand) : new Decimal(0);
      const qtyCounted = toDecimal(item.qty_counted);
      if (qtyCounted.gt(qtyBefore)) {
        throw new ConflictError(
          'qty_counted cannot exceed qty_before (current consignment balance). Use a CUSTOMER_ADJUSTMENT instead.',
          {
            product_id: product_id.toString(),
            qty_before: qtyBefore.toFixed(2),
            qty_counted: qtyCounted.toFixed(2),
          },
        );
      }
      const qtySold = qtyBefore.minus(qtyCounted);
      const salesAmount = money(times(qtySold, price));

      await tx.salesVisitItem.upsert({
        where: { visit_id_product_id: { visit_id, product_id } },
        update: {
          qty_before: qtyBefore.toFixed(2),
          qty_counted: qtyCounted.toFixed(2),
          qty_sold: qtySold.toFixed(2),
          qty_replenished: toDecimal(item.qty_replenished ?? '0').toFixed(2),
          unit_price: price.toFixed(2),
          sales_amount: salesAmount.toFixed(2),
        },
        create: {
          visit_id,
          product_id,
          qty_before: qtyBefore.toFixed(2),
          qty_counted: qtyCounted.toFixed(2),
          qty_sold: qtySold.toFixed(2),
          qty_replenished: toDecimal(item.qty_replenished ?? '0').toFixed(2),
          unit_price: price.toFixed(2),
          sales_amount: salesAmount.toFixed(2),
        },
      });
    }

    await tx.salesVisit.update({
      where: { visit_id },
      data: { visit_status: 'COUNTED' },
    });

    return tx.salesVisit.findUnique({
      where: { visit_id },
      include: { items: true },
    });
  });
}

// ---------------------------------------------------------------------------
// Confirm: the atomic financial commit
// ---------------------------------------------------------------------------

export async function confirmVisit(
  visit_id: bigint,
  input: {
    warehouse_id?: bigint;
    payment_method?: PaymentMethod;
    amount_collected?: string;
    reference_no?: string;
    override_credit?: boolean;
    override_reason?: string;
  },
  user: AuthUser | undefined,
) {
  if (!user) throw new ForbiddenError('Authentication required');
  return withTx(async (tx) => {
    // ----- 0. Load + lock visit, customer -----
    await tx.$queryRaw`SELECT visit_id FROM sales_visit WHERE visit_id = ${visit_id} FOR UPDATE`;
    const visit = await tx.salesVisit.findUnique({
      where: { visit_id },
      include: { items: { include: { product: true } } },
    });
    if (!visit) throw new NotFoundError('Sales visit not found');
    if (!['CHECKED_IN', 'COUNTED'].includes(visit.visit_status)) {
      throw new InvalidStateError(
        `Visit must be CHECKED_IN or COUNTED to confirm (currently ${visit.visit_status})`,
      );
    }

    await tx.$queryRaw`SELECT customer_id FROM customer WHERE customer_id = ${visit.customer_id} FOR UPDATE`;
    const customer = await tx.customer.findUnique({
      where: { customer_id: visit.customer_id },
    });
    if (!customer) throw new NotFoundError('Customer not found');

    if (visit.items.length === 0) {
      throw new ConflictError(
        'Visit has no recorded items; cannot confirm',
      );
    }

    // ----- 1. Recompute per-item math under locks and apply SALE_CONFIRMED -----
    let total_sales = new Decimal(0);
    const recomputedItems: Array<{
      product_id: bigint;
      qty_counted: Decimal;
      qty_sold: Decimal;
      qty_replenished: Decimal;
      unit_price: Decimal;
      sales_amount: Decimal;
    }> = [];

    for (const item of visit.items) {
      const cs = await lockOrCreateConsignmentStock(
        tx,
        visit.customer_id,
        item.product_id,
      );
      const qtyBefore = cs.qty_on_hand;
      const qtyCounted = toDecimal(item.qty_counted);
      const qtyReplenished = toDecimal(item.qty_replenished);
      const unitPrice = toDecimal(item.unit_price);
      if (qtyCounted.gt(qtyBefore)) {
        throw new InsufficientStockError(
          'Counted quantity exceeds current consignment balance; create a CUSTOMER_ADJUSTMENT first',
          {
            product_id: item.product_id.toString(),
            qty_before_locked: qtyBefore.toFixed(2),
            qty_counted: qtyCounted.toFixed(2),
          },
        );
      }
      const qtySold = qtyBefore.minus(qtyCounted);
      const salesAmount = money(times(qtySold, unitPrice));
      total_sales = total_sales.plus(salesAmount);

      // Update item snapshot to recomputed values
      await tx.salesVisitItem.update({
        where: { visit_item_id: item.visit_item_id },
        data: {
          qty_before: qtyBefore.toFixed(2),
          qty_sold: qtySold.toFixed(2),
          sales_amount: salesAmount.toFixed(2),
        },
      });

      // 1a. SALE_CONFIRMED — FEFO-decrement customer lots first, then the aggregate
      if (qtySold.gt(0)) {
        const picks = await pickConsignmentLotsFEFO(tx, {
          customer_id: visit.customer_id,
          product_id: item.product_id,
          qty: qtySold,
        });
        for (const pick of picks) {
          if (pick.lot_id !== null) {
            await applyConsignmentLotDelta(tx, {
              customer_id: visit.customer_id,
              lot_id: pick.lot_id,
              delta: pick.qty.negated(),
            });
            await recordLotConsumption(tx, { lot_id: pick.lot_id, qty: pick.qty });
          }
          await applyConsignmentDelta({
            tx,
            customer_id: visit.customer_id,
            product_id: item.product_id,
            delta: pick.qty.negated(),
            movement_type: 'SALE_CONFIRMED',
            ref_doc_type: 'VISIT',
            ref_doc_id: visit_id,
            unit_price: unitPrice.toFixed(2),
            unit_cost: toDecimal(item.product.cost).toFixed(2),
            remark: `Visit ${visit.visit_no}`,
            created_by: user.employeeId ?? null,
            lot_id: pick.lot_id,
          });
        }
      }
      recomputedItems.push({
        product_id: item.product_id,
        qty_counted: qtyCounted,
        qty_sold: qtySold,
        qty_replenished: qtyReplenished,
        unit_price: unitPrice,
        sales_amount: salesAmount,
      });
    }

    // ----- 2. Replenishment (credit-checked before any movement) -----
    const replenishLines = recomputedItems.filter((r) => r.qty_replenished.gt(0));
    if (replenishLines.length > 0) {
      if (!input.warehouse_id) {
        throw new ConflictError(
          'warehouse_id is required when any line has qty_replenished > 0',
        );
      }

      // Lock warehouse balances for the products being replenished so credit check is consistent.
      // (apply functions lock internally, but we pre-acquire to fail early.)
      const additional = replenishLines.reduce(
        (s, l) =>
          s.plus(
            l.qty_replenished.times(
              // Replenish uses customer-facing selling_price = unit_price snapshot
              l.unit_price,
            ),
          ),
        new Decimal(0),
      );

      await enforceCreditLimitTx({
        tx,
        customer_id: visit.customer_id,
        additional_value: additional,
        user,
        override: input.override_credit
          ? { requested: true, reason: input.override_reason }
          : undefined,
        context: {
          action: 'visit_replenishment',
          visit_id: visit_id.toString(),
        },
      });

      for (const l of replenishLines) {
        const picks = await pickWarehouseLotsFEFO(tx, {
          warehouse_id: input.warehouse_id,
          product_id: l.product_id,
          qty: l.qty_replenished,
        });
        for (const pick of picks) {
          if (pick.lot_id !== null) {
            await applyWarehouseLotDelta(tx, {
              warehouse_id: input.warehouse_id,
              lot_id: pick.lot_id,
              delta: pick.qty.negated(),
            });
            await recordLotConsumption(tx, { lot_id: pick.lot_id, qty: pick.qty });
            await applyConsignmentLotDelta(tx, {
              customer_id: visit.customer_id,
              lot_id: pick.lot_id,
              delta: pick.qty,
            });
          }
          await applyWarehouseDelta({
            tx,
            warehouse_id: input.warehouse_id,
            product_id: l.product_id,
            delta: pick.qty.negated(),
            movement_type: 'REPLENISHMENT',
            ref_doc_type: 'REPLENISH',
            ref_doc_id: visit_id,
            unit_price: l.unit_price.toFixed(2),
            remark: `Visit ${visit.visit_no}`,
            created_by: user.employeeId ?? null,
            lot_id: pick.lot_id,
          });
          await applyConsignmentDelta({
            tx,
            customer_id: visit.customer_id,
            product_id: l.product_id,
            delta: pick.qty,
            movement_type: 'REPLENISHMENT',
            ref_doc_type: 'REPLENISH',
            ref_doc_id: visit_id,
            unit_price: l.unit_price.toFixed(2),
            remark: `Visit ${visit.visit_no}`,
            created_by: user.employeeId ?? null,
            lot_id: pick.lot_id,
          });
        }
      }
    }

    // ----- 3. Money routing -----
    let arInvoiceId: bigint | null = null;
    let collectionId: bigint | null = null;
    const amountCollected = toDecimal(input.amount_collected ?? '0');

    if (total_sales.gt(0)) {
      if (customer.credit_term_days === 0) {
        // COD: require full collection.
        if (!input.payment_method) {
          throw new ConflictError(
            'payment_method is required for COD customer',
          );
        }
        if (!amountCollected.eq(total_sales)) {
          throw new ConflictError(
            'COD customer requires amount_collected to equal total_sales',
            {
              total_sales: total_sales.toFixed(2),
              amount_collected: amountCollected.toFixed(2),
            },
          );
        }
        const collection = await createCollectionTx({
          tx,
          customer_id: visit.customer_id,
          visit_id,
          total_sales_amount: total_sales.toFixed(2),
          amount_collected: amountCollected.toFixed(2),
          payment_method: input.payment_method,
          reference_no: input.reference_no,
          collected_by: visit.employee_id,
        });
        collectionId = collection.collection_id;
      } else {
        // Credit term: create AR invoice for full sale.
        const invoice = await createInvoiceTx({
          tx,
          customer_id: visit.customer_id,
          visit_id,
          credit_term_days: customer.credit_term_days,
          lines: recomputedItems
            .filter((r) => r.qty_sold.gt(0))
            .map((r) => ({
              product_id: r.product_id,
              qty: r.qty_sold.toFixed(2),
              unit_price: r.unit_price.toFixed(2),
            })),
        });
        arInvoiceId = invoice.ar_invoice_id;

        // Optional partial cash at visit time.
        if (amountCollected.gt(0)) {
          if (!input.payment_method) {
            throw new ConflictError(
              'payment_method is required when amount_collected > 0',
            );
          }
          if (amountCollected.gt(total_sales)) {
            throw new ConflictError(
              'amount_collected exceeds total_sales',
              {
                total_sales: total_sales.toFixed(2),
                amount_collected: amountCollected.toFixed(2),
              },
            );
          }
          const collection = await createCollectionTx({
            tx,
            customer_id: visit.customer_id,
            visit_id,
            ar_invoice_id: invoice.ar_invoice_id,
            total_sales_amount: total_sales.toFixed(2),
            amount_collected: amountCollected.toFixed(2),
            payment_method: input.payment_method,
            reference_no: input.reference_no,
            collected_by: visit.employee_id,
          });
          collectionId = collection.collection_id;
          await applyPaymentTx({
            tx,
            ar_invoice_id: invoice.ar_invoice_id,
            amount: amountCollected.toFixed(2),
            payment_method: input.payment_method,
            reference_no: input.reference_no,
            collection_id: collection.collection_id,
          });
        }
      }
    } else if (amountCollected.gt(0)) {
      // No sales but cash was collected (e.g. paying down old debt). Settle FIFO.
      if (!input.payment_method) {
        throw new ConflictError(
          'payment_method is required when amount_collected > 0',
        );
      }
      const collection = await createCollectionTx({
        tx,
        customer_id: visit.customer_id,
        visit_id,
        total_sales_amount: '0',
        amount_collected: amountCollected.toFixed(2),
        payment_method: input.payment_method,
        reference_no: input.reference_no,
        collected_by: visit.employee_id,
      });
      collectionId = collection.collection_id;
      // FIFO settlement is done inline (similar to standalone collection).
      // For simplicity, route through ar.service.settleFifoTx.
      const { settleFifoTx } = await import('../ar/ar.service');
      await settleFifoTx({
        tx,
        customer_id: visit.customer_id,
        amount: amountCollected.toFixed(2),
        payment_method: input.payment_method,
        reference_no: input.reference_no,
        collection_id: collection.collection_id,
      });
    }

    // ----- 4. Finalize visit -----
    const updated = await tx.salesVisit.update({
      where: { visit_id },
      data: {
        visit_status: 'CONFIRMED',
        total_sales_amount: total_sales.toFixed(2),
      },
      include: { items: true },
    });

    await writeAuditLog(tx, {
      tableName: 'sales_visit',
      recordId: visit_id,
      action: 'UPDATE',
      newValue: {
        visit_status: 'CONFIRMED',
        total_sales_amount: total_sales.toFixed(2),
        ar_invoice_id: arInvoiceId?.toString() ?? null,
        collection_id: collectionId?.toString() ?? null,
      },
    });

    return {
      visit: updated,
      total_sales_amount: total_sales.toFixed(2),
      ar_invoice_id: arInvoiceId?.toString() ?? null,
      collection_id: collectionId?.toString() ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

export async function listVisits(
  p: Pagination & {
    customer_id?: bigint;
    employee_id?: bigint;
    route_id?: bigint;
    status?: string;
    date_from?: string;
    date_to?: string;
  },
) {
  const where: Prisma.SalesVisitWhereInput = {};
  if (p.customer_id) where.customer_id = p.customer_id;
  if (p.employee_id) where.employee_id = p.employee_id;
  if (p.route_id) where.route_id = p.route_id;
  if (p.status) where.visit_status = p.status as VisitStatus;
  if (p.date_from || p.date_to) {
    where.visit_date = {
      gte: p.date_from ? new Date(p.date_from) : undefined,
      lte: p.date_to ? new Date(p.date_to) : undefined,
    };
  }
  const sort = parseSort(p.sort, ['visit_date', 'created_at']) ?? {
    field: 'visit_date',
    order: 'desc',
  };
  const [data, total] = await Promise.all([
    prisma.salesVisit.findMany({
      where,
      include: { customer: true, employee: true, route: true },
      orderBy: { [sort.field]: sort.order },
      ...paginate(p),
    }),
    prisma.salesVisit.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getVisit(id: bigint) {
  const r = await prisma.salesVisit.findUnique({
    where: { visit_id: id },
    include: {
      customer: true,
      employee: true,
      route: true,
      items: { include: { product: true } },
      collections: true,
      arInvoices: { include: { items: true, payments: true } },
    },
  });
  if (!r) throw new NotFoundError('Sales visit not found');
  return r;
}

export { plus };
