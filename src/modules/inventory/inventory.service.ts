import { MovementType, Prisma, RefDocType } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma, Tx, withTx } from '../../database/prisma';
import {
  ConflictError,
  InsufficientStockError,
  NotFoundError,
} from '../../common/errors/AppError';
import { writeAuditLog } from '../../database/audit';
import {
  enforceCreditLimitTx,
} from '../credit/credit.service';
import { AuthUser } from '../../common/middleware/auth';
import {
  paginate,
  Pagination,
  parseSort,
} from '../../common/validators/common';
import { plus, times, toDecimal } from '../../common/utils/money';
import {
  applyConsignmentLotDelta,
  applyWarehouseLotDelta,
  createOrTopUpProductionLot,
  pickConsignmentLotsFEFO,
  pickWarehouseLotsFEFO,
  recordLotConsumption,
} from './lot.service';

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

export async function listWarehouseStock(
  p: Pagination & {
    warehouse_id?: bigint;
    product_id?: bigint;
    q?: string;
    low_stock?: string;
  },
) {
  const where: Prisma.InventoryBalanceWhereInput = {};
  if (p.warehouse_id) where.warehouse_id = p.warehouse_id;
  if (p.product_id) where.product_id = p.product_id;
  if (p.q) {
    where.product = {
      OR: [
        { sku_code: { contains: p.q, mode: 'insensitive' } },
        { product_name: { contains: p.q, mode: 'insensitive' } },
      ],
    };
  }

  const sort = parseSort(p.sort, ['qty_on_hand', 'updated_at']) ?? {
    field: 'updated_at',
    order: 'desc',
  };

  const [rows, total] = await Promise.all([
    prisma.inventoryBalance.findMany({
      where,
      include: { product: true, warehouse: true },
      orderBy: { [sort.field]: sort.order },
      ...paginate(p),
    }),
    prisma.inventoryBalance.count({ where }),
  ]);

  const data =
    p.low_stock === 'true'
      ? rows.filter((r) =>
          toDecimal(r.qty_on_hand).lte(toDecimal(r.product.min_stock)),
        )
      : rows;
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function listConsignmentStock(
  p: Pagination & { customer_id?: bigint; product_id?: bigint },
) {
  const where: Prisma.ConsignmentStockWhereInput = {};
  if (p.customer_id) where.customer_id = p.customer_id;
  if (p.product_id) where.product_id = p.product_id;
  const [data, total] = await Promise.all([
    prisma.consignmentStock.findMany({
      where,
      include: { customer: true, product: true },
      orderBy: [{ customer_id: 'asc' }, { product_id: 'asc' }],
      ...paginate(p),
    }),
    prisma.consignmentStock.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function listMovements(
  p: Pagination & {
    warehouse_id?: bigint;
    customer_id?: bigint;
    product_id?: bigint;
    movement_type?: string;
    ref_doc_type?: string;
    ref_doc_id?: bigint;
    date_from?: string;
    date_to?: string;
  },
) {
  const where: Prisma.StockMovementWhereInput = {};
  if (p.warehouse_id) where.warehouse_id = p.warehouse_id;
  if (p.customer_id) where.customer_id = p.customer_id;
  if (p.product_id) where.product_id = p.product_id;
  if (p.movement_type) where.movement_type = p.movement_type as MovementType;
  if (p.ref_doc_type) where.ref_doc_type = p.ref_doc_type as RefDocType;
  if (p.ref_doc_id) where.ref_doc_id = p.ref_doc_id;
  if (p.date_from || p.date_to) {
    where.movement_date = {
      gte: p.date_from ? new Date(p.date_from) : undefined,
      lte: p.date_to ? new Date(p.date_to) : undefined,
    };
  }

  const [data, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: { product: true, warehouse: true, customer: true },
      orderBy: { movement_date: 'desc' },
      ...paginate(p),
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

// ---------------------------------------------------------------------------
// Locking helpers
// ---------------------------------------------------------------------------

/**
 * Acquire a row-level lock on the inventory_balance row for (warehouse, product),
 * creating it if missing. Returns the locked row.
 */
export async function lockOrCreateWarehouseBalance(
  tx: Tx,
  warehouse_id: bigint,
  product_id: bigint,
): Promise<{
  inventory_id: bigint;
  qty_on_hand: Decimal;
  qty_reserved: Decimal;
}> {
  const existing = await tx.$queryRaw<
    { inventory_id: bigint; qty_on_hand: Prisma.Decimal; qty_reserved: Prisma.Decimal }[]
  >`
    SELECT inventory_id, qty_on_hand, qty_reserved
    FROM inventory_balance
    WHERE warehouse_id = ${warehouse_id} AND product_id = ${product_id}
    FOR UPDATE
  `;
  if (existing[0]) {
    return {
      inventory_id: existing[0].inventory_id,
      qty_on_hand: toDecimal(existing[0].qty_on_hand),
      qty_reserved: toDecimal(existing[0].qty_reserved),
    };
  }
  // Create with zero balance and re-lock.
  const created = await tx.inventoryBalance.create({
    data: { warehouse_id, product_id, qty_on_hand: 0, qty_reserved: 0, qty_available: 0 },
  });
  return {
    inventory_id: created.inventory_id,
    qty_on_hand: new Decimal(0),
    qty_reserved: new Decimal(0),
  };
}

export async function lockOrCreateConsignmentStock(
  tx: Tx,
  customer_id: bigint,
  product_id: bigint,
): Promise<{ consignment_stock_id: bigint; qty_on_hand: Decimal; existed: boolean }> {
  const existing = await tx.$queryRaw<
    { consignment_stock_id: bigint; qty_on_hand: Prisma.Decimal }[]
  >`
    SELECT consignment_stock_id, qty_on_hand
    FROM consignment_stock
    WHERE customer_id = ${customer_id} AND product_id = ${product_id}
    FOR UPDATE
  `;
  if (existing[0]) {
    return {
      consignment_stock_id: existing[0].consignment_stock_id,
      qty_on_hand: toDecimal(existing[0].qty_on_hand),
      existed: true,
    };
  }
  const created = await tx.consignmentStock.create({
    data: { customer_id, product_id, qty_on_hand: 0 },
  });
  return {
    consignment_stock_id: created.consignment_stock_id,
    qty_on_hand: new Decimal(0),
    existed: false,
  };
}

// ---------------------------------------------------------------------------
// Ledger writers (shared building blocks)
// ---------------------------------------------------------------------------

export async function applyWarehouseDelta(params: {
  tx: Tx;
  warehouse_id: bigint;
  product_id: bigint;
  delta: Decimal; // positive = in, negative = out
  movement_type: MovementType;
  ref_doc_type: RefDocType | null;
  ref_doc_id: bigint | null;
  unit_cost?: Decimal | string | null;
  unit_price?: Decimal | string | null;
  remark?: string | null;
  created_by?: bigint | null;
  customer_id?: bigint | null;
  lot_id?: bigint | null;
}): Promise<Decimal> {
  const { tx } = params;
  const bal = await lockOrCreateWarehouseBalance(
    tx,
    params.warehouse_id,
    params.product_id,
  );
  const newQty = bal.qty_on_hand.plus(params.delta);
  if (newQty.lt(0)) {
    throw new InsufficientStockError(
      'Warehouse stock cannot go negative',
      {
        warehouse_id: params.warehouse_id.toString(),
        product_id: params.product_id.toString(),
        qty_on_hand: bal.qty_on_hand.toFixed(2),
        delta: params.delta.toFixed(2),
      },
    );
  }
  const newAvailable = newQty.minus(bal.qty_reserved);
  await tx.inventoryBalance.update({
    where: { inventory_id: bal.inventory_id },
    data: {
      qty_on_hand: newQty.toFixed(2),
      qty_available: newAvailable.toFixed(2),
    },
  });
  await tx.stockMovement.create({
    data: {
      movement_type: params.movement_type,
      ref_doc_type: params.ref_doc_type,
      ref_doc_id: params.ref_doc_id,
      warehouse_id: params.warehouse_id,
      customer_id: params.customer_id ?? null,
      product_id: params.product_id,
      lot_id: params.lot_id ?? null,
      qty_in: params.delta.gt(0) ? params.delta.toFixed(2) : '0',
      qty_out: params.delta.lt(0) ? params.delta.abs().toFixed(2) : '0',
      balance_after: newQty.toFixed(2),
      unit_cost:
        params.unit_cost !== undefined && params.unit_cost !== null
          ? params.unit_cost.toString()
          : null,
      unit_price:
        params.unit_price !== undefined && params.unit_price !== null
          ? params.unit_price.toString()
          : null,
      remark: params.remark ?? null,
      created_by: params.created_by ?? null,
    },
  });
  return newQty;
}

export async function applyConsignmentDelta(params: {
  tx: Tx;
  customer_id: bigint;
  product_id: bigint;
  delta: Decimal;
  movement_type: MovementType;
  ref_doc_type: RefDocType | null;
  ref_doc_id: bigint | null;
  unit_price?: Decimal | string | null;
  unit_cost?: Decimal | string | null;
  remark?: string | null;
  created_by?: bigint | null;
  warehouse_id?: bigint | null;
  lot_id?: bigint | null;
}): Promise<Decimal> {
  const { tx } = params;
  const bal = await lockOrCreateConsignmentStock(
    tx,
    params.customer_id,
    params.product_id,
  );
  const newQty = bal.qty_on_hand.plus(params.delta);
  if (newQty.lt(0)) {
    throw new InsufficientStockError(
      'Customer consignment stock cannot go negative',
      {
        customer_id: params.customer_id.toString(),
        product_id: params.product_id.toString(),
        qty_on_hand: bal.qty_on_hand.toFixed(2),
        delta: params.delta.toFixed(2),
      },
    );
  }
  await tx.consignmentStock.update({
    where: { consignment_stock_id: bal.consignment_stock_id },
    data: {
      qty_on_hand: newQty.toFixed(2),
      last_visit_date: new Date(),
    },
  });
  await tx.stockMovement.create({
    data: {
      movement_type: params.movement_type,
      ref_doc_type: params.ref_doc_type,
      ref_doc_id: params.ref_doc_id,
      warehouse_id: params.warehouse_id ?? null,
      customer_id: params.customer_id,
      product_id: params.product_id,
      lot_id: params.lot_id ?? null,
      qty_in: params.delta.gt(0) ? params.delta.toFixed(2) : '0',
      qty_out: params.delta.lt(0) ? params.delta.abs().toFixed(2) : '0',
      balance_after: newQty.toFixed(2),
      unit_price:
        params.unit_price !== undefined && params.unit_price !== null
          ? params.unit_price.toString()
          : null,
      unit_cost:
        params.unit_cost !== undefined && params.unit_cost !== null
          ? params.unit_cost.toString()
          : null,
      remark: params.remark ?? null,
      created_by: params.created_by ?? null,
    },
  });
  return newQty;
}

// ---------------------------------------------------------------------------
// Public operations
// ---------------------------------------------------------------------------

type LineInput = {
  product_id: bigint;
  qty: string;
  unit_cost?: string;
  unit_price?: string;
};
type DeltaLineInput = { product_id: bigint; delta_qty: string; unit_cost?: string };
type ProductionLineInput = LineInput & {
  lot_no?: string;
  manufacturing_date?: string;
  expiry_date?: string;
};

async function getProductsByIds(
  tx: Tx | typeof prisma,
  ids: bigint[],
): Promise<Map<string, { product_id: bigint; selling_price: Decimal; cost: Decimal }>> {
  const list = await tx.product.findMany({
    where: { product_id: { in: ids } },
    select: { product_id: true, selling_price: true, cost: true },
  });
  const map = new Map<
    string,
    { product_id: bigint; selling_price: Decimal; cost: Decimal }
  >();
  for (const p of list) {
    map.set(p.product_id.toString(), {
      product_id: p.product_id,
      selling_price: toDecimal(p.selling_price),
      cost: toDecimal(p.cost),
    });
  }
  return map;
}

export async function warehouseAdjustment(
  input: {
    warehouse_id: bigint;
    remark?: string;
    lines: DeltaLineInput[];
  },
  user: AuthUser | undefined,
) {
  return withTx(async (tx) => {
    const productIds = input.lines.map((l) => l.product_id);
    const products = await getProductsByIds(tx, productIds);
    for (const id of productIds) {
      if (!products.has(id.toString())) {
        throw new NotFoundError(`Product ${id} not found`);
      }
    }

    const adjustmentId = BigInt(Date.now()); // logical ref id (no separate table for V1)
    const movementsBefore = await tx.stockMovement.count();

    for (const line of input.lines) {
      const delta = new Decimal(line.delta_qty);
      const product = products.get(line.product_id.toString())!;
      await applyWarehouseDelta({
        tx,
        warehouse_id: input.warehouse_id,
        product_id: line.product_id,
        delta,
        movement_type: 'WAREHOUSE_ADJUSTMENT',
        ref_doc_type: 'ADJUSTMENT',
        ref_doc_id: adjustmentId,
        unit_cost: line.unit_cost ?? product.cost.toFixed(2),
        remark: input.remark,
        created_by: user?.employeeId ?? null,
      });
    }

    await writeAuditLog(tx, {
      tableName: 'stock_movement',
      action: 'CREATE',
      newValue: {
        movement_type: 'WAREHOUSE_ADJUSTMENT',
        warehouse_id: input.warehouse_id.toString(),
        lines: input.lines.map((l) => ({
          product_id: l.product_id.toString(),
          delta_qty: l.delta_qty,
        })),
        ref_doc_id: adjustmentId.toString(),
      },
      context: { adjustmentId: adjustmentId.toString() },
    });

    const movements = await tx.stockMovement.findMany({
      skip: movementsBefore,
      orderBy: { movement_id: 'asc' },
    });
    return { ref_doc_id: adjustmentId.toString(), movements };
  });
}

export async function productionReceipt(
  input: { warehouse_id: bigint; remark?: string; lines: ProductionLineInput[] },
  user: AuthUser | undefined,
) {
  return withTx(async (tx) => {
    const productIds = input.lines.map((l) => l.product_id);
    const products = await getProductsByIds(tx, productIds);
    for (const id of productIds) {
      if (!products.has(id.toString())) {
        throw new NotFoundError(`Product ${id} not found`);
      }
    }
    const refId = BigInt(Date.now());
    for (const line of input.lines) {
      const product = products.get(line.product_id.toString())!;
      const qty = new Decimal(line.qty);

      let lotId: bigint | null = null;
      if (line.lot_no) {
        const lot = await createOrTopUpProductionLot(tx, {
          product_id: line.product_id,
          warehouse_id: input.warehouse_id,
          qty,
          lot_no: line.lot_no,
          manufacturing_date: line.manufacturing_date
            ? new Date(line.manufacturing_date)
            : undefined,
          expiry_date: line.expiry_date ? new Date(line.expiry_date) : undefined,
        });
        lotId = lot.lot_id;
      }

      await applyWarehouseDelta({
        tx,
        warehouse_id: input.warehouse_id,
        product_id: line.product_id,
        delta: qty,
        movement_type: 'PRODUCTION_RECEIPT',
        ref_doc_type: 'PRODUCTION',
        ref_doc_id: refId,
        unit_cost: line.unit_cost ?? product.cost.toFixed(2),
        remark: input.remark,
        created_by: user?.employeeId ?? null,
        lot_id: lotId,
      });
    }
    return { ref_doc_id: refId.toString() };
  });
}

export async function loadStockToCustomer(
  input: {
    customer_id: bigint;
    warehouse_id: bigint;
    remark?: string;
    override_credit?: boolean;
    override_reason?: string;
    lines: LineInput[];
  },
  user: AuthUser | undefined,
) {
  if (!user) throw new ConflictError('Authentication required');
  return withTx(async (tx) => {
    // Lock customer row first to serialize credit-affecting operations.
    await tx.$queryRaw`SELECT customer_id FROM customer WHERE customer_id = ${input.customer_id} FOR UPDATE`;
    const customer = await tx.customer.findUnique({
      where: { customer_id: input.customer_id },
    });
    if (!customer) throw new NotFoundError('Customer not found');
    if (!customer.active_flag)
      throw new ConflictError('Customer is inactive');

    const productIds = input.lines.map((l) => l.product_id);
    const products = await getProductsByIds(tx, productIds);
    for (const id of productIds) {
      if (!products.has(id.toString())) {
        throw new NotFoundError(`Product ${id} not found`);
      }
    }

    // Lock consignment_stock rows for these products (so credit calc is consistent).
    for (const id of productIds) {
      await lockOrCreateConsignmentStock(tx, input.customer_id, id);
    }

    // Compute additional value for credit check
    let additional = new Decimal(0);
    for (const line of input.lines) {
      const p = products.get(line.product_id.toString())!;
      additional = additional.plus(new Decimal(line.qty).times(p.selling_price));
    }

    await enforceCreditLimitTx({
      tx,
      customer_id: input.customer_id,
      additional_value: additional,
      user,
      override: input.override_credit
        ? { requested: true, reason: input.override_reason }
        : undefined,
      context: { action: 'load_to_customer', warehouse_id: input.warehouse_id.toString() },
    });

    const refId = BigInt(Date.now());

    for (const line of input.lines) {
      const qty = new Decimal(line.qty);
      const product = products.get(line.product_id.toString())!;

      // Determine if this is a top-up (REPLENISHMENT) or net-new (LOAD_TO_CUSTOMER)
      const existing = await tx.consignmentStock.findUnique({
        where: {
          customer_id_product_id: {
            customer_id: input.customer_id,
            product_id: line.product_id,
          },
        },
      });
      const isReplenish = existing && toDecimal(existing.qty_on_hand).gt(0);
      const moveType: MovementType = isReplenish
        ? 'REPLENISHMENT'
        : 'LOAD_TO_CUSTOMER';
      const refType: RefDocType = isReplenish ? 'REPLENISH' : 'LOAD';

      // FEFO-pick from warehouse lot balances (empty → single null-lot pick = legacy behavior).
      const picks = await pickWarehouseLotsFEFO(tx, {
        warehouse_id: input.warehouse_id,
        product_id: line.product_id,
        qty,
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
            customer_id: input.customer_id,
            lot_id: pick.lot_id,
            delta: pick.qty,
          });
        }

        await applyWarehouseDelta({
          tx,
          warehouse_id: input.warehouse_id,
          product_id: line.product_id,
          delta: pick.qty.negated(),
          movement_type: moveType,
          ref_doc_type: refType,
          ref_doc_id: refId,
          unit_cost: line.unit_cost ?? product.cost.toFixed(2),
          unit_price: line.unit_price ?? product.selling_price.toFixed(2),
          remark: input.remark,
          created_by: user.employeeId ?? null,
          lot_id: pick.lot_id,
        });
        await applyConsignmentDelta({
          tx,
          customer_id: input.customer_id,
          product_id: line.product_id,
          delta: pick.qty,
          movement_type: moveType,
          ref_doc_type: refType,
          ref_doc_id: refId,
          unit_cost: line.unit_cost ?? product.cost.toFixed(2),
          unit_price: line.unit_price ?? product.selling_price.toFixed(2),
          remark: input.remark,
          created_by: user.employeeId ?? null,
          lot_id: pick.lot_id,
        });
      }
    }

    return { ref_doc_id: refId.toString() };
  });
}

export async function returnStockFromCustomer(
  input: {
    customer_id: bigint;
    warehouse_id: bigint;
    remark?: string;
    lines: LineInput[];
  },
  user: AuthUser | undefined,
) {
  return withTx(async (tx) => {
    await tx.$queryRaw`SELECT customer_id FROM customer WHERE customer_id = ${input.customer_id} FOR UPDATE`;
    const customer = await tx.customer.findUnique({
      where: { customer_id: input.customer_id },
    });
    if (!customer) throw new NotFoundError('Customer not found');

    const productIds = input.lines.map((l) => l.product_id);
    const products = await getProductsByIds(tx, productIds);

    const refId = BigInt(Date.now());
    for (const line of input.lines) {
      const qty = new Decimal(line.qty);
      const product = products.get(line.product_id.toString());
      if (!product) throw new NotFoundError(`Product ${line.product_id} not found`);

      const picks = await pickConsignmentLotsFEFO(tx, {
        customer_id: input.customer_id,
        product_id: line.product_id,
        qty,
      });

      for (const pick of picks) {
        if (pick.lot_id !== null) {
          await applyConsignmentLotDelta(tx, {
            customer_id: input.customer_id,
            lot_id: pick.lot_id,
            delta: pick.qty.negated(),
          });
          await applyWarehouseLotDelta(tx, {
            warehouse_id: input.warehouse_id,
            lot_id: pick.lot_id,
            delta: pick.qty,
          });
        }

        await applyConsignmentDelta({
          tx,
          customer_id: input.customer_id,
          product_id: line.product_id,
          delta: pick.qty.negated(),
          movement_type: 'RETURN_FROM_CUSTOMER',
          ref_doc_type: 'RETURN',
          ref_doc_id: refId,
          unit_cost: line.unit_cost ?? product.cost.toFixed(2),
          unit_price: line.unit_price ?? product.selling_price.toFixed(2),
          remark: input.remark,
          created_by: user?.employeeId ?? null,
          lot_id: pick.lot_id,
        });
        await applyWarehouseDelta({
          tx,
          warehouse_id: input.warehouse_id,
          product_id: line.product_id,
          delta: pick.qty,
          movement_type: 'RETURN_FROM_CUSTOMER',
          ref_doc_type: 'RETURN',
          ref_doc_id: refId,
          unit_cost: line.unit_cost ?? product.cost.toFixed(2),
          unit_price: line.unit_price ?? product.selling_price.toFixed(2),
          remark: input.remark,
          created_by: user?.employeeId ?? null,
          lot_id: pick.lot_id,
        });
      }
    }
    return { ref_doc_id: refId.toString() };
  });
}

// ---------------------------------------------------------------------------
// Lot readers
// ---------------------------------------------------------------------------

export async function listLots(
  p: Pagination & {
    warehouse_id?: bigint;
    customer_id?: bigint;
    product_id?: bigint;
    expiring_before?: string;
  },
) {
  const where: Prisma.ProductLotWhereInput = {};
  if (p.product_id) where.product_id = p.product_id;
  if (p.expiring_before) {
    where.expiry_date = { lte: new Date(p.expiring_before) };
  }

  const includeWarehouseBalances = p.warehouse_id
    ? { where: { warehouse_id: p.warehouse_id }, include: { warehouse: true } }
    : { include: { warehouse: true } };
  const includeCustomerBalances = p.customer_id
    ? { where: { customer_id: p.customer_id }, include: { customer: true } }
    : { include: { customer: true } };

  const [data, total] = await Promise.all([
    prisma.productLot.findMany({
      where,
      orderBy: [{ expiry_date: 'asc' }, { lot_id: 'asc' }],
      include: {
        product: true,
        warehouseBalances: includeWarehouseBalances,
        consignmentBalances: includeCustomerBalances,
      },
      ...paginate(p),
    }),
    prisma.productLot.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

// re-exports for clarity
export { plus, times };
