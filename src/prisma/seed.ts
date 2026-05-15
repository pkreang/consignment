import 'dotenv/config';
import bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS: Array<{ code: string; module: string; action: string; description: string }> = [
  // master data
  { code: 'product.read', module: 'product', action: 'read', description: 'View products and categories' },
  { code: 'product.write', module: 'product', action: 'write', description: 'Create/update products and categories' },
  { code: 'customer.read', module: 'customer', action: 'read', description: 'View customers' },
  { code: 'customer.write', module: 'customer', action: 'write', description: 'Create/update customers' },
  { code: 'warehouse.read', module: 'warehouse', action: 'read', description: 'View warehouses' },
  { code: 'warehouse.write', module: 'warehouse', action: 'write', description: 'Manage warehouses' },
  { code: 'employee.read', module: 'employee', action: 'read', description: 'View employees' },
  { code: 'employee.write', module: 'employee', action: 'write', description: 'Manage employees' },
  { code: 'route.read', module: 'route', action: 'read', description: 'View routes' },
  { code: 'route.write', module: 'route', action: 'write', description: 'Manage routes' },
  { code: 'user.read', module: 'user', action: 'read', description: 'View users' },
  { code: 'user.write', module: 'user', action: 'write', description: 'Manage users/roles/permissions' },

  // inventory
  { code: 'inventory.read', module: 'inventory', action: 'read', description: 'View stock' },
  { code: 'inventory.adjust', module: 'inventory', action: 'adjust', description: 'Adjust warehouse stock' },
  { code: 'inventory.production_receipt', module: 'inventory', action: 'production_receipt', description: 'Record production receipts' },
  { code: 'inventory.load', module: 'inventory', action: 'load', description: 'Load stock to a customer' },
  { code: 'inventory.return', module: 'inventory', action: 'return', description: 'Return stock from a customer' },

  // sales visits
  { code: 'visit.read', module: 'sales_visit', action: 'read', description: 'View sales visits' },
  { code: 'visit.write', module: 'sales_visit', action: 'write', description: 'Create/update sales visits' },
  { code: 'visit.confirm', module: 'sales_visit', action: 'confirm', description: 'Confirm sales visits' },

  // collection / AR
  { code: 'collection.read', module: 'collection', action: 'read', description: 'View collections' },
  { code: 'collection.write', module: 'collection', action: 'write', description: 'Record collections' },
  { code: 'ar.read', module: 'ar', action: 'read', description: 'View AR invoices and payments' },
  { code: 'ar.invoice.create_manual', module: 'ar', action: 'create_manual_invoice', description: 'Create AR invoices manually' },
  { code: 'ar.payment.write', module: 'ar', action: 'pay', description: 'Record AR payments' },

  // credit
  { code: 'credit.read', module: 'credit', action: 'read', description: 'View credit exposure' },
  { code: 'credit.policy.write', module: 'credit', action: 'policy', description: 'Update credit terms / limits' },
  { code: 'credit.override', module: 'credit', action: 'override', description: 'Override credit limit blocks' },

  // reports
  { code: 'report.read', module: 'report', action: 'read', description: 'View reports' },
];

const ROLES: Array<{ name: string; permissions: string[] }> = [
  { name: 'SYS_ADMIN', permissions: ['*'] },
  {
    name: 'OPS_MANAGER',
    permissions: [
      'product.read', 'product.write',
      'customer.read', 'customer.write',
      'warehouse.read', 'warehouse.write',
      'employee.read', 'employee.write',
      'route.read', 'route.write',
      'user.read',
      'inventory.read', 'inventory.adjust', 'inventory.production_receipt',
      'inventory.load', 'inventory.return',
      'visit.read', 'visit.write', 'visit.confirm',
      'collection.read', 'collection.write',
      'ar.read', 'ar.invoice.create_manual', 'ar.payment.write',
      'credit.read', 'credit.policy.write', 'credit.override',
      'report.read',
    ],
  },
  {
    name: 'SALES_REP',
    permissions: [
      'product.read',
      'customer.read',
      'inventory.read', 'inventory.load', 'inventory.return',
      'visit.read', 'visit.write', 'visit.confirm',
      'collection.read', 'collection.write',
      'ar.read', 'ar.payment.write',
      'credit.read',
    ],
  },
  {
    name: 'WAREHOUSE_OFFICER',
    permissions: [
      'product.read',
      'warehouse.read',
      'inventory.read', 'inventory.adjust', 'inventory.production_receipt',
      'report.read',
    ],
  },
  {
    name: 'FINANCE',
    permissions: [
      'customer.read',
      'collection.read',
      'ar.read', 'ar.invoice.create_manual', 'ar.payment.write',
      'credit.read', 'credit.policy.write',
      'report.read',
    ],
  },
];

async function upsertPermissions() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { module_name: p.module, action_name: p.action, description: p.description },
      create: { code: p.code, module_name: p.module, action_name: p.action, description: p.description },
    });
  }
}

async function upsertRoles() {
  const allPerms = await prisma.permission.findMany();
  const byCode = new Map(allPerms.map((p) => [p.code, p.permission_id] as const));
  for (const role of ROLES) {
    const r = await prisma.role.upsert({
      where: { role_name: role.name },
      update: {},
      create: { role_name: role.name },
    });
    let permIds: bigint[];
    if (role.permissions.length === 1 && role.permissions[0] === '*') {
      permIds = allPerms.map((p) => p.permission_id);
    } else {
      permIds = role.permissions
        .map((c) => byCode.get(c))
        .filter((v): v is bigint => v !== undefined);
    }
    for (const pid of permIds) {
      await prisma.rolePermission.upsert({
        where: { role_id_permission_id: { role_id: r.role_id, permission_id: pid } },
        update: {},
        create: { role_id: r.role_id, permission_id: pid },
      });
    }
  }
}

async function seedMasterData() {
  const cat = await prisma.productCategory.upsert({
    where: { category_code: 'BAKERY' },
    update: { category_name: 'Bakery' },
    create: { category_code: 'BAKERY', category_name: 'Bakery' },
  });
  const snacks = await prisma.productCategory.upsert({
    where: { category_code: 'SNACKS' },
    update: { category_name: 'Snacks' },
    create: { category_code: 'SNACKS', category_name: 'Snacks' },
  });

  await prisma.product.upsert({
    where: { sku_code: 'BR-001' },
    update: {},
    create: {
      sku_code: 'BR-001',
      product_name: 'Soft Bun (Original)',
      category_id: cat.category_id,
      unit: 'PCS',
      cost: new Prisma.Decimal('5.00'),
      selling_price: new Prisma.Decimal('12.00'),
      min_stock: new Prisma.Decimal('100'),
      max_stock: new Prisma.Decimal('2000'),
    },
  });

  await prisma.product.upsert({
    where: { sku_code: 'BR-002' },
    update: {},
    create: {
      sku_code: 'BR-002',
      product_name: 'Soft Bun (Chocolate)',
      category_id: cat.category_id,
      unit: 'PCS',
      cost: new Prisma.Decimal('6.00'),
      selling_price: new Prisma.Decimal('14.00'),
      min_stock: new Prisma.Decimal('100'),
      max_stock: new Prisma.Decimal('2000'),
    },
  });

  await prisma.product.upsert({
    where: { sku_code: 'SN-001' },
    update: {},
    create: {
      sku_code: 'SN-001',
      product_name: 'Potato Crisps',
      category_id: snacks.category_id,
      unit: 'PCS',
      cost: new Prisma.Decimal('8.00'),
      selling_price: new Prisma.Decimal('20.00'),
      min_stock: new Prisma.Decimal('50'),
      max_stock: new Prisma.Decimal('1000'),
    },
  });

  await prisma.warehouse.upsert({
    where: { warehouse_code: 'MAIN' },
    update: { warehouse_name: 'Main Warehouse' },
    create: { warehouse_code: 'MAIN', warehouse_name: 'Main Warehouse' },
  });

  await prisma.customerGroup.upsert({
    where: { group_id: 1n },
    update: { group_name: 'Standard' },
    create: { group_name: 'Standard' },
  }).catch(() => undefined);

  const standardGroup =
    (await prisma.customerGroup.findFirst({ where: { group_name: 'Standard' } })) ??
    (await prisma.customerGroup.create({ data: { group_name: 'Standard' } }));

  await prisma.customer.upsert({
    where: { customer_code: 'CUST-0001' },
    update: {},
    create: {
      customer_code: 'CUST-0001',
      customer_name: 'Demo Shop A (COD)',
      group_id: standardGroup.group_id,
      owner_name: 'Mr. A',
      phone: '081-000-0001',
      address: '99/1 Demo Street',
      province: 'Bangkok',
      visit_frequency_days: 3,
      max_capacity_qty: new Prisma.Decimal('200'),
      credit_term_days: 0,
      credit_limit: new Prisma.Decimal('0'),
    },
  });

  await prisma.customer.upsert({
    where: { customer_code: 'CUST-0002' },
    update: {},
    create: {
      customer_code: 'CUST-0002',
      customer_name: 'Demo Shop B (Credit 7d)',
      group_id: standardGroup.group_id,
      owner_name: 'Ms. B',
      phone: '081-000-0002',
      address: '12/3 Sample Road',
      province: 'Bangkok',
      visit_frequency_days: 3,
      max_capacity_qty: new Prisma.Decimal('300'),
      credit_term_days: 7,
      credit_limit: new Prisma.Decimal('10000'),
    },
  });

  await prisma.employee.upsert({
    where: { employee_code: 'EMP-0001' },
    update: {},
    create: { employee_code: 'EMP-0001', employee_name: 'Admin User', mobile_no: '080-000-0000' },
  });

  await prisma.employee.upsert({
    where: { employee_code: 'EMP-0002' },
    update: {},
    create: { employee_code: 'EMP-0002', employee_name: 'Sales Rep 1', mobile_no: '080-000-0001' },
  });

  await prisma.route.upsert({
    where: { route_code: 'R-N' },
    update: {},
    create: { route_code: 'R-N', route_name: 'North Bangkok' },
  });
}

async function seedAdminUser() {
  const adminRole = await prisma.role.findUnique({ where: { role_name: 'SYS_ADMIN' } });
  if (!adminRole) throw new Error('SYS_ADMIN role missing after seed');
  const adminEmp = await prisma.employee.findUnique({ where: { employee_code: 'EMP-0001' } });

  const hash = await bcrypt.hash('Admin@12345', 12);
  await prisma.appUser.upsert({
    where: { username: 'admin' },
    update: { role_id: adminRole.role_id, employee_id: adminEmp?.employee_id },
    create: {
      username: 'admin',
      password_hash: hash,
      full_name: 'System Administrator',
      role_id: adminRole.role_id,
      employee_id: adminEmp?.employee_id,
      active_flag: true,
    },
  });
}

async function seedInitialStock() {
  const wh = await prisma.warehouse.findUnique({ where: { warehouse_code: 'MAIN' } });
  if (!wh) return;
  const products = await prisma.product.findMany();
  for (const p of products) {
    await prisma.inventoryBalance.upsert({
      where: { warehouse_id_product_id: { warehouse_id: wh.warehouse_id, product_id: p.product_id } },
      update: {},
      create: {
        warehouse_id: wh.warehouse_id,
        product_id: p.product_id,
        qty_on_hand: new Prisma.Decimal('1000'),
        qty_reserved: new Prisma.Decimal('0'),
        qty_available: new Prisma.Decimal('1000'),
      },
    });
  }
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('Seeding permissions...');
  await upsertPermissions();
  // eslint-disable-next-line no-console
  console.log('Seeding roles...');
  await upsertRoles();
  // eslint-disable-next-line no-console
  console.log('Seeding master data...');
  await seedMasterData();
  // eslint-disable-next-line no-console
  console.log('Seeding admin user (username=admin / password=Admin@12345)...');
  await seedAdminUser();
  // eslint-disable-next-line no-console
  console.log('Seeding initial warehouse stock (1000 of each SKU at MAIN)...');
  await seedInitialStock();
  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
