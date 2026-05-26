import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import './common/utils/json';
import { requestId } from './common/middleware/requestId';
import { auditContext } from './common/middleware/auditContext';
import { metricsHandler, metricsMiddleware } from './common/middleware/metrics';
import { globalRateLimit } from './common/middleware/rateLimit';
import { errorHandler, notFoundHandler } from './common/errors/errorHandler';
import { apiRouter } from './modules';
import { logger } from './config/logger';
import { openapiSpec } from './openapi/spec';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Disable conditional GET / 304 responses globally. Our API is all
  // dynamic JSON, and ETag handling on /health and /ready made
  // pre-warm pings look like 304s in DevTools.
  app.set('etag', false);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors({ exposedHeaders: ['x-request-id', 'Idempotent-Replay'] }));
  // Capture raw CSV bodies on import endpoints; JSON for everything else.
  app.use(express.text({ type: 'text/csv', limit: '5mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestId);
  app.use(
    pinoHttp({
      // pino-http's type for `logger` is over-narrow; the runtime accepts any
      // standard Pino logger so we erase the type.
      logger: logger as unknown as Parameters<typeof pinoHttp>[0] extends infer O
        ? O extends { logger?: infer L }
          ? L
          : never
        : never,
      genReqId: (req) => (req as { id?: string }).id ?? '',
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
      },
    }),
  );
  app.use(metricsMiddleware());
  app.use(auditContext);
  app.use(globalRateLimit);

  app.get('/health', (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', service: 'consignment-erp-lite' });
  });
  app.get('/ready', async (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      const { prisma } = await import('./database/prisma');
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch (e) {
      res.status(503).json({ status: 'not_ready', error: (e as Error).message });
    }
  });
  app.get('/metrics', metricsHandler);

  app.get('/openapi.json', (_req: Request, res: Response) => {
    res.json(openapiSpec);
  });
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec as never, {
      customSiteTitle: 'Consignment ERP Lite — API Docs',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
