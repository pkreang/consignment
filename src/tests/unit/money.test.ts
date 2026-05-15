import { describe, it, expect } from 'vitest';
import {
  money,
  moneyString,
  plus,
  minus,
  times,
  min,
  toDecimal,
  eq,
  gt,
  lt,
  isZero,
} from '../../common/utils/money';

describe('money utils', () => {
  it('rounds to 2 decimals half-up', () => {
    expect(moneyString('1.005')).toBe('1.01');
    expect(moneyString('1.004')).toBe('1.00');
    expect(moneyString(2.345)).toBe('2.35');
  });

  it('preserves precision through plus/minus/times', () => {
    expect(plus('0.1', '0.2').toFixed(2)).toBe('0.30');
    expect(minus('100.00', '0.01').toFixed(2)).toBe('99.99');
    expect(times('12.00', '3').toFixed(2)).toBe('36.00');
  });

  it('handles bigint and null inputs in toDecimal', () => {
    expect(toDecimal(42n).toString()).toBe('42');
    expect(toDecimal(null).toString()).toBe('0');
    expect(toDecimal(undefined).toString()).toBe('0');
  });

  it('comparison helpers work', () => {
    expect(eq('10.00', 10)).toBe(true);
    expect(gt('11.00', '10')).toBe(true);
    expect(lt('9.99', '10')).toBe(true);
    expect(isZero('0')).toBe(true);
  });

  it('min picks the smaller', () => {
    expect(min('5', '3').toString()).toBe('3');
    expect(min('5', '10').toString()).toBe('5');
  });

  it('money handles the qty * unit price calculation cleanly', () => {
    // 30 pcs * 12.00 = 360.00
    const amt = money(times('30', '12.00'));
    expect(amt.toFixed(2)).toBe('360.00');
  });
});
