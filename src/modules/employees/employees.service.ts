import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/errors/AppError';
import { paginate, parseSort, Pagination } from '../../common/validators/common';

export async function list(p: Pagination & { q?: string; active?: string }) {
  const where: Prisma.EmployeeWhereInput = {};
  if (p.q) {
    where.OR = [
      { employee_code: { contains: p.q, mode: 'insensitive' } },
      { employee_name: { contains: p.q, mode: 'insensitive' } },
    ];
  }
  if (p.active) where.active_flag = p.active === 'true';
  const sort = parseSort(p.sort, ['employee_code', 'employee_name', 'created_at']) ?? {
    field: 'employee_code',
    order: 'asc',
  };
  const [data, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { [sort.field]: sort.order },
      ...paginate(p),
    }),
    prisma.employee.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}
export async function get(id: bigint) {
  const r = await prisma.employee.findUnique({ where: { employee_id: id } });
  if (!r) throw new NotFoundError('Employee not found');
  return r;
}
export async function create(input: {
  employee_code: string;
  employee_name: string;
  mobile_no?: string;
  active_flag?: boolean;
}) {
  return prisma.employee.create({ data: input });
}
export async function update(
  id: bigint,
  input: Partial<{
    employee_code: string;
    employee_name: string;
    mobile_no: string;
    active_flag: boolean;
  }>,
) {
  await get(id);
  return prisma.employee.update({ where: { employee_id: id }, data: input });
}
export async function softDelete(id: bigint) {
  await get(id);
  return prisma.employee.update({
    where: { employee_id: id },
    data: { active_flag: false },
  });
}
