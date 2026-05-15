import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idParamSchema } from '../../common/validators/common';
import {
  collectionCreateSchema,
  collectionListQuery,
} from './collections.dto';
import * as svc from './collections.service';

export const collectionRouter = Router();
collectionRouter.use(authenticate);

collectionRouter.get(
  '/',
  requirePermission('collection.read'),
  validate({ query: collectionListQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listCollections(req.query as never)),
  ),
);

collectionRouter.get(
  '/:id',
  requirePermission('collection.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.getCollection(req.params.id as unknown as bigint)),
  ),
);

collectionRouter.post(
  '/',
  requirePermission('collection.write'),
  validate({ body: collectionCreateSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(
      await svc.createCollection({
        customer_id: req.body.customer_id,
        amount_collected: req.body.amount_collected,
        payment_method: req.body.payment_method,
        reference_no: req.body.reference_no,
        note: req.body.note,
        collected_by: req.body.collected_by ?? req.user?.employeeId,
        collection_date: req.body.collection_date,
      }),
    ),
  ),
);
