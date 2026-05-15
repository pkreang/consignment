import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/errors/AppError';
import { paginate, parseSort, Pagination } from '../../common/validators/common';

// ----- Product Category ------------------------------------------------------

export async function listCategories(p: Pagination & { q?: string; active?: string }) {
  const where: Prisma.ProductCategoryWhereInput = {};
  if (p.q) {
    where.OR = [
      { category_code: { contains: p.q, mode: 'insensitive' } },
      { category_name: { contains: p.q, mode: 'insensitive' } },
    ];
  }
  if (p.active) where.active_flag = p.active === 'true';

  const sort = parseSort(p.sort, ['category_code', 'category_name', 'created_at']) ?? {
    field: 'category_code',
    order: 'asc',
  };
  const [data, total] = await Promise.all([
    prisma.productCategory.findMany({
      where,
      orderBy: { [sort.field]: sort.order },
      ...paginate(p),
    }),
    prisma.productCategory.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getCategory(id: bigint) {
  const r = await prisma.productCategory.findUnique({ where: { category_id: id } });
  if (!r) throw new NotFoundError('Product category not found');
  return r;
}

export async function createCategory(input: {
  category_code: string;
  category_name: string;
  active_flag?: boolean;
}) {
  return prisma.productCategory.create({ data: input });
}

export async function updateCategory(
  id: bigint,
  input: Partial<{ category_code: string; category_name: string; active_flag: boolean }>,
) {
  await getCategory(id);
  return prisma.productCategory.update({ where: { category_id: id }, data: input });
}

export async function deleteCategory(id: bigint) {
  await getCategory(id);
  return prisma.productCategory.update({
    where: { category_id: id },
    data: { active_flag: false },
  });
}

// ----- Product ---------------------------------------------------------------

type ProductCreate = {
  sku_code: string;
  barcode?: string;
  product_name: string;
  category_id?: bigint;
  unit?: string;
  cost?: string;
  selling_price?: string;
  shelf_life_days?: number;
  min_stock?: string;
  max_stock?: string;
  active_flag?: boolean;
};

export async function listProducts(
  p: Pagination & { q?: string; category_id?: bigint; active?: string },
) {
  const where: Prisma.ProductWhereInput = {};
  if (p.q) {
    where.OR = [
      { sku_code: { contains: p.q, mode: 'insensitive' } },
      { product_name: { contains: p.q, mode: 'insensitive' } },
      { barcode: { contains: p.q, mode: 'insensitive' } },
    ];
  }
  if (p.category_id) where.category_id = p.category_id;
  if (p.active) where.active_flag = p.active === 'true';

  const sort = parseSort(p.sort, ['sku_code', 'product_name', 'created_at', 'selling_price']) ?? {
    field: 'sku_code',
    order: 'asc',
  };
  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [sort.field]: sort.order },
      include: { category: true },
      ...paginate(p),
    }),
    prisma.product.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getProduct(id: bigint) {
  const r = await prisma.product.findUnique({
    where: { product_id: id },
    include: { category: true },
  });
  if (!r) throw new NotFoundError('Product not found');
  return r;
}

export async function createProduct(input: ProductCreate) {
  return prisma.product.create({
    data: {
      sku_code: input.sku_code,
      barcode: input.barcode,
      product_name: input.product_name,
      category_id: input.category_id ?? null,
      unit: input.unit ?? 'PCS',
      cost: input.cost ?? '0',
      selling_price: input.selling_price ?? '0',
      shelf_life_days: input.shelf_life_days ?? 0,
      min_stock: input.min_stock ?? '0',
      max_stock: input.max_stock ?? '0',
      active_flag: input.active_flag ?? true,
    },
  });
}

export async function updateProduct(id: bigint, input: Partial<ProductCreate>) {
  await getProduct(id);
  return prisma.product.update({
    where: { product_id: id },
    data: {
      sku_code: input.sku_code,
      barcode: input.barcode,
      product_name: input.product_name,
      category_id: input.category_id ?? undefined,
      unit: input.unit,
      cost: input.cost,
      selling_price: input.selling_price,
      shelf_life_days: input.shelf_life_days,
      min_stock: input.min_stock,
      max_stock: input.max_stock,
      active_flag: input.active_flag,
    },
  });
}

export async function deleteProduct(id: bigint) {
  await getProduct(id);
  return prisma.product.update({
    where: { product_id: id },
    data: { active_flag: false },
  });
}
