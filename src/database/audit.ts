import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import { Tx } from './prisma';

export type AuditContext = {
  userId?: bigint;
  username?: string;
  requestId?: string;
  ip?: string;
};

const storage = new AsyncLocalStorage<AuditContext>();

export function runWithAudit<T>(
  ctx: AuditContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}

export function getAuditContext(): AuditContext | undefined {
  return storage.getStore();
}

const SENSITIVE_FIELDS = new Set(['password_hash', 'password']);

function redact<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_FIELDS.has(k) ? '[REDACTED]' : v;
  }
  return out as T;
}

/**
 * Write an audit_log row inside the same transaction as the originating change.
 */
export async function writeAuditLog(
  tx: Tx,
  params: {
    tableName: string;
    recordId?: bigint | null;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    oldValue?: unknown;
    newValue?: unknown;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  const ctx = getAuditContext();
  await tx.auditLog.create({
    data: {
      table_name: params.tableName,
      record_id: params.recordId ?? null,
      action_type: params.action,
      old_value: params.oldValue
        ? (redact(params.oldValue) as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      new_value: params.newValue
        ? (redact(params.newValue) as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      context: params.context
        ? ({
            ...params.context,
            requestId: ctx?.requestId,
            ip: ctx?.ip,
          } as Prisma.InputJsonValue)
        : ctx
        ? ({ requestId: ctx.requestId, ip: ctx.ip } as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      changed_by: ctx?.userId ?? null,
    },
  });
}
