"use client";

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney, pillForStatus } from '@/lib/format';

type InvoiceDetail = {
  ar_invoice_id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  total_amount: string;
  outstanding_amount: string;
  status: string;
  note: string | null;
  customer: { customer_id: string; customer_code: string; customer_name: string };
  items: Array<{
    ar_invoice_item_id: string;
    product: { sku_code: string; product_name: string };
    qty: string;
    unit_price: string;
    line_amount: string;
  }>;
  payments: Array<{
    ar_payment_id: string;
    payment_date: string;
    amount: string;
    payment_method: string;
    reference_no: string | null;
  }>;
};

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? '') + '/api/v1'
    : '/api/v1';

export default function ArDetailPage() {
  const params = useParams<{ id: string }>();
  const { data } = useQuery({
    queryKey: ['ar-invoice', params.id],
    queryFn: () => api<InvoiceDetail>(`/ar/invoices/${params.id}`),
  });

  if (!data) return <div className="card p-6">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">Invoice {data.invoice_no}</h1>
          <span className={`pill ${pillForStatus(data.status)}`}>{data.status}</span>
        </div>
        <a className="btn btn-ghost" href={`${API_BASE}/ar/invoices/${data.ar_invoice_id}/pdf`} target="_blank" rel="noreferrer">Download PDF</a>
      </div>

      <div className="card grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
        <Field label="Customer">{data.customer.customer_name}</Field>
        <Field label="Invoice date">{fmtDate(data.invoice_date)}</Field>
        <Field label="Due date">{fmtDate(data.due_date)}</Field>
        <Field label="Outstanding">{fmtMoney(data.outstanding_amount)} / {fmtMoney(data.total_amount)} THB</Field>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Line items</h2>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="table-head">
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr></thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.ar_invoice_item_id} className="table-row">
                  <td className="px-3 py-2 font-mono text-xs">{it.product?.sku_code}</td>
                  <td className="px-3 py-2">{it.product?.product_name}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.qty)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.unit_price)}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{fmtMoney(it.line_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Payments</h2>
        {data.payments.length === 0 ? (
          <div className="card p-4 text-sm text-slate-500">No payments yet.</div>
        ) : (
          <ul className="card divide-y text-sm">
            {data.payments.map((p) => (
              <li key={p.ar_payment_id} className="flex items-center justify-between px-4 py-2">
                <span className="text-xs text-slate-500">{fmtDate(p.payment_date)}</span>
                <span className="font-medium">{fmtMoney(p.amount)} THB</span>
                <span className="pill bg-slate-100 text-slate-700 text-xs">{p.payment_method}</span>
                <span className="text-xs text-slate-500">{p.reference_no ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
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
