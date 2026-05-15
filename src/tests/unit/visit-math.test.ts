import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { money, times } from '../../common/utils/money';

/**
 * Sales-visit confirmation math, verified at the formula level.
 *
 * qty_sold = qty_before - qty_counted
 * sales_amount = qty_sold * unit_price
 *
 * Negative-stock and over-count cases must be rejected.
 */

function computeLine(qty_before: string, qty_counted: string, unit_price: string) {
  const a = new Decimal(qty_before);
  const b = new Decimal(qty_counted);
  if (b.gt(a)) throw new Error('qty_counted > qty_before');
  const qty_sold = a.minus(b);
  const sales_amount = money(times(qty_sold, unit_price));
  return { qty_sold: qty_sold.toFixed(2), sales_amount: sales_amount.toFixed(2) };
}

describe('sales-visit math', () => {
  it('matches the documented example: 100 placed, 70 counted -> 30 sold', () => {
    expect(computeLine('100', '70', '12.00')).toEqual({
      qty_sold: '30.00',
      sales_amount: '360.00',
    });
  });

  it('handles fractional units', () => {
    expect(computeLine('10.5', '4.25', '14.00')).toEqual({
      qty_sold: '6.25',
      sales_amount: '87.50',
    });
  });

  it('zero sold yields zero sales', () => {
    expect(computeLine('100', '100', '12.00')).toEqual({
      qty_sold: '0.00',
      sales_amount: '0.00',
    });
  });

  it('throws when counted exceeds before', () => {
    expect(() => computeLine('70', '100', '12.00')).toThrowError();
  });
});

describe('credit exposure formula', () => {
  it('exposure = AR outstanding + consignment value', () => {
    const ar = new Decimal('1500.00');
    const stk = new Decimal('2500.00');
    const limit = new Decimal('5000.00');
    const exposure = ar.plus(stk);
    expect(exposure.toFixed(2)).toBe('4000.00');
    expect(exposure.lte(limit)).toBe(true);

    // Now load 1500 more worth of stock -> exposure 5500 > 5000 limit
    const additional = new Decimal('1500.00');
    expect(exposure.plus(additional).gt(limit)).toBe(true);
  });
});
