import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

const CSV_DELIMITER = ',';
const CSV_LINE_ENDING = '\n';

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str: string;
  if (value instanceof Date) str = value.toISOString();
  else if (typeof value === 'bigint') str = value.toString();
  else if (value instanceof Prisma.Decimal) str = value.toString();
  else if (typeof value === 'object') str = JSON.stringify(value);
  else str = String(value);
  if (
    str.includes(CSV_DELIMITER) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return columns ? columns.join(CSV_DELIMITER) + CSV_LINE_ENDING : '';
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [cols.join(CSV_DELIMITER)];
  for (const r of rows) {
    lines.push(cols.map((c) => escapeCsv(r[c])).join(CSV_DELIMITER));
  }
  return lines.join(CSV_LINE_ENDING) + CSV_LINE_ENDING;
}

/**
 * Inspect the `format` query parameter and, if `csv`, stream the requested
 * data as a CSV download. The `rowsExtractor` is given the original payload
 * so a nested response like { invoices: [...], summary: {...} } can pick the
 * appropriate slice.
 */
export function respondCsvOrJson<T>(
  req: Request,
  res: Response,
  payload: T,
  options: {
    filename: string;
    rowsExtractor?: (payload: T) => Array<Record<string, unknown>>;
    columns?: string[];
  },
): void {
  const format = (req.query?.format as string | undefined)?.toLowerCase();
  if (format !== 'csv') {
    res.json(payload);
    return;
  }
  const rows = options.rowsExtractor
    ? options.rowsExtractor(payload)
    : (payload as unknown as Array<Record<string, unknown>>);
  const csv = rowsToCsv(rows, options.columns);
  res
    .setHeader('Content-Type', 'text/csv; charset=utf-8')
    .setHeader(
      'Content-Disposition',
      `attachment; filename="${options.filename}.csv"`,
    )
    .send(csv);
}
