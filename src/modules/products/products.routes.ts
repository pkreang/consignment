import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import {
  idParamSchema,
  paginationSchema,
} from '../../common/validators/common';
import {
  productCategoryCreateSchema,
  productCategoryUpdateSchema,
  productCreateSchema,
  productListQuery,
  productUpdateSchema,
} from './products.dto';
import * as svc from './products.service';

// --- Categories -------------------------------------------------------------

export const productCategoryRouter = Router();

productCategoryRouter.use(authenticate);

productCategoryRouter.get(
  '/',
  requirePermission('product.read'),
  validate({ query: paginationSchema.extend({}) }),
  asyncHandler(async (req, res) => {
    res.json(await svc.listCategories(req.query as never));
  }),
);

productCategoryRouter.get(
  '/:id',
  requirePermission('product.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await svc.getCategory(req.params.id as unknown as bigint));
  }),
);

productCategoryRouter.post(
  '/',
  requirePermission('product.write'),
  validate({ body: productCategoryCreateSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createCategory(req.body));
  }),
);

productCategoryRouter.put(
  '/:id',
  requirePermission('product.write'),
  validate({ params: idParamSchema, body: productCategoryUpdateSchema }),
  asyncHandler(async (req, res) => {
    res.json(
      await svc.updateCategory(req.params.id as unknown as bigint, req.body),
    );
  }),
);

productCategoryRouter.delete(
  '/:id',
  requirePermission('product.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await svc.deleteCategory(req.params.id as unknown as bigint));
  }),
);

// --- Products ---------------------------------------------------------------

export const productRouter = Router();

productRouter.use(authenticate);

productRouter.get(
  '/',
  requirePermission('product.read'),
  validate({ query: productListQuery }),
  asyncHandler(async (req, res) => {
    res.json(await svc.listProducts(req.query as never));
  }),
);

productRouter.get(
  '/:id',
  requirePermission('product.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await svc.getProduct(req.params.id as unknown as bigint));
  }),
);

productRouter.post(
  '/',
  requirePermission('product.write'),
  validate({ body: productCreateSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createProduct(req.body));
  }),
);

productRouter.put(
  '/:id',
  requirePermission('product.write'),
  validate({ params: idParamSchema, body: productUpdateSchema }),
  asyncHandler(async (req, res) => {
    res.json(
      await svc.updateProduct(req.params.id as unknown as bigint, req.body),
    );
  }),
);

productRouter.delete(
  '/:id',
  requirePermission('product.write'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await svc.deleteProduct(req.params.id as unknown as bigint));
  }),
);
