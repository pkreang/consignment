/**
 * End-to-end smoke test against a running backend.
 *   API=http://localhost:3000 USERNAME=admin PASSWORD=Admin@12345 npm run smoke
 *
 * Flow:
 *   1. login
 *   2. discover seeded warehouse / customer (credit) / SKU
 *   3. load 100pcs to credit customer
 *   4. create visit, check-in, record items (sold 30, replenish 10), confirm with partial cash
 *   5. record an AR payment that closes the resulting invoice
 *   6. fetch a few reports
 */

const API = process.env.API ?? 'http://localhost:3000';
const USERNAME = process.env.USERNAME ?? 'admin';
const PASSWORD = process.env.PASSWORD ?? 'Admin@12345';

let token = '';
let step = 0;

const log = (...args: unknown[]) => console.log(`[smoke ${++step}]`, ...args);
const fail = (msg: string, extra?: unknown): never => {
  console.error('[smoke FAILED]', msg, extra ?? '');
  process.exit(1);
};

async function call<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    fail(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    return text as T;
  }
}

async function main() {
  log('login');
  const login = await call<{ accessToken: string }>('POST', '/api/v1/auth/login', {
    username: USERNAME,
    password: PASSWORD,
  });
  token = login.accessToken;

  log('discover warehouse');
  const whResp = await call<{ data: Array<{ warehouse_id: string; warehouse_code: string }> }>(
    'GET',
    '/api/v1/warehouses?pageSize=10',
  );
  const warehouse = whResp.data.find((w) => w.warehouse_code === 'MAIN') ?? whResp.data[0];
  if (!warehouse) fail('no warehouse seeded');

  log('discover credit customer');
  const custResp = await call<{ data: Array<{ customer_id: string; customer_code: string; credit_limit: string }> }>(
    'GET',
    '/api/v1/customers?pageSize=50',
  );
  const credit = custResp.data.find((c) => c.customer_code === 'CUST-0002');
  if (!credit) fail('seed customer CUST-0002 missing');

  log('discover product');
  const prodResp = await call<{ data: Array<{ product_id: string; sku_code: string; selling_price: string }> }>(
    'GET',
    '/api/v1/products?pageSize=50',
  );
  const product = prodResp.data.find((p) => p.sku_code === 'BR-001') ?? prodResp.data[0];
  if (!product) fail('no product seeded');

  log('credit exposure (before)');
  const expBefore = await call<{ ar_outstanding: string; consignment_value: string; available_credit: string }>(
    'GET',
    `/api/v1/credit/customers/${credit!.customer_id}/exposure`,
  );
  console.log('   exposure before:', expBefore);

  log('load 100 BR-001 to credit customer');
  await call('POST', '/api/v1/inventory/load-to-customer', {
    customer_id: credit!.customer_id,
    warehouse_id: warehouse!.warehouse_id,
    remark: 'smoke',
    lines: [{ product_id: product!.product_id, qty: '100', unit_price: product!.selling_price }],
  });

  log('create visit');
  const visit = await call<{ visit_id: string; visit_no: string }>('POST', '/api/v1/sales-visits', {
    customer_id: credit!.customer_id,
  });
  console.log('   visit:', visit.visit_no, visit.visit_id);

  log('check-in');
  await call('POST', `/api/v1/sales-visits/${visit.visit_id}/checkin`, {
    gps_latitude: '13.7563',
    gps_longitude: '100.5018',
  });

  log('record items (count=70, replenish=10 → sold=30)');
  await call('POST', `/api/v1/sales-visits/${visit.visit_id}/items`, {
    items: [
      {
        product_id: product!.product_id,
        qty_counted: '70',
        qty_replenished: '10',
        unit_price: product!.selling_price,
      },
    ],
  });

  log('confirm visit with partial cash (200 THB)');
  const confirm = await call<{ total_sales_amount: string; ar_invoice_id?: string; collection_id?: string }>(
    'POST',
    `/api/v1/sales-visits/${visit.visit_id}/confirm`,
    {
      warehouse_id: warehouse!.warehouse_id,
      payment_method: 'CASH',
      amount_collected: '200.00',
      reference_no: 'SMOKE-CASH',
    },
  );
  console.log('   total sale:', confirm.total_sales_amount, 'invoice:', confirm.ar_invoice_id);
  if (!confirm.ar_invoice_id) fail('expected AR invoice for credit customer');

  log('record AR payment for the remaining balance');
  const invoice = await call<{ outstanding_amount: string }>('GET', `/api/v1/ar/invoices/${confirm.ar_invoice_id}`);
  await call('POST', `/api/v1/ar/invoices/${confirm.ar_invoice_id}/payments`, {
    amount: invoice.outstanding_amount,
    payment_method: 'BANK_TRANSFER',
    reference_no: 'SMOKE-XFER',
  });

  log('fetch reports');
  const dashboard = await call('GET', '/api/v1/reports/dashboard');
  console.log('   dashboard keys:', Object.keys(dashboard as object));
  const aging = await call('GET', '/api/v1/reports/ar-aging');
  console.log('   ar-aging buckets:', Object.keys((aging as { summary?: object }).summary ?? {}));

  log('credit exposure (after)');
  const expAfter = await call<{ ar_outstanding: string; consignment_value: string }>(
    'GET',
    `/api/v1/credit/customers/${credit!.customer_id}/exposure`,
  );
  console.log('   exposure after:', expAfter);

  console.log('\n[smoke OK] all steps passed');
}

main().catch((e) => fail((e as Error).message));
