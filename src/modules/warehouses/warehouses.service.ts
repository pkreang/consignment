import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/errors/AppError';
import { paginate, parseSort, Pagination } from '../../common/validators/common';

export async function list(p: Pagination & { q?: string; active?: string }) {
  const where: Prisma.WarehouseWhereInput = {};
  if (p.q) {
    where.OR = [
      { warehouse_code: { contains: p.q, mode: 'insensitive' } },
      { warehouse_name: { contains: p.q, mode: 'insensitive' } },
    ];
  }
  if (p.active) where.active_flag = p.active === 'true';
  const sort = parseSort(p.sort, ['warehouse_code', 'warehouse_name', 'created_at']) ?? {
    field: 'warehouse_code',
    order: 'asc',
  };
  const [data, total] = await Promise.all([
    prisma.warehouse.findMany({
      where,
      orderBy: { [sort.field]: sort.order },
      ...paginate(p),
    }),
    prisma.warehouse.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function get(id: bigint) {
  const r = await prisma.warehouse.findUnique({ where: { warehouse_id: id } });
  if (!r) throw new NotFoundError('Warehouse not found');
  return r;
}

export async function create(input: {
  warehouse_code: string;
  warehouse_name: string;
  active_flag?: boolean;
}) {
  return prisma.warehouse.create({ data: input });
}

export async function update(
  id: bigint,
  input: Partial<{ warehouse_code: string; warehouse_name: string; active_flag: boolean }>,
) {
  await get(id);
  return prisma.warehouse.update({ where: { warehouse_id: id }, data: input });
}

export async function softDelete(id: bigint) {
  await get(id);
  return prisma.warehouse.update({
    where: { warehouse_id: id },
    data: { active_flag: false },
  });
}
