import 'dotenv/config';
import { execSync } from 'node:child_process';
import bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Integration tests run against TEST_DATABASE_URL. When it is not set, the
 * integration suite is skipped so the test command still passes in
 * environments without a Postgres instance.
 */
export const integrationEnabled = !!process.env.TEST_DATABASE_URL;

let prismaClient: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaClient) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
    prismaClient = new PrismaClient({ log: ['error'] });
  }
  return prismaClient;
}

export async function resetDatabase(): Promise<void> {
  const prisma = getPrisma();
  // Drop and recreate the public schema
  await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  // Re-apply migrations
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
}

export type SeedHandles = {
  customerCod: { id: bigint };
  customerCredit: { id: bigint; credit_limit: string; credit_term_days: number };
  warehouse: { id: bigint };
  productA: { id: bigint; selling_price: string };
  productB: { id: bigint; selling_price: string };
  employee: { id: bigint };
  user: { id: bigint };
};

export async function seedMinimal(): Promise<SeedHandles> {
  const prisma = getPrisma();
  const adminRole = await prisma.role.create({ data: { role_name: 'SYS_ADMIN' } });
  const employee = await prisma.employee.create({
    data: { employee_code: 'E1', employee_name: 'Test Employee' },
  });
  const user = await prisma.appUser.create({
    data: {
      username: 'tester',
      password_hash: await bcrypt.hash('Test@12345', 4),
      role_id: adminRole.role_id,
      employee_id: employee.employee_id,
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { warehouse_code: 'WH1', warehouse_name: 'Main' },
  });
  const productA = await prisma.product.create({
    data: {
      sku_code: 'P-A',
      product_name: 'Product A',
      selling_price: new Prisma.Decimal('10.00'),
      cost: new Prisma.Decimal('5.00'),
    },
  });
  const productB = await prisma.product.create({
    data: {
      sku_code: 'P-B',
      product_name: 'Product B',
      selling_price: new Prisma.Decimal('20.00'),
      cost: new Prisma.Decimal('10.00'),
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      warehouse_id: warehouse.warehouse_id,
      product_id: productA.product_id,
      qty_on_hand: new Prisma.Decimal('500'),
      qty_reserved: new Prisma.Decimal('0'),
      qty_available: new Prisma.Decimal('500'),
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      warehouse_id: warehouse.warehouse_id,
      product_id: productB.product_id,
      qty_on_hand: new Prisma.Decimal('500'),
      qty_reserved: new Prisma.Decimal('0'),
      qty_available: new Prisma.Decimal('500'),
    },
  });
  const customerCod = await prisma.customer.create({
    data: {
      customer_code: 'COD-1',
      customer_name: 'COD Shop',
      credit_term_days: 0,
      credit_limit: new Prisma.Decimal('0'),
    },
  });
  const customerCredit = await prisma.customer.create({
    data: {
      customer_code: 'CR-1',
      customer_name: 'Credit Shop',
      credit_term_days: 7,
      credit_limit: new Prisma.Decimal('1000'),
    },
  });

  return {
    customerCod: { id: customerCod.customer_id },
    customerCredit: {
      id: customerCredit.customer_id,
      credit_limit: '1000',
      credit_term_days: 7,
    },
    warehouse: { id: warehouse.warehouse_id },
    productA: { id: productA.product_id, selling_price: '10.00' },
    productB: { id: productB.product_id, selling_price: '20.00' },
    employee: { id: employee.employee_id },
    user: { id: user.user_id },
  };
}

export function adminUser(handles: SeedHandles) {
  return {
    userId: handles.user.id,
    username: 'tester',
    permissions: ['*'],
    employeeId: handles.employee.id,
  } as const;
}
