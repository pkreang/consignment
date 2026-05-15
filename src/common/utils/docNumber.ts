import { Prisma } from '@prisma/client';

/**
 * Generate a human-friendly document number using a Postgres sequence.
 * Format: <prefix>-YYYYMM-<6-digit zero-padded sequence>
 *
 * The sequence is global (not per-month). This keeps it cheap and contention-free;
 * the YYYYMM prefix is informational only.
 */
export async function nextDocNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
  sequenceName: string,
  date: Date = new Date(),
): Promise<string> {
  const rows = await tx.$queryRawUnsafe<{ nextval: bigint }[]>(
    `SELECT nextval('${sequenceName}') AS nextval`,
  );
  const seq = rows[0]?.nextval ?? 0n;
  const yyyymm = `${date.getUTCFullYear()}${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}`;
  return `${prefix}-${yyyymm}-${seq.toString().padStart(6, '0')}`;
}
