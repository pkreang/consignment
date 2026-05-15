import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { NotFoundError } from '../../common/errors/AppError';
import { paginate, parseSort, Pagination } from '../../common/validators/common';

const userSelect = {
  user_id: true,
  username: true,
  full_name: true,
  employee_id: true,
  role_id: true,
  active_flag: true,
  last_login: true,
  created_at: true,
  updated_at: true,
  role: { select: { role_id: true, role_name: true } },
  employee: {
    select: {
      employee_id: true,
      employee_code: true,
      employee_name: true,
    },
  },
} as const;

export async function listUsers(p: Pagination & { q?: string; active?: string }) {
  const where: Prisma.AppUserWhereInput = {};
  if (p.q) {
    where.OR = [
      { username: { contains: p.q, mode: 'insensitive' } },
      { full_name: { contains: p.q, mode: 'insensitive' } },
    ];
  }
  if (p.active) where.active_flag = p.active === 'true';
  const sort = parseSort(p.sort, ['username', 'created_at']) ?? {
    field: 'username',
    order: 'asc',
  };
  const [data, total] = await Promise.all([
    prisma.appUser.findMany({
      where,
      orderBy: { [sort.field]: sort.order },
      select: userSelect,
      ...paginate(p),
    }),
    prisma.appUser.count({ where }),
  ]);
  return { data, total, page: p.page, pageSize: p.pageSize };
}

export async function getUser(id: bigint) {
  const u = await prisma.appUser.findUnique({
    where: { user_id: id },
    select: userSelect,
  });
  if (!u) throw new NotFoundError('User not found');
  return u;
}

export async function createUser(input: {
  username: string;
  password: string;
  full_name?: string;
  employee_id?: bigint;
  role_id?: bigint;
  active_flag?: boolean;
}) {
  const password_hash = await bcrypt.hash(input.password, env.BCRYPT_COST);
  return prisma.appUser.create({
    data: {
      username: input.username,
      password_hash,
      full_name: input.full_name,
      employee_id: input.employee_id,
      role_id: input.role_id,
      active_flag: input.active_flag ?? true,
    },
    select: userSelect,
  });
}

export async function updateUser(
  id: bigint,
  input: Partial<{
    full_name: string;
    employee_id: bigint;
    role_id: bigint;
    active_flag: boolean;
  }>,
) {
  await getUser(id);
  return prisma.appUser.update({
    where: { user_id: id },
    data: input,
    select: userSelect,
  });
}

export async function changePassword(id: bigint, newPassword: string) {
  await getUser(id);
  const password_hash = await bcrypt.hash(newPassword, env.BCRYPT_COST);
  return prisma.appUser.update({
    where: { user_id: id },
    data: { password_hash },
    select: userSelect,
  });
}

export async function deleteUser(id: bigint) {
  await getUser(id);
  return prisma.appUser.update({
    where: { user_id: id },
    data: { active_flag: false },
    select: userSelect,
  });
}
