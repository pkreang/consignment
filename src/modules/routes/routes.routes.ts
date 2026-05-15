import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idParamSchema } from '../../common/validators/common';
import {
  customerRouteCreateSchema,
  customerRouteListQuery,
  routeCreateSchema,
  routeListQuery,
  routeUpdateSchema,
} from './routes.dto';
import * as svc from './routes.service';

export const routeRouter = Router();
routeRouter.use(authenticate);

routeRouter.get(
  '/',
  requirePermission('route.read'),
  validate({ query: routeListQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listRoutes(req.query as never)),
  ),
);
routeRouter.get(
  '/:id',
  requirePermission('route.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.getRoute(req.params.id as unknown as bigint)),
  ),
);
routeRouter.post(
  '/',
  requirePermission('route.write'),
  validate({ body: routeCreateSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.createRoute(req.body)),
  ),
);
routeRouter.put(
  '/:id',
  requirePermission('route.write'),
  validate({ params: idParamSchema, body: routeUpdateSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.updateRoute(req.params.id as unknown as bigint, req.body)),
  ),
);
routeRouter.delete(
  '/:id',
  requirePermission('route.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.softDeleteRoute(req.params.id as unknown as bigint)),
  ),
);

export const customerRouteRouter = Router();
customerRouteRouter.use(authenticate);

customerRouteRouter.get(
  '/',
  requirePermission('route.read'),
  validate({ query: customerRouteListQuery }),
  asyncHandler(async (req, res) =>
    res.json(await svc.listCustomerRoutes(req.query as never)),
  ),
);
customerRouteRouter.post(
  '/',
  requirePermission('route.write'),
  validate({ body: customerRouteCreateSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.createCustomerRoute(req.body)),
  ),
);
customerRouteRouter.delete(
  '/:id',
  requirePermission('route.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.deleteCustomerRoute(req.params.id as unknown as bigint)),
  ),
);
