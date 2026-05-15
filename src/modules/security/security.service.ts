import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/errors/AppError';
import { paginate, parseSort, Pagination } from '../../common/validators/common';

export async function listRoles(p: Pagination) {
  const [data, total] = await Promise.all([
    prisma.role.findMany({
      orderBy: { role_name: 'asc' },
      include: {
        rolePermissions: { include: { permission: true } },
      },
      ...paginate(p),
    }),
    prisma.role.count(),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getRole(id: bigint) {
  const r = await prisma.role.findUnique({
    where: { role_id: id },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!r) throw new NotFoundError('Role not found');
  return r;
}

export async function createRole(input: { role_name: string }) {
  return prisma.role.create({ data: input });
}

export async function updateRole(id: bigint, input: { role_name?: string }) {
  await getRole(id);
  return prisma.role.update({ where: { role_id: id }, data: input });
}

export async function deleteRole(id: bigint) {
  await getRole(id);
  return prisma.role.delete({ where: { role_id: id } });
}

export async function setRolePermissions(id: bigint, permission_ids: bigint[]) {
  await getRole(id);
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { role_id: id } });
    if (permission_ids.length > 0) {
      await tx.rolePermission.createMany({
        data: permission_ids.map((pid) => ({ role_id: id, permission_id: pid })),
        skipDuplicates: true,
      });
    }
  });
  return getRole(id);
}

export async function listPermissions(p: Pagination & { module?: string; q?: string }) {
  const where: Prisma.PermissionWhereInput = {};
  if (p.module) where.module_name = p.module;
  if (p.q) {
    where.OR = [
      { code: { contains: p.q, mode: 'insensitive' } },
      { description: { contains: p.q, mode: 'insensitive' } },
    ];
  }
  const sort = parseSort(p.sort, ['code', 'module_name', 'created_at']) ?? {
    field: 'code',
    order: 'asc',
  };
  const [data, total] = await Promise.all([
    prisma.permission.findMany({
      where,
      orderBy: { [sort.field]: sort.order },
      ...paginate(p),
    }),
    prisma.permission.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}
