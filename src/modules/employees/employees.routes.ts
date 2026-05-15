import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idParamSchema } from '../../common/validators/common';
import {
  employeeCreateSchema,
  employeeListQuery,
  employeeUpdateSchema,
} from './employees.dto';
import * as svc from './employees.service';

export const employeeRouter = Router();
employeeRouter.use(authenticate);

employeeRouter.get(
  '/',
  requirePermission('employee.read'),
  validate({ query: employeeListQuery }),
  asyncHandler(async (req, res) => res.json(await svc.list(req.query as never))),
);
employeeRouter.get(
  '/:id',
  requirePermission('employee.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.get(req.params.id as unknown as bigint)),
  ),
);
employeeRouter.post(
  '/',
  requirePermission('employee.write'),
  validate({ body: employeeCreateSchema }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.create(req.body)),
  ),
);
employeeRouter.put(
  '/:id',
  requirePermission('employee.write'),
  validate({ params: idParamSchema, body: employeeUpdateSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.update(req.params.id as unknown as bigint, req.body)),
  ),
);
employeeRouter.delete(
  '/:id',
  requirePermission('employee.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.softDelete(req.params.id as unknown as bigint)),
  ),
);
