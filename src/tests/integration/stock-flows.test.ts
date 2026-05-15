import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import {
  adminUser,
  getPrisma,
  integrationEnabled,
  resetDatabase,
  seedMinimal,
  SeedHandles,
} from './setup';
import {
  loadStockToCustomer,
  returnStockFromCustomer,
} from '../../modules/inventory/inventory.service';

const d = integrationEnabled ? describe : describe.skip;

d('inventory ledger flows (integration)', () => {
  let handles: SeedHandles;
  const prisma = getPrisma();

  beforeAll(async () => {
    await resetDatabase();
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE
         ar_payment, ar_invoice_item, ar_invoice,
         collection,
         sales_visit_item, sales_visit,
         stock_movement, consignment_stock, inventory_balance,
         customer_credit_history, audit_log,
         app_user, role_permission, role, permission,
         customer_route, customer, customer_group,
         employee, warehouse, product, product_category, product_lot
       RESTART IDENTITY CASCADE`,
    );
    await prisma.$executeRawUnsafe(
      `SELECT setval('seq_visit_no', 1, false),
              setval('seq_invoice_no', 1, false),
              setval('seq_collection_no', 1, false)`,
    );
    handles = await seedMinimal();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('load-to-customer moves stock from warehouse to consignment with audit rows', async () => {
    const user = adminUser(handles);
    const result = await loadStockToCustomer(
      {
        customer_id: handles.customerCod.id,
        warehouse_id: handles.warehouse.id,
        lines: [{ product_id: handles.productA.id, qty: '50' }],
      },
      user,
    );
    expect(result.ref_doc_id).toBeTruthy();

    const wh = await prisma.inventoryBalance.findFirst({
      where: {
        warehouse_id: handles.warehouse.id,
        product_id: handles.productA.id,
      },
    });
    expect(wh?.qty_on_hand.toString()).toBe('450');

    const cs = await prisma.consignmentStock.findUnique({
      where: {
        customer_id_product_id: {
          customer_id: handles.customerCod.id,
          product_id: handles.productA.id,
        },
      },
    });
    expect(cs?.qty_on_hand.toString()).toBe('50');

    const movements = await prisma.stockMovement.findMany({
      where: { ref_doc_id: BigInt(result.ref_doc_id) },
      orderBy: { movement_id: 'asc' },
    });
    expect(movements).toHaveLength(2);
    const warehouseSide = movements.find((m) => m.warehouse_id !== null);
    const consignmentSide = movements.find((m) => m.customer_id !== null && m.warehouse_id === null);
    expect(warehouseSide?.qty_out.toString()).toBe('50');
    expect(warehouseSide?.balance_after.toString()).toBe('450');
    expect(consignmentSide?.qty_in.toString()).toBe('50');
    expect(consignmentSide?.balance_after.toString()).toBe('50');
  });

  it('second load to same customer/SKU becomes a REPLENISHMENT', async () => {
    const user = adminUser(handles);
    await loadStockToCustomer(
      {
        customer_id: handles.customerCod.id,
        warehouse_id: handles.warehouse.id,
        lines: [{ product_id: handles.productA.id, qty: '50' }],
      },
      user,
    );
    await loadStockToCustomer(
      {
        customer_id: handles.customerCod.id,
        warehouse_id: handles.warehouse.id,
        lines: [{ product_id: handles.productA.id, qty: '20' }],
      },
      user,
    );

    const movements = await prisma.stockMovement.findMany({
      where: { product_id: handles.productA.id },
      orderBy: { movement_id: 'asc' },
    });
    const types = movements.map((m) => m.movement_type);
    expect(types).toEqual([
      'LOAD_TO_CUSTOMER',
      'LOAD_TO_CUSTOMER',
      'REPLENISHMENT',
      'REPLENISHMENT',
    ]);
  });

  it('credit limit blocks load when exposure would exceed limit', async () => {
    const user = adminUser(handles);
    // limit = 1000, selling_price 10 -> loading 120 = 1200 should be blocked
    await expect(
      loadStockToCustomer(
        {
          customer_id: handles.customerCredit.id,
          warehouse_id: handles.warehouse.id,
          lines: [{ product_id: handles.productA.id, qty: '120' }],
        },
        user,
      ),
    ).rejects.toMatchObject({ code: 'CREDIT_LIMIT_EXCEEDED' });
  });

  it('credit override allows load when user has the permission', async () => {
    const user = adminUser(handles); // SYS_ADMIN-like, has '*'
    const result = await loadStockToCustomer(
      {
        customer_id: handles.customerCredit.id,
        warehouse_id: handles.warehouse.id,
        override_credit: true,
        override_reason: 'Owner approved by phone',
        lines: [{ product_id: handles.productA.id, qty: '120' }],
      },
      user,
    );
    expect(result.ref_doc_id).toBeTruthy();
    const auditRows = await prisma.auditLog.findMany({
      where: { table_name: 'customer' },
    });
    expect(auditRows.length).toBeGreaterThan(0);
  });

  it('warehouse stock cannot go negative', async () => {
    const user = adminUser(handles);
    await expect(
      loadStockToCustomer(
        {
          customer_id: handles.customerCod.id,
          warehouse_id: handles.warehouse.id,
          lines: [{ product_id: handles.productA.id, qty: '1000000' }],
        },
        user,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  });

  it('return-from-customer reverses the dual-row ledger', async () => {
    const user = adminUser(handles);
    await loadStockToCustomer(
      {
        customer_id: handles.customerCod.id,
        warehouse_id: handles.warehouse.id,
        lines: [{ product_id: handles.productA.id, qty: '40' }],
      },
      user,
    );
    await returnStockFromCustomer(
      {
        customer_id: handles.customerCod.id,
        warehouse_id: handles.warehouse.id,
        lines: [{ product_id: handles.productA.id, qty: '10' }],
      },
      user,
    );
    const wh = await prisma.inventoryBalance.findFirst({
      where: {
        warehouse_id: handles.warehouse.id,
        product_id: handles.productA.id,
      },
    });
    expect(wh?.qty_on_hand.toString()).toBe('470');
    const cs = await prisma.consignmentStock.findUnique({
      where: {
        customer_id_product_id: {
          customer_id: handles.customerCod.id,
          product_id: handles.productA.id,
        },
      },
    });
    expect(cs?.qty_on_hand.toString()).toBe('30');
  });
});
