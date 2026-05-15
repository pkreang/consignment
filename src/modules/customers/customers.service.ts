import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/errors/AppError';
import { paginate, parseSort, Pagination } from '../../common/validators/common';

// --- Customer Group ---------------------------------------------------------

export async function listGroups(p: Pagination & { q?: string }) {
  const where: Prisma.CustomerGroupWhereInput = p.q
    ? { group_name: { contains: p.q, mode: 'insensitive' } }
    : {};
  const sort = parseSort(p.sort, ['group_name', 'created_at']) ?? {
    field: 'group_name',
    order: 'asc',
  };
  const [data, total] = await Promise.all([
    prisma.customerGroup.findMany({
      where,
      orderBy: { [sort.field]: sort.order },
      ...paginate(p),
    }),
    prisma.customerGroup.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}
export async function getGroup(id: bigint) {
  const r = await prisma.customerGroup.findUnique({ where: { group_id: id } });
  if (!r) throw new NotFoundError('Customer group not found');
  return r;
}
export async function createGroup(input: { group_name: string }) {
  return prisma.customerGroup.create({ data: input });
}
export async function updateGroup(id: bigint, input: { group_name?: string }) {
  await getGroup(id);
  return prisma.customerGroup.update({ where: { group_id: id }, data: input });
}
export async function deleteGroup(id: bigint) {
  await getGroup(id);
  return prisma.customerGroup.delete({ where: { group_id: id } });
}

// --- Customer ---------------------------------------------------------------

type CustomerInput = {
  customer_code?: string;
  customer_name?: string;
  group_id?: bigint;
  owner_name?: string;
  phone?: string;
  line_id?: string;
  address?: string;
  province?: string;
  latitude?: string;
  longitude?: string;
  visit_frequency_days?: number;
  max_capacity_qty?: string;
  credit_term_days?: number;
  credit_limit?: string;
  active_flag?: boolean;
};

export async function listCustomers(
  p: Pagination & {
    q?: string;
    group_id?: bigint;
    active?: string;
    province?: string;
  },
) {
  const where: Prisma.CustomerWhereInput = {};
  if (p.q) {
    where.OR = [
      { customer_code: { contains: p.q, mode: 'insensitive' } },
      { customer_name: { contains: p.q, mode: 'insensitive' } },
      { phone: { contains: p.q, mode: 'insensitive' } },
    ];
  }
  if (p.group_id) where.group_id = p.group_id;
  if (p.active) where.active_flag = p.active === 'true';
  if (p.province) where.province = p.province;

  const sort = parseSort(p.sort, [
    'customer_code',
    'customer_name',
    'created_at',
    'credit_limit',
  ]) ?? { field: 'customer_code', order: 'asc' };

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { [sort.field]: sort.order },
      include: { group: true },
      ...paginate(p),
    }),
    prisma.customer.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getCustomer(id: bigint) {
  const r = await prisma.customer.findUnique({
    where: { customer_id: id },
    include: { group: true },
  });
  if (!r) throw new NotFoundError('Customer not found');
  return r;
}

export async function createCustomer(input: CustomerInput) {
  return prisma.customer.create({
    data: {
      customer_code: input.customer_code!,
      customer_name: input.customer_name!,
      group_id: input.group_id ?? null,
      owner_name: input.owner_name,
      phone: input.phone,
      line_id: input.line_id,
      address: input.address,
      province: input.province,
      latitude: input.latitude,
      longitude: input.longitude,
      visit_frequency_days: input.visit_frequency_days ?? 3,
      max_capacity_qty: input.max_capacity_qty ?? '0',
      credit_term_days: input.credit_term_days ?? 0,
      credit_limit: input.credit_limit ?? '0',
      active_flag: input.active_flag ?? true,
    },
  });
}

export async function updateCustomer(id: bigint, input: CustomerInput) {
  await getCustomer(id);
  return prisma.customer.update({
    where: { customer_id: id },
    data: {
      customer_code: input.customer_code,
      customer_name: input.customer_name,
      group_id: input.group_id ?? undefined,
      owner_name: input.owner_name,
      phone: input.phone,
      line_id: input.line_id,
      address: input.address,
      province: input.province,
      latitude: input.latitude,
      longitude: input.longitude,
      visit_frequency_days: input.visit_frequency_days,
      max_capacity_qty: input.max_capacity_qty,
      credit_term_days: input.credit_term_days,
      credit_limit: input.credit_limit,
      active_flag: input.active_flag,
    },
  });
}

export async function getCustomerStock(customer_id: bigint) {
  await getCustomer(customer_id);
  return prisma.consignmentStock.findMany({
    where: { customer_id },
    include: { product: true },
    orderBy: { product: { sku_code: 'asc' } },
  });
}

export async function getCustomerSalesHistory(
  customer_id: bigint,
  p: Pagination,
) {
  await getCustomer(customer_id);
  const [data, total] = await Promise.all([
    prisma.salesVisit.findMany({
      where: { customer_id },
      orderBy: { visit_date: 'desc' },
      include: { items: { include: { product: true } } },
      ...paginate(p),
    }),
    prisma.salesVisit.count({ where: { customer_id } }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getCustomerCollectionHistory(
  customer_id: bigint,
  p: Pagination,
) {
  await getCustomer(customer_id);
  const [data, total] = await Promise.all([
    prisma.collection.findMany({
      where: { customer_id },
      orderBy: { collection_date: 'desc' },
      ...paginate(p),
    }),
    prisma.collection.count({ where: { customer_id } }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getCustomerAr(customer_id: bigint, p: Pagination) {
  await getCustomer(customer_id);
  const [data, total] = await Promise.all([
    prisma.arInvoice.findMany({
      where: { customer_id },
      orderBy: { invoice_date: 'desc' },
      include: { items: true, payments: true },
      ...paginate(p),
    }),
    prisma.arInvoice.count({ where: { customer_id } }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}
