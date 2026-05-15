import { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from './AppError';
import { logger } from '../../config/logger';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        res.status(409).json({
          error: {
            code: 'CONFLICT',
            message: 'Unique constraint violated',
            details: err.meta,
          },
        });
        return;
      }
      case 'P2003': {
        res.status(409).json({
          error: {
            code: 'CONFLICT',
            message: 'Foreign key constraint violated',
            details: err.meta,
          },
        });
        return;
      }
      case 'P2025': {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Record not found' },
        });
        return;
      }
      default: {
        logger.error({ err, code: err.code }, 'Prisma known error');
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Database error',
            details: { prismaCode: err.code },
          },
        });
        return;
      }
    }
  }

  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
    },
    'Unhandled error',
  );

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
};
