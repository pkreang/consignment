"use client";

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney, pillForStatus } from '@/lib/format';

type Invoice = {
  ar_invoice_id: string;
  invoice_no: string;
  customer: { customer_name: string };
  invoice_date: string;
  due_date: string;
  total_amount: string;
  outstanding_amount: string;
  status: string;
  aging_bucket: string;
};

type AgingPayload = {
  invoices: Invoice[];
  summary: Record<string, { count: number; amount: string }>;
};

const BUCKETS = ['CURRENT', '1_30', '31_60', '61_90', 'OVER_90'];

export default function ArAgingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ar-aging'],
    queryFn: () => api<AgingPayload>('/reports/ar-aging'),
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Accounts Receivable Aging</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {BUCKETS.map((b) => {
          const row = data?.summary?.[b];
          return (
            <div key={b} className="card p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">{b}</div>
              <div className="mt-1 text-xl font-semibold">
                {fmtMoney(row?.amount ?? '0')}
              </div>
              <div className="text-xs text-slate-500">{row?.count ?? 0} invoices</div>
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-head">
              <th className="px-3 py-2">Invoice #</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Issued</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2">Bucket</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-slate-500">Loading…</td>
              </tr>
            )}
            {data?.invoices.map((inv) => (
              <tr key={inv.ar_invoice_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{inv.invoice_no}</td>
                <td className="px-3 py-2">{inv.customer?.customer_name}</td>
                <td className="px-3 py-2">{fmtDate(inv.invoice_date)}</td>
                <td className="px-3 py-2">{fmtDate(inv.due_date)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(inv.total_amount)}</td>
                <td className="px-3 py-2 text-right font-mono font-medium">
                  {fmtMoney(inv.outstanding_amount)}
                </td>
                <td className="px-3 py-2">
                  <span className="pill bg-slate-100 text-slate-700">{inv.aging_bucket}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`pill ${pillForStatus(inv.status)}`}>{inv.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
