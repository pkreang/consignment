"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney, pillForStatus } from '@/lib/format';
import { useErrorMessage } from '@/lib/use-error-message';

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

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? '') + '/api/v1'
    : '/api/v1';

export default function ArAgingPage() {
  const t = useTranslations('arAging');
  const tc = useTranslations('common');
  const { data, isLoading } = useQuery({
    queryKey: ['ar-aging'],
    queryFn: () => api<AgingPayload>('/reports/ar-aging'),
  });
  const [paying, setPaying] = useState<Invoice | null>(null);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {BUCKETS.map((b) => {
          const row = data?.summary?.[b];
          return (
            <div key={b} className="card p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">{b}</div>
              <div className="mt-1 text-xl font-semibold">{fmtMoney(row?.amount ?? '0')}</div>
              <div className="text-xs text-slate-500">
                {t('invoiceCount', { count: row?.count ?? 0 })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-head">
              <th className="px-3 py-2">{t('colInvoiceNo')}</th>
              <th className="px-3 py-2">{t('colCustomer')}</th>
              <th className="px-3 py-2">{t('colIssued')}</th>
              <th className="px-3 py-2">{t('colDue')}</th>
              <th className="px-3 py-2 text-right">{t('colTotal')}</th>
              <th className="px-3 py-2 text-right">{t('colOutstanding')}</th>
              <th className="px-3 py-2">{t('colBucket')}</th>
              <th className="px-3 py-2">{t('colStatus')}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-slate-500">
                  {tc('loading')}
                </td>
              </tr>
            )}
            {data?.invoices.map((inv) => (
              <tr key={inv.ar_invoice_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">
                  <a
                    className="text-brand-600 hover:underline"
                    href={`${API_BASE}/ar/invoices/${inv.ar_invoice_id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {inv.invoice_no}
                  </a>
                </td>
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
                <td className="px-3 py-2 text-right">
                  {Number(inv.outstanding_amount) > 0 && (
                    <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setPaying(inv)}>
                      {t('recordPayment')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paying && (
        <PayDialog
          inv={paying}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}

function PayDialog({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const t = useTranslations('arAging');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(inv.outstanding_amount);
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'QR_PAYMENT' | 'OTHER'>('BANK_TRANSFER');
  const [reference, setReference] = useState('');

  const m = useMutation({
    mutationFn: async () =>
      api(`/ar/invoices/${inv.ar_invoice_id}/payments`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `pay-${inv.ar_invoice_id}-${Date.now()}` },
        body: JSON.stringify({
          amount,
          payment_method: method,
          reference_no: reference || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ar-aging'] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md space-y-3 p-5 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">
          {t('payModalTitle', { invoiceNo: inv.invoice_no })}
        </h3>
        <div className="text-slate-600">
          {t('outstandingLabel')}{' '}
          <span className="font-medium">{fmtMoney(inv.outstanding_amount)} THB</span>
        </div>
        <div>
          <label className="label">{t('amount')}</label>
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('method')}</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as never)}>
            <option>CASH</option>
            <option>BANK_TRANSFER</option>
            <option>QR_PAYMENT</option>
            <option>OTHER</option>
          </select>
        </div>
        <div>
          <label className="label">{t('reference')}</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        {m.error && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage(m.error)}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>
            {tc('cancel')}
          </button>
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? tc('saving') : t('recordPayment')}
          </button>
        </div>
      </div>
    </div>
  );
}
