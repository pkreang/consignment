"use client";

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney, pillForStatus } from '@/lib/format';

type VisitDetail = {
  visit_id: string;
  visit_no: string;
  visit_status: string;
  visit_date: string;
  total_sales_amount: string;
  customer: { customer_code: string; customer_name: string };
  employee: { employee_name: string };
  items: Array<{
    visit_item_id: string;
    product: { sku_code: string; product_name: string };
    qty_before: string;
    qty_counted: string;
    qty_sold: string;
    qty_replenished: string;
    unit_price: string;
    sales_amount: string;
  }>;
  collections?: Array<{ collection_no: string; amount_collected: string; payment_method: string }>;
  arInvoices?: Array<{ invoice_no: string; total_amount: string; status: string }>;
};

export default function VisitDetailPage() {
  const params = useParams<{ id: string }>();
  const { data } = useQuery({
    queryKey: ['visit', params.id],
    queryFn: () => api<VisitDetail>(`/sales-visits/${params.id}`),
  });

  if (!data) return <div className="card p-6">Loading…</div>;
  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold">Visit {data.visit_no}</h1>
        <span className={`pill ${pillForStatus(data.visit_status)}`}>{data.visit_status}</span>
      </div>
      <div className="card grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
        <Field label="Customer">{data.customer?.customer_name}</Field>
        <Field label="Sales rep">{data.employee?.employee_name}</Field>
        <Field label="Visit date">{fmtDate(data.visit_date)}</Field>
        <Field label="Total sales">{fmtMoney(data.total_sales_amount)} THB</Field>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Items</h2>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-head">
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Before</th>
                <th className="px-3 py-2 text-right">Counted</th>
                <th className="px-3 py-2 text-right">Sold</th>
                <th className="px-3 py-2 text-right">Replenished</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Sales</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.visit_item_id} className="table-row">
                  <td className="px-3 py-2 font-mono text-xs">{it.product?.sku_code}</td>
                  <td className="px-3 py-2">{it.product?.product_name}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.qty_before)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.qty_counted)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.qty_sold)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.qty_replenished)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.unit_price)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.sales_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!!data.collections?.length && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Collections</h2>
          <ul className="card divide-y text-sm">
            {data.collections.map((c) => (
              <li key={c.collection_no} className="flex items-center justify-between px-4 py-2">
                <span className="font-mono text-xs text-slate-500">{c.collection_no}</span>
                <span className="font-medium">{fmtMoney(c.amount_collected)} THB</span>
                <span className="text-xs text-slate-500">{c.payment_method}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!data.arInvoices?.length && (
        <section>
          <h2 className="mb-2 text-lg font-medium">AR Invoices</h2>
          <ul className="card divide-y text-sm">
            {data.arInvoices.map((inv) => (
              <li key={inv.invoice_no} className="flex items-center justify-between px-4 py-2">
                <span className="font-mono text-xs text-slate-500">{inv.invoice_no}</span>
                <span className="font-medium">{fmtMoney(inv.total_amount)} THB</span>
                <span className={`pill ${pillForStatus(inv.status)}`}>{inv.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}
