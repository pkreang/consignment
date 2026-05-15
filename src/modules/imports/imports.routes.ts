/**
 * Bulk-import endpoints for master data. Operators upload a CSV (or paste it
 * as a JSON `csv` field) and we upsert by the natural key in a single
 * transaction. Validation errors are returned per-row so the user can fix the
 * spreadsheet without re-uploading partial state.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { ConflictError } from '../../common/errors/AppError';
import { prisma, withTx } from '../../database/prisma';
import { parseCsv } from '../../common/utils/csvParser';
import { Prisma } from '@prisma/client';

export const importsRouter = Router();
importsRouter.use(authenticate);

function readCsv(req: Request): string {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body.csv === 'string') return req.body.csv as string;
  throw new ConflictError(
    'Expected Content-Type: text/csv with CSV body, or { "csv": "..." } JSON',
  );
}

const productSchema = z.object({
  sku_code: z.string().min(1).max(50),
  product_name: z.string().min(1).max(255),
  category_code: z.string().max(20).optional(),
  unit: z.string().max(20).optional(),
  cost: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  selling_price: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  shelf_life_days: z.string().regex(/^\d+$/).optional(),
  min_stock: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  max_stock: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  barcode: z.string().max(100).optional(),
  active_flag: z.string().optional(),
});

const customerSchema = z.object({
  customer_code: z.string().min(1).max(50),
  customer_name: z.string().min(1).max(255),
  group_name: z.string().max(100).optional(),
  owner_name: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(2000).optional(),
  province: z.string().max(100).optional(),
  credit_term_days: z.string().regex(/^\d+$/).optional(),
  credit_limit: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  max_capacity_qty: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  visit_frequency_days: z.string().regex(/^\d+$/).optional(),
  active_flag: z.string().optional(),
});

const toBool = (v: string | undefined): boolean | undefined =>
  v === undefined || v === '' ? undefined : /^(true|1|yes|y)$/i.test(v);

importsRouter.post(
  '/products',
  requirePermission('product.write'),
  asyncHandler(async (req: Request, res: Response) => {
    const csv = readCsv(req);
    const rows = parseCsv(csv);
    const errors: Array<{ line: number; error: string }> = [];
    const cleaned: Array<z.infer<typeof productSchema>> = [];
    rows.forEach((r, i) => {
      const parsed = productSchema.safeParse(r);
      if (!parsed.success) {
        errors.push({ line: i + 2, error: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ') });
      } else cleaned.push(parsed.data);
    });
    if (errors.length) {
      res.status(422).json({ ok: false, total: rows.length, errors });
      return;
    }
    const result = await withTx(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const r of cleaned) {
        let categoryId: bigint | null = null;
        if (r.category_code) {
          const cat = await tx.productCategory.findUnique({
            where: { category_code: r.category_code },
          });
          if (cat) categoryId = cat.category_id;
        }
        const data = {
          sku_code: r.sku_code,
          product_name: r.product_name,
          category_id: categoryId,
          unit: r.unit ?? 'PCS',
          cost: new Prisma.Decimal(r.cost ?? '0'),
          selling_price: new Prisma.Decimal(r.selling_price ?? '0'),
          shelf_life_days: r.shelf_life_days ? Number(r.shelf_life_days) : 0,
          min_stock: new Prisma.Decimal(r.min_stock ?? '0'),
          max_stock: new Prisma.Decimal(r.max_stock ?? '0'),
          barcode: r.barcode ?? null,
          active_flag: toBool(r.active_flag) ?? true,
        };
        const existing = await tx.product.findUnique({ where: { sku_code: r.sku_code } });
        if (existing) {
          await tx.product.update({ where: { product_id: existing.product_id }, data });
          updated++;
        } else {
          await tx.product.create({ data });
          created++;
        }
      }
      return { created, updated };
    });
    res.json({ ok: true, total: rows.length, ...result });
  }),
);

importsRouter.post(
  '/customers',
  requirePermission('customer.write'),
  asyncHandler(async (req, res) => {
    const csv = readCsv(req);
    const rows = parseCsv(csv);
    const errors: Array<{ line: number; error: string }> = [];
    const cleaned: Array<z.infer<typeof customerSchema>> = [];
    rows.forEach((r, i) => {
      const parsed = customerSchema.safeParse(r);
      if (!parsed.success) {
        errors.push({ line: i + 2, error: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ') });
      } else cleaned.push(parsed.data);
    });
    if (errors.length) {
      res.status(422).json({ ok: false, total: rows.length, errors });
      return;
    }
    const result = await withTx(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const r of cleaned) {
        let groupId: bigint | null = null;
        if (r.group_name) {
          const existing =
            (await tx.customerGroup.findFirst({ where: { group_name: r.group_name } })) ??
            (await tx.customerGroup.create({ data: { group_name: r.group_name } }));
          groupId = existing.group_id;
        }
        const data = {
          customer_code: r.customer_code,
          customer_name: r.customer_name,
          group_id: groupId,
          owner_name: r.owner_name ?? null,
          phone: r.phone ?? null,
          address: r.address ?? null,
          province: r.province ?? null,
          credit_term_days: r.credit_term_days ? Number(r.credit_term_days) : 0,
          credit_limit: new Prisma.Decimal(r.credit_limit ?? '0'),
          max_capacity_qty: new Prisma.Decimal(r.max_capacity_qty ?? '0'),
          visit_frequency_days: r.visit_frequency_days
            ? Number(r.visit_frequency_days)
            : 3,
          active_flag: toBool(r.active_flag) ?? true,
        };
        const existing = await tx.customer.findUnique({
          where: { customer_code: r.customer_code },
        });
        if (existing) {
          await tx.customer.update({ where: { customer_id: existing.customer_id }, data });
          updated++;
        } else {
          await tx.customer.create({ data });
          created++;
        }
      }
      return { created, updated };
    });
    res.json({ ok: true, total: rows.length, ...result });
  }),
);

// Sample CSVs for the operator UI / docs.
importsRouter.get('/products/sample.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(
    'sku_code,product_name,category_code,unit,cost,selling_price,min_stock,max_stock,active_flag\n' +
      'BR-100,Croissant Plain,BAKERY,PCS,8.00,18.00,50,500,true\n' +
      'BR-101,Croissant Almond,BAKERY,PCS,10.00,22.00,30,300,true\n',
  );
});
importsRouter.get('/customers/sample.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(
    'customer_code,customer_name,group_name,owner_name,phone,address,province,credit_term_days,credit_limit,visit_frequency_days,active_flag\n' +
      'CUST-9001,New Shop A,Standard,Owner A,081-000-9001,1/1 Sample St,Bangkok,0,0,3,true\n' +
      'CUST-9002,New Shop B (credit),Standard,Owner B,081-000-9002,2/2 Sample Rd,Bangkok,7,15000,3,true\n',
  );
});

if (prisma) {
  // touch to silence dead-code linters in some configurations
}
