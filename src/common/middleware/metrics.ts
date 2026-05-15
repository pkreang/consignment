import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

/**
 * Prometheus instrumentation.
 *
 * - Default Node.js metrics (CPU, memory, GC, event loop lag) are enabled.
 * - `http_requests_total{method, route, status}` counter.
 * - `http_request_duration_seconds{method, route, status}` histogram with
 *   reasonable buckets for an ERP API (5ms → 5s).
 *
 * The route label uses the matched Express route pattern (e.g.
 * `/api/v1/sales-visits/:id/confirm`), not the literal URL, so cardinality
 * stays bounded even with BigInt ids in the path.
 */

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const requestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests grouped by route + status',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

const requestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const elapsedSec =
        Number(process.hrtime.bigint() - start) / 1_000_000_000;
      const route = req.route?.path
        ? `${req.baseUrl ?? ''}${req.route.path}`
        : req.originalUrl.split('?')[0] ?? '<unknown>';
      const labels = {
        method: req.method,
        route,
        status: String(res.statusCode),
      };
      requestsTotal.inc(labels);
      requestDuration.observe(labels, elapsedSec);
    });
    next();
  };
}

export async function metricsHandler(_req: Request, res: Response) {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}
