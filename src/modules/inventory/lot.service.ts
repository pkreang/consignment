/**
 * Lot / FEFO support.
 *
 * Lots are optional. A product without any `product_lot` rows behaves exactly
 * as before — `pickLotsFEFO*` returns a single virtual pick with `lot_id=null`,
 * which gets stamped on the `stock_movement` row as null.
 *
 * Once any lot is created (via `createProductionLot`), every subsequent
 * outbound flow (load, return, sale_confirmed, replenishment) picks oldest
 * expiry first. Aggregate balances on `inventory_balance` and
 * `consignment_stock` are kept consistent because the orchestrators call the
 * shared `applyWarehouseDelta` / `applyConsignmentDelta` helpers per pick.
 */
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { Tx } from '../../database/prisma';
import { InsufficientStockError, NotFoundError } from '../../common/errors/AppError';
import { toDecimal } from '../../common/utils/money';

export type LotPick = { lot_id: bigint | null; qty: Decimal };

interface LotRow {
  lot_id: bigint;
  qty_on_hand: Prisma.Decimal;
  expiry_date: Date | null;
}

async function lockWarehouseLotRows(
  tx: Tx,
  warehouse_id: bigint,
  product_id: bigint,
): Promise<LotRow[]> {
  return tx.$queryRaw<LotRow[]>`
    SELECT wsl.lot_id, wsl.qty_on_hand, pl.expiry_date
    FROM warehouse_stock_lot wsl
    JOIN product_lot pl ON pl.lot_id = wsl.lot_id
    WHERE wsl.warehouse_id = ${warehouse_id}
      AND pl.product_id = ${product_id}
      AND wsl.qty_on_hand > 0
    ORDER BY pl.expiry_date ASC NULLS LAST, pl.lot_id ASC
    FOR UPDATE OF wsl
  `;
}

async function lockConsignmentLotRows(
  tx: Tx,
  customer_id: bigint,
  product_id: bigint,
): Promise<LotRow[]> {
  return tx.$queryRaw<LotRow[]>`
    SELECT csl.lot_id, csl.qty_on_hand, pl.expiry_date
    FROM consignment_stock_lot csl
    JOIN product_lot pl ON pl.lot_id = csl.lot_id
    WHERE csl.customer_id = ${customer_id}
      AND pl.product_id = ${product_id}
      AND csl.qty_on_hand > 0
    ORDER BY pl.expiry_date ASC NULLS LAST, pl.lot_id ASC
    FOR UPDATE OF csl
  `;
}

function pickFromRows(rows: LotRow[], requested: Decimal): LotPick[] {
  if (rows.length === 0) return [{ lot_id: null, qty: requested }];
  const picks: LotPick[] = [];
  let remaining = requested;
  for (const r of rows) {
    if (remaining.lte(0)) break;
    const avail = toDecimal(r.qty_on_hand);
    const take = avail.gte(remaining) ? remaining : avail;
    if (take.gt(0)) {
      picks.push({ lot_id: r.lot_id, qty: take });
      remaining = remaining.minus(take);
    }
  }
  if (remaining.gt(0)) {
    // Lots together can't cover the request → caller will throw via the
    // aggregate-balance check inside applyWarehouseDelta. But surface the
    // mismatch by attributing the remainder to lot_id=null so the aggregate
    // path runs (and will fail) with a clearer error.
    picks.push({ lot_id: null, qty: remaining });
  }
  return picks;
}

export async function pickWarehouseLotsFEFO(
  tx: Tx,
  args: { warehouse_id: bigint; product_id: bigint; qty: Decimal },
): Promise<LotPick[]> {
  const rows = await lockWarehouseLotRows(tx, args.warehouse_id, args.product_id);
  return pickFromRows(rows, args.qty);
}

export async function pickConsignmentLotsFEFO(
  tx: Tx,
  args: { customer_id: bigint; product_id: bigint; qty: Decimal },
): Promise<LotPick[]> {
  const rows = await lockConsignmentLotRows(tx, args.customer_id, args.product_id);
  return pickFromRows(rows, args.qty);
}

/**
 * Acquires (or creates with zero balance) the per-lot balance row, applies a
 * signed delta, and returns the new balance. Both warehouse_stock_lot and
 * consignment_stock_lot share the same shape so this single helper handles
 * both via the `table` discriminator.
 */
async function applyLotBalance(
  tx: Tx,
  args:
    | { kind: 'warehouse'; warehouse_id: bigint; lot_id: bigint; delta: Decimal }
    | { kind: 'consignment'; customer_id: bigint; lot_id: bigint; delta: Decimal },
): Promise<Decimal> {
  const isWarehouse = args.kind === 'warehouse';

  type Row = { id: bigint; qty_on_hand: Prisma.Decimal };
  const existing = isWarehouse
    ? await tx.$queryRaw<Row[]>`
        SELECT warehouse_stock_lot_id AS id, qty_on_hand
        FROM warehouse_stock_lot
        WHERE warehouse_id = ${args.warehouse_id} AND lot_id = ${args.lot_id}
        FOR UPDATE
      `
    : await tx.$queryRaw<Row[]>`
        SELECT consignment_stock_lot_id AS id, qty_on_hand
        FROM consignment_stock_lot
        WHERE customer_id = ${args.customer_id} AND lot_id = ${args.lot_id}
        FOR UPDATE
      `;

  let newQty: Decimal;
  if (existing[0]) {
    newQty = toDecimal(existing[0].qty_on_hand).plus(args.delta);
    if (newQty.lt(0)) {
      throw new InsufficientStockError('Lot balance cannot go negative', {
        lot_id: args.lot_id.toString(),
        before: toDecimal(existing[0].qty_on_hand).toFixed(2),
        delta: args.delta.toFixed(2),
      });
    }
    if (isWarehouse) {
      await tx.warehouseStockLot.update({
        where: { warehouse_stock_lot_id: existing[0].id },
        data: { qty_on_hand: newQty.toFixed(2) },
      });
    } else {
      await tx.consignmentStockLot.update({
        where: { consignment_stock_lot_id: existing[0].id },
        data: { qty_on_hand: newQty.toFixed(2) },
      });
    }
  } else {
    newQty = args.delta;
    if (newQty.lt(0)) {
      throw new InsufficientStockError('Lot balance cannot start negative', {
        lot_id: args.lot_id.toString(),
        delta: args.delta.toFixed(2),
      });
    }
    if (isWarehouse) {
      await tx.warehouseStockLot.create({
        data: {
          warehouse_id: args.warehouse_id,
          lot_id: args.lot_id,
          qty_on_hand: newQty.toFixed(2),
        },
      });
    } else {
      await tx.consignmentStockLot.create({
        data: {
          customer_id: args.customer_id,
          lot_id: args.lot_id,
          qty_on_hand: newQty.toFixed(2),
        },
      });
    }
  }
  return newQty;
}

export async function applyWarehouseLotDelta(
  tx: Tx,
  args: { warehouse_id: bigint; lot_id: bigint; delta: Decimal },
): Promise<Decimal> {
  return applyLotBalance(tx, { kind: 'warehouse', ...args });
}

export async function applyConsignmentLotDelta(
  tx: Tx,
  args: { customer_id: bigint; lot_id: bigint; delta: Decimal },
): Promise<Decimal> {
  return applyLotBalance(tx, { kind: 'consignment', ...args });
}

/**
 * Creates a new product_lot (or reuses an existing one identified by
 * product_id + lot_no), seeds the per-warehouse balance, and bumps qty_received
 * / qty_remaining on the master.
 */
export async function createOrTopUpProductionLot(
  tx: Tx,
  args: {
    product_id: bigint;
    warehouse_id: bigint;
    qty: Decimal;
    lot_no: string;
    manufacturing_date?: Date;
    expiry_date?: Date;
  },
): Promise<{ lot_id: bigint }> {
  if (args.qty.lte(0)) {
    throw new NotFoundError(`lot ${args.lot_no} qty must be positive`);
  }
  const existing = await tx.productLot.findFirst({
    where: { product_id: args.product_id, lot_no: args.lot_no },
  });
  let lot_id: bigint;
  if (existing) {
    await tx.productLot.update({
      where: { lot_id: existing.lot_id },
      data: {
        qty_received: toDecimal(existing.qty_received).plus(args.qty).toFixed(2),
        qty_remaining: toDecimal(existing.qty_remaining).plus(args.qty).toFixed(2),
      },
    });
    lot_id = existing.lot_id;
  } else {
    const created = await tx.productLot.create({
      data: {
        product_id: args.product_id,
        lot_no: args.lot_no,
        manufacturing_date: args.manufacturing_date ?? null,
        expiry_date: args.expiry_date ?? null,
        qty_received: args.qty.toFixed(2),
        qty_remaining: args.qty.toFixed(2),
      },
    });
    lot_id = created.lot_id;
  }
  await applyWarehouseLotDelta(tx, {
    warehouse_id: args.warehouse_id,
    lot_id,
    delta: args.qty,
  });
  return { lot_id };
}

/**
 * On any outbound movement from a location, decrement the source lot balance
 * and also reduce `product_lot.qty_remaining`. Inbound movements (return,
 * replenishment) call applyXxxLotDelta with the same lot to credit the
 * destination — qty_remaining is left untouched in that case.
 */
export async function recordLotConsumption(
  tx: Tx,
  args: { lot_id: bigint; qty: Decimal },
): Promise<void> {
  const lot = await tx.productLot.findUnique({ where: { lot_id: args.lot_id } });
  if (!lot) return;
  const remaining = toDecimal(lot.qty_remaining).minus(args.qty);
  await tx.productLot.update({
    where: { lot_id: args.lot_id },
    data: { qty_remaining: (remaining.lt(0) ? new Decimal(0) : remaining).toFixed(2) },
  });
}
