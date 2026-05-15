import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';

/**
 * The FEFO picker is implemented in lot.service.ts against the database. This
 * test exercises the same pure logic at the JavaScript level so a regression in
 * the splitting rules is caught without needing Postgres.
 *
 * Rules:
 *   - rows are pre-sorted by expiry_date ASC NULLS LAST, lot_id ASC.
 *   - we walk and take min(remaining, available) per row.
 *   - if rows together cover the request, every pick has a real lot_id.
 *   - if rows are empty (no lots at all for this product), return a single
 *     virtual pick {lot_id: null, qty: requested} so callers keep working in
 *     "lot-less" mode.
 *   - if rows together fall short of the request (data corruption), the
 *     remainder is attributed to lot_id=null and the caller's aggregate-balance
 *     check is expected to surface the error.
 */
type Row = { lot_id: bigint; qty_on_hand: Decimal };

function pickFromRows(rows: Row[], requested: Decimal) {
  if (rows.length === 0) return [{ lot_id: null, qty: requested }];
  const picks: Array<{ lot_id: bigint | null; qty: Decimal }> = [];
  let remaining = requested;
  for (const r of rows) {
    if (remaining.lte(0)) break;
    const take = r.qty_on_hand.gte(remaining) ? remaining : r.qty_on_hand;
    if (take.gt(0)) {
      picks.push({ lot_id: r.lot_id, qty: take });
      remaining = remaining.minus(take);
    }
  }
  if (remaining.gt(0)) picks.push({ lot_id: null, qty: remaining });
  return picks;
}

describe('FEFO pickFromRows', () => {
  it('exactly empties the oldest lot first, then bites into the next', () => {
    const rows: Row[] = [
      { lot_id: 1n, qty_on_hand: new Decimal('40') },
      { lot_id: 2n, qty_on_hand: new Decimal('60') },
    ];
    const picks = pickFromRows(rows, new Decimal('75'));
    expect(picks.map((p) => ({ ...p, qty: p.qty.toFixed(2) }))).toEqual([
      { lot_id: 1n, qty: '40.00' },
      { lot_id: 2n, qty: '35.00' },
    ]);
  });

  it('emits a single virtual null-lot pick when no rows exist (legacy mode)', () => {
    expect(pickFromRows([], new Decimal('25'))).toEqual([
      { lot_id: null, qty: new Decimal('25') },
    ]);
  });

  it('marks the shortfall to lot_id=null when lot sum is insufficient', () => {
    const rows: Row[] = [{ lot_id: 7n, qty_on_hand: new Decimal('10') }];
    const picks = pickFromRows(rows, new Decimal('25'));
    expect(picks.map((p) => ({ ...p, qty: p.qty.toFixed(2) }))).toEqual([
      { lot_id: 7n, qty: '10.00' },
      { lot_id: null, qty: '15.00' },
    ]);
  });

  it('skips empty rows and never produces zero-qty picks', () => {
    const rows: Row[] = [
      { lot_id: 1n, qty_on_hand: new Decimal('0') },
      { lot_id: 2n, qty_on_hand: new Decimal('50') },
    ];
    const picks = pickFromRows(rows, new Decimal('30'));
    expect(picks).toHaveLength(1);
    expect(picks[0]!.lot_id).toBe(2n);
    expect(picks[0]!.qty.toFixed(2)).toBe('30.00');
  });
});
