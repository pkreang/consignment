import bcrypt from 'bcrypt';
import { prisma, withTx } from '../../database/prisma';
import { env } from '../../config/env';
import {
  signAccessToken,
  signRefreshToken,
} from '../../common/middleware/auth';
import { UnauthorizedError } from '../../common/errors/AppError';
import { writeAuditLog } from '../../database/audit';

export async function login(username: string, password: string) {
  const user = await prisma.appUser.findUnique({
    where: { username },
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
      employee: true,
    },
  });
  if (!user || !user.active_flag) {
    throw new UnauthorizedError('Invalid credentials');
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new UnauthorizedError('Invalid credentials');

  await prisma.appUser.update({
    where: { user_id: user.user_id },
    data: { last_login: new Date() },
  });

  const permissions =
    user.role?.role_name === 'SYS_ADMIN'
      ? ['*']
      : (user.role?.rolePermissions ?? []).map((rp) => rp.permission.code);

  const payload = {
    sub: user.user_id.toString(),
    username: user.username,
    roleId: user.role?.role_id?.toString(),
    roleName: user.role?.role_name,
    employeeId: user.employee?.employee_id?.toString(),
    permissions,
  };

  return {
    user: {
      userId: user.user_id.toString(),
      username: user.username,
      fullName: user.full_name,
      role: user.role?.role_name,
      permissions,
      employee: user.employee
        ? {
            employeeId: user.employee.employee_id.toString(),
            employeeCode: user.employee.employee_code,
            employeeName: user.employee.employee_name,
          }
        : null,
    },
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function changeMyPassword(
  userId: bigint,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.appUser.findUnique({
    where: { user_id: userId },
    select: { user_id: true, password_hash: true, active_flag: true },
  });
  if (!user || !user.active_flag) throw new UnauthorizedError();
  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) throw new UnauthorizedError('Current password is incorrect');

  const password_hash = await bcrypt.hash(newPassword, env.BCRYPT_COST);

  await withTx(async (tx) => {
    await tx.appUser.update({
      where: { user_id: userId },
      data: { password_hash },
    });
    await writeAuditLog(tx, {
      tableName: 'app_user',
      recordId: userId,
      action: 'UPDATE',
      newValue: { password_hash },
      context: { event: 'self_change_password' },
    });
  });
}

export async function me(userId: bigint) {
  const user = await prisma.appUser.findUnique({
    where: { user_id: userId },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
      employee: true,
    },
  });
  if (!user) throw new UnauthorizedError();
  const permissions =
    user.role?.role_name === 'SYS_ADMIN'
      ? ['*']
      : (user.role?.rolePermissions ?? []).map((rp) => rp.permission.code);
  return {
    userId: user.user_id.toString(),
    username: user.username,
    fullName: user.full_name,
    role: user.role?.role_name,
    permissions,
    employee: user.employee
      ? {
          employeeId: user.employee.employee_id.toString(),
          employeeCode: user.employee.employee_code,
          employeeName: user.employee.employee_name,
        }
      : null,
  };
}
