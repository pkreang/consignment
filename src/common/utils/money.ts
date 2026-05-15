import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInput =
  | Decimal
  | Prisma.Decimal
  | number
  | string
  | bigint
  | null
  | undefined;

export function toDecimal(value: DecimalInput): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  if (value instanceof Decimal) return value;
  if (typeof value === 'bigint') return new Decimal(value.toString());
  return new Decimal(value as never);
}

export function money(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function moneyString(value: DecimalInput): string {
  return money(value).toFixed(2);
}

export function isZero(value: DecimalInput): boolean {
  return toDecimal(value).isZero();
}

export function eq(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).eq(toDecimal(b));
}

export function gt(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).gt(toDecimal(b));
}

export function lt(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).lt(toDecimal(b));
}

export function plus(...values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Decimal(0));
}

export function minus(a: DecimalInput, b: DecimalInput): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function times(a: DecimalInput, b: DecimalInput): Decimal {
  return toDecimal(a).times(toDecimal(b));
}

export function min(a: DecimalInput, b: DecimalInput): Decimal {
  return Decimal.min(toDecimal(a), toDecimal(b));
}
