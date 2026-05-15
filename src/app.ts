import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import './common/utils/json';
import { requestId } from './common/middleware/requestId';
import { auditContext } from './common/middleware/auditContext';
import { errorHandler, notFoundHandler } from './common/errors/errorHandler';
import { apiRouter } from './modules';
import { logger } from './config/logger';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestId);
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: { write: (m) => logger.info(m.trim()) },
    }),
  );
  app.use(auditContext);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'consignment-erp-lite' });
  });

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
