import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idParamSchema } from '../../common/validators/common';
import {
  checkInSchema,
  checkOutSchema,
  confirmSchema,
  recordItemsSchema,
  visitCreateSchema,
  visitListQuery,
} from './sales-visits.dto';
import * as svc from './sales-visits.service';

export const salesVisitRouter = Router();
salesVisitRouter.use(authenticate);

salesVisitRouter.get(
  '/',
  requirePermission('visit.read'),
  validate({ query: visitListQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listVisits(req.query as never)),
  ),
);

salesVisitRouter.get(
  '/:id',
  requirePermission('visit.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.getVisit(req.params.id as unknown as bigint)),
  ),
);

salesVisitRouter.post(
  '/',
  requirePermission('visit.write'),
  validate({ body: visitCreateSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.createVisit(req.body, req.user)),
  ),
);

salesVisitRouter.post(
  '/:id/checkin',
  requirePermission('visit.write'),
  validate({ params: idParamSchema, body: checkInSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.checkIn(req.params.id as unknown as bigint, req.body)),
  ),
);

salesVisitRouter.post(
  '/:id/items',
  requirePermission('visit.write'),
  validate({ params: idParamSchema, body: recordItemsSchema }),
  asyncHandler(async (req, res) =>
    res.json(
      await svc.recordItems(
        req.params.id as unknown as bigint,
        req.body.items,
      ),
    ),
  ),
);

salesVisitRouter.post(
  '/:id/confirm',
  requirePermission('visit.confirm'),
  validate({ params: idParamSchema, body: confirmSchema }),
  asyncHandler(async (req, res) =>
    res.json(
      await svc.confirmVisit(
        req.params.id as unknown as bigint,
        req.body,
        req.user,
      ),
    ),
  ),
);

salesVisitRouter.post(
  '/:id/checkout',
  requirePermission('visit.write'),
  validate({ params: idParamSchema, body: checkOutSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.checkOut(req.params.id as unknown as bigint, req.body)),
  ),
);

salesVisitRouter.post(
  '/:id/cancel',
  requirePermission('visit.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.cancelVisit(req.params.id as unknown as bigint)),
  ),
);
