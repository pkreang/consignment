/**
 * Notification dispatcher.
 *
 * Centralises every outbound side-effect that should reach humans (Slack
 * webhook, LINE Notify, email/SMS — whatever ops configures). Callers fire
 * `notify({event, payload, severity})` and the dispatcher fans out to every
 * provider that has been wired in via env vars.
 *
 * Providers are fail-soft on purpose — a notification outage must never block
 * a financial mutation. Failures are logged at `warn` and dropped.
 */
import crypto from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export type NotifySeverity = 'info' | 'warn' | 'critical';

export interface NotifyMessage {
  event: string;
  severity: NotifySeverity;
  title: string;
  body: string;
  context?: Record<string, unknown>;
}

interface Provider {
  name: string;
  send(msg: NotifyMessage): Promise<void>;
}

const providers: Provider[] = [];

if (env.NOTIFY_WEBHOOK_URL) {
  providers.push({
    name: 'webhook',
    send: async (msg) => {
      const payload = JSON.stringify(msg);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (env.NOTIFY_WEBHOOK_SECRET) {
        const sig = crypto
          .createHmac('sha256', env.NOTIFY_WEBHOOK_SECRET)
          .update(payload)
          .digest('hex');
        headers['X-Signature-256'] = `sha256=${sig}`;
      }
      const res = await fetch(env.NOTIFY_WEBHOOK_URL!, {
        method: 'POST',
        headers,
        body: payload,
      });
      if (!res.ok) {
        throw new Error(`webhook ${res.status}: ${await res.text().catch(() => '')}`);
      }
    },
  });
}

if (env.LINE_NOTIFY_TOKEN) {
  providers.push({
    name: 'line-notify',
    send: async (msg) => {
      const message = `[${msg.severity.toUpperCase()}] ${msg.title}\n${msg.body}`;
      const form = new URLSearchParams();
      form.set('message', message.slice(0, 999));
      const res = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.LINE_NOTIFY_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      if (!res.ok) {
        throw new Error(`line-notify ${res.status}: ${await res.text().catch(() => '')}`);
      }
    },
  });
}

/**
 * Fire-and-forget notification. Returns immediately so callers don't block on
 * outbound HTTP; errors are logged but never thrown.
 */
export function notify(msg: NotifyMessage): void {
  if (providers.length === 0 || env.NOTIFY_DRY_RUN) {
    logger.info({ notification: msg }, 'notify (no providers / dry-run)');
    return;
  }
  for (const p of providers) {
    p.send(msg).catch((e) => {
      logger.warn(
        { provider: p.name, error: (e as Error).message, event: msg.event },
        'notification dispatch failed',
      );
    });
  }
}

export function configuredProviders(): string[] {
  return providers.map((p) => p.name);
}
