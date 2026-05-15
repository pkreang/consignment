import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import {
  idParamSchema,
  paginationSchema,
} from '../../common/validators/common';
import {
  customerCreateSchema,
  customerGroupCreateSchema,
  customerGroupUpdateSchema,
  customerListQuery,
  customerUpdateSchema,
} from './customers.dto';
import * as svc from './customers.service';
import { getCustomerExposure } from '../credit/credit.service';

// --- Groups ----------------------------------------------------------------

export const customerGroupRouter = Router();
customerGroupRouter.use(authenticate);

customerGroupRouter.get(
  '/',
  requirePermission('customer.read'),
  validate({ query: paginationSchema.extend({}) }),
  asyncHandler(async (req, res) => {
    res.json(await svc.listGroups(req.query as never));
  }),
);
customerGroupRouter.get(
  '/:id',
  requirePermission('customer.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await svc.getGroup(req.params.id as unknown as bigint));
  }),
);
customerGroupRouter.post(
  '/',
  requirePermission('customer.write'),
  validate({ body: customerGroupCreateSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createGroup(req.body));
  }),
);
customerGroupRouter.put(
  '/:id',
  requirePermission('customer.write'),
  validate({ params: idParamSchema, body: customerGroupUpdateSchema }),
  asyncHandler(async (req, res) => {
    res.json(await svc.updateGroup(req.params.id as unknown as bigint, req.body));
  }),
);
customerGroupRouter.delete(
  '/:id',
  requirePermission('customer.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await svc.deleteGroup(req.params.id as unknown as bigint));
  }),
);

// --- Customers --------------------------------------------------------------

export const customerRouter = Router();
customerRouter.use(authenticate);

customerRouter.get(
  '/',
  requirePermission('customer.read'),
  validate({ query: customerListQuery }),
  asyncHandler(async (req, res) => {
    res.json(await svc.listCustomers(req.query as never));
  }),
);

customerRouter.get(
  '/:id',
  requirePermission('customer.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await svc.getCustomer(req.params.id as unknown as bigint));
  }),
);

customerRouter.post(
  '/',
  requirePermission('customer.write'),
  validate({ body: customerCreateSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createCustomer(req.body));
  }),
);

customerRouter.put(
  '/:id',
  requirePermission('customer.write'),
  validate({ params: idParamSchema, body: customerUpdateSchema }),
  asyncHandler(async (req, res) => {
    res.json(
      await svc.updateCustomer(req.params.id as unknown as bigint, req.body),
    );
  }),
);

customerRouter.get(
  '/:id/stock',
  requirePermission('customer.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await svc.getCustomerStock(req.params.id as unknown as bigint));
  }),
);

customerRouter.get(
  '/:id/sales-history',
  requirePermission('customer.read'),
  validate({ params: idParamSchema, query: paginationSchema.extend({}) }),
  asyncHandler(async (req, res) => {
    res.json(
      await svc.getCustomerSalesHistory(
        req.params.id as unknown as bigint,
        req.query as never,
      ),
    );
  }),
);

customerRouter.get(
  '/:id/collection-history',
  requirePermission('customer.read'),
  validate({ params: idParamSchema, query: paginationSchema.extend({}) }),
  asyncHandler(async (req, res) => {
    res.json(
      await svc.getCustomerCollectionHistory(
        req.params.id as unknown as bigint,
        req.query as never,
      ),
    );
  }),
);

customerRouter.get(
  '/:id/ar',
  requirePermission('customer.read'),
  validate({ params: idParamSchema, query: paginationSchema.extend({}) }),
  asyncHandler(async (req, res) => {
    res.json(
      await svc.getCustomerAr(
        req.params.id as unknown as bigint,
        req.query as never,
      ),
    );
  }),
);

customerRouter.get(
  '/:id/credit-exposure',
  requirePermission('credit.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await getCustomerExposure(req.params.id as unknown as bigint));
  }),
);
