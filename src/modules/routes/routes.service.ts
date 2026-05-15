import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/errors/AppError';
import { paginate, parseSort, Pagination } from '../../common/validators/common';

export async function listRoutes(p: Pagination & { q?: string; active?: string }) {
  const where: Prisma.RouteWhereInput = {};
  if (p.q) {
    where.OR = [
      { route_code: { contains: p.q, mode: 'insensitive' } },
      { route_name: { contains: p.q, mode: 'insensitive' } },
    ];
  }
  if (p.active) where.active_flag = p.active === 'true';
  const sort = parseSort(p.sort, ['route_code', 'route_name', 'created_at']) ?? {
    field: 'route_code',
    order: 'asc',
  };
  const [data, total] = await Promise.all([
    prisma.route.findMany({
      where,
      orderBy: { [sort.field]: sort.order },
      ...paginate(p),
    }),
    prisma.route.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getRoute(id: bigint) {
  const r = await prisma.route.findUnique({ where: { route_id: id } });
  if (!r) throw new NotFoundError('Route not found');
  return r;
}
export async function createRoute(input: {
  route_code: string;
  route_name: string;
  active_flag?: boolean;
}) {
  return prisma.route.create({ data: input });
}
export async function updateRoute(
  id: bigint,
  input: Partial<{ route_code: string; route_name: string; active_flag: boolean }>,
) {
  await getRoute(id);
  return prisma.route.update({ where: { route_id: id }, data: input });
}
export async function softDeleteRoute(id: bigint) {
  await getRoute(id);
  return prisma.route.update({
    where: { route_id: id },
    data: { active_flag: false },
  });
}

// --- Customer Route -------------------------------------------------------

export async function listCustomerRoutes(
  p: Pagination & { customer_id?: bigint; route_id?: bigint },
) {
  const where: Prisma.CustomerRouteWhereInput = {};
  if (p.customer_id) where.customer_id = p.customer_id;
  if (p.route_id) where.route_id = p.route_id;
  const [data, total] = await Promise.all([
    prisma.customerRoute.findMany({
      where,
      include: { customer: true, route: true },
      orderBy: { customer_route_id: 'desc' },
      ...paginate(p),
    }),
    prisma.customerRoute.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function createCustomerRoute(input: {
  customer_id: bigint;
  route_id: bigint;
  visit_day?: string;
}) {
  return prisma.customerRoute.create({ data: input });
}

export async function deleteCustomerRoute(id: bigint) {
  return prisma.customerRoute.delete({ where: { customer_route_id: id } });
}
