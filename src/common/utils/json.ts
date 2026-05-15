import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';

/**
 * Express's default res.json (= JSON.stringify) cannot serialize BigInt or
 * Prisma.Decimal. We register a global toJSON on BigInt and recursively
 * convert Prisma.Decimal to a plain string, which preserves precision.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Decimal) return value.toString();
  if (
    value instanceof Prisma.Decimal ||
    (typeof value === 'object' &&
      value !== null &&
      'toFixed' in value &&
      typeof (value as { toFixed: unknown }).toFixed === 'function' &&
      value.constructor?.name === 'Decimal')
  ) {
    return (value as { toString(): string }).toString();
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = serializeValue(v);
    }
    return result;
  }
  return value;
}
