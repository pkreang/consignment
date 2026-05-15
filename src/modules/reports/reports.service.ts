import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma } from '../../database/prisma';

type RangeInput = { date_from?: string; date_to?: string };

function rangeDates(p: RangeInput) {
  return {
    from: p.date_from ? new Date(p.date_from) : new Date(Date.now() - 30 * 86400_000),
    to: p.date_to ? new Date(p.date_to) : new Date(),
  };
}

export async function dashboard() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    sales,
    visits,
    warehouseValue,
    consignmentValue,
    arOutstanding,
    customers,
    products,
  ] = await Promise.all([
    prisma.salesVisit.aggregate({
      where: { visit_status: 'CONFIRMED', visit_date: { gte: todayStart } },
      _sum: { total_sales_amount: true },
      _count: true,
    }),
    prisma.salesVisit.count({
      where: { visit_status: { in: ['CHECKED_IN', 'COUNTED'] } },
    }),
    prisma.$queryRaw<{ value: Prisma.Decimal | null }[]>`
      SELECT COALESCE(SUM(ib.qty_on_hand * p.cost), 0)::numeric(18,2) AS value
      FROM inventory_balance ib
      JOIN product p ON p.product_id = ib.product_id
    `,
    prisma.$queryRaw<{ value: Prisma.Decimal | null }[]>`
      SELECT COALESCE(SUM(cs.qty_on_hand * p.selling_price), 0)::numeric(18,2) AS value
      FROM consignment_stock cs JOIN product p ON p.product_id = cs.product_id
    `,
    prisma.arInvoice.aggregate({
      where: { status: { in: ['OPEN', 'PARTIAL'] } },
      _sum: { outstanding_amount: true },
      _count: true,
    }),
    prisma.customer.count({ where: { active_flag: true } }),
    prisma.product.count({ where: { active_flag: true } }),
  ]);

  return {
    today: {
      sales_amount: (sales._sum.total_sales_amount ?? new Prisma.Decimal(0)).toString(),
      visits_confirmed: sales._count,
    },
    visits_in_progress: visits,
    warehouse_value: (warehouseValue[0]?.value ?? new Prisma.Decimal(0)).toString(),
    consignment_value: (consignmentValue[0]?.value ?? new Prisma.Decimal(0)).toString(),
    ar_outstanding: {
      amount: (arOutstanding._sum.outstanding_amount ?? new Prisma.Decimal(0)).toString(),
      invoice_count: arOutstanding._count,
    },
    customers_active: customers,
    products_active: products,
  };
}

export async function salesByCustomer(p: RangeInput) {
  const { from, to } = rangeDates(p);
  const rows = await prisma.$queryRaw<
    {
      customer_id: bigint;
      customer_code: string;
      customer_name: string;
      total_qty: Prisma.Decimal | null;
      total_amount: Prisma.Decimal | null;
      visit_count: number;
    }[]
  >`
    SELECT c.customer_id, c.customer_code, c.customer_name,
           COALESCE(SUM(svi.qty_sold), 0)::numeric(18,2) AS total_qty,
           COALESCE(SUM(svi.sales_amount), 0)::numeric(18,2) AS total_amount,
           COUNT(DISTINCT sv.visit_id)::int AS visit_count
    FROM sales_visit sv
    JOIN customer c ON c.customer_id = sv.customer_id
    LEFT JOIN sales_visit_item svi ON svi.visit_id = sv.visit_id
    WHERE sv.visit_status = 'CONFIRMED'
      AND sv.visit_date BETWEEN ${from} AND ${to}
    GROUP BY c.customer_id, c.customer_code, c.customer_name
    ORDER BY total_amount DESC
  `;
  return rows.map((r) => ({
    customer_id: r.customer_id.toString(),
    customer_code: r.customer_code,
    customer_name: r.customer_name,
    total_qty: (r.total_qty ?? new Prisma.Decimal(0)).toString(),
    total_amount: (r.total_amount ?? new Prisma.Decimal(0)).toString(),
    visit_count: r.visit_count,
  }));
}

export async function salesBySku(p: RangeInput) {
  const { from, to } = rangeDates(p);
  const rows = await prisma.$queryRaw<
    {
      product_id: bigint;
      sku_code: string;
      product_name: string;
      total_qty: Prisma.Decimal | null;
      total_amount: Prisma.Decimal | null;
    }[]
  >`
    SELECT p.product_id, p.sku_code, p.product_name,
           COALESCE(SUM(svi.qty_sold), 0)::numeric(18,2) AS total_qty,
           COALESCE(SUM(svi.sales_amount), 0)::numeric(18,2) AS total_amount
    FROM sales_visit_item svi
    JOIN sales_visit sv ON sv.visit_id = svi.visit_id
    JOIN product p ON p.product_id = svi.product_id
    WHERE sv.visit_status = 'CONFIRMED'
      AND sv.visit_date BETWEEN ${from} AND ${to}
    GROUP BY p.product_id, p.sku_code, p.product_name
    ORDER BY total_amount DESC
  `;
  return rows.map((r) => ({
    product_id: r.product_id.toString(),
    sku_code: r.sku_code,
    product_name: r.product_name,
    total_qty: (r.total_qty ?? new Prisma.Decimal(0)).toString(),
    total_amount: (r.total_amount ?? new Prisma.Decimal(0)).toString(),
  }));
}

export async function salesByEmployee(p: RangeInput) {
  const { from, to } = rangeDates(p);
  const rows = await prisma.$queryRaw<
    {
      employee_id: bigint;
      employee_code: string;
      employee_name: string;
      total_amount: Prisma.Decimal | null;
      visit_count: number;
    }[]
  >`
    SELECT e.employee_id, e.employee_code, e.employee_name,
           COALESCE(SUM(sv.total_sales_amount), 0)::numeric(18,2) AS total_amount,
           COUNT(DISTINCT sv.visit_id)::int AS visit_count
    FROM sales_visit sv
    JOIN employee e ON e.employee_id = sv.employee_id
    WHERE sv.visit_status = 'CONFIRMED'
      AND sv.visit_date BETWEEN ${from} AND ${to}
    GROUP BY e.employee_id, e.employee_code, e.employee_name
    ORDER BY total_amount DESC
  `;
  return rows.map((r) => ({
    employee_id: r.employee_id.toString(),
    employee_code: r.employee_code,
    employee_name: r.employee_name,
    total_amount: (r.total_amount ?? new Prisma.Decimal(0)).toString(),
    visit_count: r.visit_count,
  }));
}

export async function currentWarehouseStock() {
  return prisma.inventoryBalance.findMany({
    include: { product: true, warehouse: true },
    orderBy: [{ warehouse_id: 'asc' }, { product_id: 'asc' }],
  });
}

export async function consignmentStockByCustomer() {
  return prisma.$queryRaw<
    {
      customer_id: bigint;
      customer_code: string;
      customer_name: string;
      total_qty: Prisma.Decimal | null;
      total_value: Prisma.Decimal | null;
    }[]
  >`
    SELECT c.customer_id, c.customer_code, c.customer_name,
           COALESCE(SUM(cs.qty_on_hand), 0)::numeric(18,2) AS total_qty,
           COALESCE(SUM(cs.qty_on_hand * p.selling_price), 0)::numeric(18,2) AS total_value
    FROM customer c
    LEFT JOIN consignment_stock cs ON cs.customer_id = c.customer_id
    LEFT JOIN product p ON p.product_id = cs.product_id
    GROUP BY c.customer_id, c.customer_code, c.customer_name
    HAVING COALESCE(SUM(cs.qty_on_hand), 0) > 0
    ORDER BY total_value DESC
  `;
}

export async function collectionReport(p: RangeInput) {
  const { from, to } = rangeDates(p);
  const rows = await prisma.$queryRaw<
    {
      collection_date: Date;
      payment_method: string;
      collection_count: number;
      total_amount: Prisma.Decimal | null;
    }[]
  >`
    SELECT DATE_TRUNC('day', collection_date) AS collection_date,
           payment_method::text AS payment_method,
           COUNT(*)::int AS collection_count,
           COALESCE(SUM(amount_collected), 0)::numeric(18,2) AS total_amount
    FROM collection
    WHERE collection_date BETWEEN ${from} AND ${to}
    GROUP BY 1, 2
    ORDER BY 1 DESC, 2 ASC
  `;
  return rows.map((r) => ({
    date: r.collection_date,
    payment_method: r.payment_method,
    collection_count: r.collection_count,
    total_amount: (r.total_amount ?? new Prisma.Decimal(0)).toString(),
  }));
}

export async function bestSellers(p: RangeInput & { limit?: number }) {
  const list = await salesBySku(p);
  return list.slice(0, p.limit ?? 20);
}

export async function slowMovers(p: RangeInput & { limit?: number }) {
  // Active products with no sales in the window.
  const { from, to } = rangeDates(p);
  const rows = await prisma.$queryRaw<
    {
      product_id: bigint;
      sku_code: string;
      product_name: string;
      total_qty: Prisma.Decimal | null;
      total_amount: Prisma.Decimal | null;
      consignment_qty: Prisma.Decimal | null;
    }[]
  >`
    SELECT p.product_id, p.sku_code, p.product_name,
           COALESCE(SUM(svi.qty_sold), 0)::numeric(18,2) AS total_qty,
           COALESCE(SUM(svi.sales_amount), 0)::numeric(18,2) AS total_amount,
           (SELECT COALESCE(SUM(cs.qty_on_hand), 0)::numeric(18,2)
              FROM consignment_stock cs WHERE cs.product_id = p.product_id) AS consignment_qty
    FROM product p
    LEFT JOIN sales_visit_item svi ON svi.product_id = p.product_id
    LEFT JOIN sales_visit sv ON sv.visit_id = svi.visit_id
        AND sv.visit_status = 'CONFIRMED'
        AND sv.visit_date BETWEEN ${from} AND ${to}
    WHERE p.active_flag = true
    GROUP BY p.product_id, p.sku_code, p.product_name
    ORDER BY total_qty ASC, total_amount ASC
    LIMIT ${p.limit ?? 20}
  `;
  return rows.map((r) => ({
    product_id: r.product_id.toString(),
    sku_code: r.sku_code,
    product_name: r.product_name,
    total_qty: (r.total_qty ?? new Prisma.Decimal(0)).toString(),
    total_amount: (r.total_amount ?? new Prisma.Decimal(0)).toString(),
    consignment_qty: (r.consignment_qty ?? new Prisma.Decimal(0)).toString(),
  }));
}

export async function deadStock(days = 30) {
  const cutoff = new Date(Date.now() - days * 86400_000);
  const rows = await prisma.$queryRaw<
    {
      product_id: bigint;
      sku_code: string;
      product_name: string;
      warehouse_qty: Prisma.Decimal | null;
      consignment_qty: Prisma.Decimal | null;
      last_sale: Date | null;
    }[]
  >`
    SELECT p.product_id, p.sku_code, p.product_name,
           (SELECT COALESCE(SUM(ib.qty_on_hand), 0)::numeric(18,2)
              FROM inventory_balance ib WHERE ib.product_id = p.product_id) AS warehouse_qty,
           (SELECT COALESCE(SUM(cs.qty_on_hand), 0)::numeric(18,2)
              FROM consignment_stock cs WHERE cs.product_id = p.product_id) AS consignment_qty,
           (SELECT MAX(sm.movement_date) FROM stock_movement sm
              WHERE sm.product_id = p.product_id
                AND sm.movement_type = 'SALE_CONFIRMED') AS last_sale
    FROM product p
    WHERE p.active_flag = true
  `;
  return rows
    .filter((r) => {
      const wh = new Decimal(r.warehouse_qty ?? 0);
      const cs = new Decimal(r.consignment_qty ?? 0);
      if (wh.plus(cs).lte(0)) return false;
      if (!r.last_sale) return true;
      return r.last_sale < cutoff;
    })
    .map((r) => ({
      product_id: r.product_id.toString(),
      sku_code: r.sku_code,
      product_name: r.product_name,
      warehouse_qty: (r.warehouse_qty ?? new Prisma.Decimal(0)).toString(),
      consignment_qty: (r.consignment_qty ?? new Prisma.Decimal(0)).toString(),
      last_sale: r.last_sale,
      days_since_last_sale: r.last_sale
        ? Math.floor((Date.now() - r.last_sale.getTime()) / 86400_000)
        : null,
    }));
}

export async function productionPlanning(p: RangeInput & { lead_time_days?: number }) {
  const { from, to } = rangeDates(p);
  const leadTime = p.lead_time_days ?? 7;
  const daysWindow = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / 86400_000),
  );
  const rows = await prisma.$queryRaw<
    {
      product_id: bigint;
      sku_code: string;
      product_name: string;
      min_stock: Prisma.Decimal;
      max_stock: Prisma.Decimal;
      total_qty: Prisma.Decimal | null;
      warehouse_qty: Prisma.Decimal | null;
      consignment_qty: Prisma.Decimal | null;
    }[]
  >`
    SELECT p.product_id, p.sku_code, p.product_name, p.min_stock, p.max_stock,
           (SELECT COALESCE(SUM(svi.qty_sold), 0)::numeric(18,2)
              FROM sales_visit_item svi
              JOIN sales_visit sv ON sv.visit_id = svi.visit_id
              WHERE svi.product_id = p.product_id
                AND sv.visit_status = 'CONFIRMED'
                AND sv.visit_date BETWEEN ${from} AND ${to}) AS total_qty,
           (SELECT COALESCE(SUM(ib.qty_on_hand), 0)::numeric(18,2)
              FROM inventory_balance ib WHERE ib.product_id = p.product_id) AS warehouse_qty,
           (SELECT COALESCE(SUM(cs.qty_on_hand), 0)::numeric(18,2)
              FROM consignment_stock cs WHERE cs.product_id = p.product_id) AS consignment_qty
    FROM product p
    WHERE p.active_flag = true
  `;
  return rows.map((r) => {
    const total = new Decimal(r.total_qty ?? 0);
    const avg = total.dividedBy(daysWindow);
    const projectedDemand = avg.times(leadTime);
    const onHand = new Decimal(r.warehouse_qty ?? 0).plus(
      new Decimal(r.consignment_qty ?? 0),
    );
    const suggestedProduction = Decimal.max(
      0,
      projectedDemand.minus(onHand),
    );
    return {
      product_id: r.product_id.toString(),
      sku_code: r.sku_code,
      product_name: r.product_name,
      avg_daily_sales: avg.toFixed(2),
      window_days: daysWindow,
      lead_time_days: leadTime,
      projected_lead_time_demand: projectedDemand.toFixed(2),
      warehouse_qty: (r.warehouse_qty ?? new Prisma.Decimal(0)).toString(),
      consignment_qty: (r.consignment_qty ?? new Prisma.Decimal(0)).toString(),
      total_on_hand: onHand.toFixed(2),
      min_stock: r.min_stock.toString(),
      max_stock: r.max_stock.toString(),
      suggested_production_qty: suggestedProduction.toFixed(2),
    };
  });
}
