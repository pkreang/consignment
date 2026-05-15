import { Router } from 'express';
import { Decimal } from 'decimal.js';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { idParamSchema } from '../../common/validators/common';
import {
  creditRiskQuery,
  policyUpdateSchema,
  validateCreditSchema,
} from './credit.dto';
import * as svc from './credit.service';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/errors/AppError';
import { toDecimal } from '../../common/utils/money';

export const creditRouter = Router();
creditRouter.use(authenticate);

creditRouter.get(
  '/customers/:id/exposure',
  requirePermission('credit.read'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) =>
    res.json(await svc.getCustomerExposure(req.params.id as unknown as bigint)),
  ),
);

creditRouter.post(
  '/customers/:id/validate',
  requirePermission('credit.read'),
  validate({ params: idParamSchema, body: validateCreditSchema }),
  asyncHandler(async (req, res) => {
    const customer_id = req.params.id as unknown as bigint;
    let additional = new Decimal(req.body.additional_value ?? '0');
    if (req.body.lines && Array.isArray(req.body.lines)) {
      const productIds: bigint[] = req.body.lines.map(
        (l: { product_id: bigint }) => l.product_id,
      );
      const products = await prisma.product.findMany({
        where: { product_id: { in: productIds } },
        select: { product_id: true, selling_price: true },
      });
      const priceMap = new Map(
        products.map((p) => [p.product_id.toString(), toDecimal(p.selling_price)]),
      );
      for (const l of req.body.lines as Array<{
        product_id: bigint;
        qty: string;
        unit_price?: string;
      }>) {
        const price = l.unit_price
          ? toDecimal(l.unit_price)
          : priceMap.get(l.product_id.toString());
        if (!price) {
          throw new NotFoundError(`Product ${l.product_id} not found`);
        }
        additional = additional.plus(new Decimal(l.qty).times(price));
      }
    }
    const exposure = await svc.getCustomerExposure(customer_id);
    const projected = new Decimal(exposure.credit_exposure).plus(additional);
    const limit = new Decimal(exposure.credit_limit);
    const allowed = !exposure.has_limit || projected.lte(limit);
    res.json({
      ...exposure,
      customer_id: customer_id.toString(),
      additional_value: additional.toFixed(2),
      projected_exposure: projected.toFixed(2),
      allowed,
      would_require_override: !allowed,
    });
  }),
);

creditRouter.put(
  '/customers/:id/policy',
  requirePermission('credit.policy.write'),
  validate({ params: idParamSchema, body: policyUpdateSchema }),
  asyncHandler(async (req, res) =>
    res.json(
      await svc.updateCreditPolicy(
        req.params.id as unknown as bigint,
        req.body,
        req.user?.userId,
      ),
    ),
  ),
);

creditRouter.get(
  '/risk',
  requirePermission('credit.read'),
  validate({ query: creditRiskQuery }),
  asyncHandler(async (req, res) =>
    res.json(
      await svc.listCreditRiskCustomers(
        Number((req.query as { threshold_pct?: number }).threshold_pct ?? 80),
      ),
    ),
  ),
);
