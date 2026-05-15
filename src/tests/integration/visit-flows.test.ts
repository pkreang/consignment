import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import {
  adminUser,
  getPrisma,
  integrationEnabled,
  resetDatabase,
  seedMinimal,
  SeedHandles,
} from './setup';
import { loadStockToCustomer } from '../../modules/inventory/inventory.service';
import {
  checkIn,
  confirmVisit,
  createVisit,
  recordItems,
} from '../../modules/sales-visits/sales-visits.service';
import {
  createCollection,
} from '../../modules/collections/collections.service';

const d = integrationEnabled ? describe : describe.skip;

d('sales-visit confirmation (integration)', () => {
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

  it('COD visit: 100 placed, 70 counted -> 30 sold, requires cash collection equal to sales', async () => {
    const user = adminUser(handles);
    // Initial load of 100 pcs at COD customer
    await loadStockToCustomer(
      {
        customer_id: handles.customerCod.id,
        warehouse_id: handles.warehouse.id,
        lines: [{ product_id: handles.productA.id, qty: '100' }],
      },
      user,
    );
    const visit = await createVisit(
      { customer_id: handles.customerCod.id, employee_id: handles.employee.id },
      user,
    );
    await checkIn(visit.visit_id, {});
    await recordItems(visit.visit_id, [
      {
        product_id: handles.productA.id,
        qty_counted: '70',
        qty_replenished: '30',
      },
    ]);

    // Missing payment should fail
    await expect(
      confirmVisit(
        visit.visit_id,
        { warehouse_id: handles.warehouse.id },
        user,
      ),
    ).rejects.toThrow();

    const result = await confirmVisit(
      visit.visit_id,
      {
        warehouse_id: handles.warehouse.id,
        payment_method: 'CASH',
        amount_collected: '300.00',
      },
      user,
    );
    expect(result.total_sales_amount).toBe('300.00');
    expect(result.collection_id).toBeTruthy();
    expect(result.ar_invoice_id).toBeNull();

    // consignment should now be 70 - 30 (replenish kept consignment at 70 sold? Let's recompute)
    // Trace: started 100 -> counted 70 (30 sold) -> qty_replenished 30 -> 70 + 30 = 100 again.
    const cs = await prisma.consignmentStock.findUnique({
      where: {
        customer_id_product_id: {
          customer_id: handles.customerCod.id,
          product_id: handles.productA.id,
        },
      },
    });
    expect(cs?.qty_on_hand.toString()).toBe('100');

    const movements = await prisma.stockMovement.findMany({
      where: { product_id: handles.productA.id },
      orderBy: { movement_id: 'asc' },
    });
    const types = movements.map((m) => m.movement_type);
    expect(types).toEqual([
      'LOAD_TO_CUSTOMER',
      'LOAD_TO_CUSTOMER',
      'SALE_CONFIRMED',
      'REPLENISHMENT',
      'REPLENISHMENT',
    ]);

    const collection = await prisma.collection.findFirst({
      where: { visit_id: visit.visit_id },
    });
    expect(collection?.amount_collected.toString()).toBe('300');
  });

  it('Credit visit: creates AR invoice for full sale and accepts partial cash', async () => {
    const user = adminUser(handles);
    await loadStockToCustomer(
      {
        customer_id: handles.customerCredit.id,
        warehouse_id: handles.warehouse.id,
        lines: [{ product_id: handles.productA.id, qty: '50' }], // value 500 within 1000 limit
      },
      user,
    );
    const visit = await createVisit(
      {
        customer_id: handles.customerCredit.id,
        employee_id: handles.employee.id,
      },
      user,
    );
    await checkIn(visit.visit_id, {});
    await recordItems(visit.visit_id, [
      { product_id: handles.productA.id, qty_counted: '20', qty_replenished: '0' },
    ]);
    // qty_sold = 30 -> sales = 300. Customer pays 100 partial.
    const result = await confirmVisit(
      visit.visit_id,
      {
        payment_method: 'CASH',
        amount_collected: '100.00',
      },
      user,
    );
    expect(result.total_sales_amount).toBe('300.00');
    expect(result.ar_invoice_id).toBeTruthy();
    expect(result.collection_id).toBeTruthy();

    const inv = await prisma.arInvoice.findUnique({
      where: { ar_invoice_id: BigInt(result.ar_invoice_id!) },
      include: { payments: true },
    });
    expect(inv?.total_amount.toString()).toBe('300');
    expect(inv?.outstanding_amount.toString()).toBe('200');
    expect(inv?.status).toBe('PARTIAL');
    expect(inv?.payments).toHaveLength(1);
  });

  it('Subsequent AR payment FIFO settles oldest invoice first to PAID', async () => {
    const user = adminUser(handles);
    // Create two AR invoices via visits
    await loadStockToCustomer(
      {
        customer_id: handles.customerCredit.id,
        warehouse_id: handles.warehouse.id,
        lines: [{ product_id: handles.productA.id, qty: '40' }],
      },
      user,
    );
    let v = await createVisit(
      { customer_id: handles.customerCredit.id },
      user,
    );
    await checkIn(v.visit_id, {});
    await recordItems(v.visit_id, [
      { product_id: handles.productA.id, qty_counted: '20', qty_replenished: '20' },
    ]); // sale = 200
    const conf1 = await confirmVisit(
      v.visit_id,
      { warehouse_id: handles.warehouse.id },
      user,
    );
    const inv1Id = BigInt(conf1.ar_invoice_id!);

    v = await createVisit({ customer_id: handles.customerCredit.id }, user);
    await checkIn(v.visit_id, {});
    await recordItems(v.visit_id, [
      { product_id: handles.productA.id, qty_counted: '5', qty_replenished: '0' },
    ]); // sold 35 (35*10 = 350)
    const conf2 = await confirmVisit(v.visit_id, {}, user);
    const inv2Id = BigInt(conf2.ar_invoice_id!);

    // Make sure inv2 has later due_date than inv1
    await prisma.arInvoice.update({
      where: { ar_invoice_id: inv2Id },
      data: {
        invoice_date: new Date(Date.now() - 1 * 86400_000),
        due_date: new Date(Date.now() + 6 * 86400_000),
      },
    });
    await prisma.arInvoice.update({
      where: { ar_invoice_id: inv1Id },
      data: {
        invoice_date: new Date(Date.now() - 10 * 86400_000),
        due_date: new Date(Date.now() - 3 * 86400_000),
      },
    });

    // Pay 250 - settles inv1 (200) fully, then 50 toward inv2 (350 -> 300)
    await createCollection({
      customer_id: handles.customerCredit.id,
      amount_collected: '250',
      payment_method: 'CASH',
    });

    const inv1 = await prisma.arInvoice.findUnique({ where: { ar_invoice_id: inv1Id } });
    const inv2 = await prisma.arInvoice.findUnique({ where: { ar_invoice_id: inv2Id } });
    expect(inv1?.status).toBe('PAID');
    expect(inv1?.outstanding_amount.toString()).toBe('0');
    expect(inv2?.status).toBe('PARTIAL');
    expect(inv2?.outstanding_amount.toString()).toBe('300');
  });

  it('Negative consignment is prevented: cannot count more than placed', async () => {
    const user = adminUser(handles);
    await loadStockToCustomer(
      {
        customer_id: handles.customerCod.id,
        warehouse_id: handles.warehouse.id,
        lines: [{ product_id: handles.productA.id, qty: '10' }],
      },
      user,
    );
    const visit = await createVisit(
      { customer_id: handles.customerCod.id, employee_id: handles.employee.id },
      user,
    );
    await checkIn(visit.visit_id, {});
    await expect(
      recordItems(visit.visit_id, [
        { product_id: handles.productA.id, qty_counted: '20' }, // > 10 placed
      ]),
    ).rejects.toThrow();
  });

  it('audit_log is written on credit override', async () => {
    const user = adminUser(handles);
    await loadStockToCustomer(
      {
        customer_id: handles.customerCredit.id,
        warehouse_id: handles.warehouse.id,
        override_credit: true,
        override_reason: 'Test override',
        lines: [{ product_id: handles.productA.id, qty: '120' }], // 1200 > 1000 limit
      },
      user,
    );
    const audits = await prisma.auditLog.findMany({ where: { table_name: 'customer' } });
    expect(audits.length).toBeGreaterThan(0);
    const ctx = audits[0].context as { reason?: string } | null;
    expect(ctx?.reason).toBe('credit_override');
  });
});
