"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { fmtDate, fmtMoney, pillForStatus } from '@/lib/format';
import { useCustomers, useProducts } from '@/lib/lookups';
import { Modal } from '@/components/modal';

type Invoice = {
  ar_invoice_id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  total_amount: string;
  outstanding_amount: string;
  status: string;
  customer: { customer_code: string; customer_name: string };
};
type Page<T> = { data: T[]; total: number };

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? '') + '/api/v1'
    : '/api/v1';

export default function ArPage() {
  const qc = useQueryClient();
  const customers = useCustomers();
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ar-invoices', customerId, status, page],
    queryFn: () => {
      const p = new URLSearchParams({ pageSize: '20', page: String(page) });
      if (customerId) p.set('customer_id', customerId);
      if (status) p.set('status', status);
      return api<Page<Invoice>>(`/ar/invoices?${p.toString()}`);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AR Invoices</h1>
        <div className="flex items-center gap-2">
          <select className="input max-w-[220px]" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setPage(1); }}>
            <option value="">All customers</option>
            {customers.data?.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.customer_code} — {c.customer_name}</option>)}
          </select>
          <select className="input max-w-[140px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All status</option>
            <option>OPEN</option>
            <option>PARTIAL</option>
            <option>PAID</option>
            <option>CANCELLED</option>
          </select>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>Manual invoice</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-head">
            <th className="px-3 py-2">Invoice #</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Outstanding</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.data.map((inv) => (
              <tr key={inv.ar_invoice_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/ar/${inv.ar_invoice_id}`} className="text-brand-600 hover:underline">{inv.invoice_no}</Link>
                </td>
                <td className="px-3 py-2 text-xs text-surface-500">{fmtDate(inv.invoice_date)}</td>
                <td className="px-3 py-2 text-xs text-surface-500">{fmtDate(inv.due_date)}</td>
                <td className="px-3 py-2"><div>{inv.customer?.customer_name}</div><div className="font-mono text-xs text-surface-500">{inv.customer?.customer_code}</div></td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(inv.total_amount)}</td>
                <td className="px-3 py-2 text-right font-mono font-medium">{fmtMoney(inv.outstanding_amount)}</td>
                <td className="px-3 py-2"><span className={`pill ${pillForStatus(inv.status)}`}>{inv.status}</span></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <a className="btn btn-ghost px-2 py-1" href={`${API_BASE}/ar/invoices/${inv.ar_invoice_id}/pdf`} target="_blank" rel="noreferrer">PDF</a>
                  {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                    <button className="btn btn-ghost px-2 py-1" onClick={() => setPaying(inv)}>Pay</button>
                  )}
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={8} className="px-3 py-4 text-surface-500">No invoices.</td></tr>}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-surface-500">
          <div>Total: {data.total.toLocaleString()} • Page {page}</div>
          <div className="flex gap-1">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <button className="btn btn-ghost" disabled={data.data.length < 20} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {creating && (
        <CreateInvoice
          onClose={() => setCreating(false)}
          onDone={() => { qc.invalidateQueries({ queryKey: ['ar-invoices'] }); setCreating(false); }}
        />
      )}
      {paying && (
        <PaymentDialog
          invoice={paying}
          onClose={() => setPaying(null)}
          onDone={() => { qc.invalidateQueries({ queryKey: ['ar-invoices'] }); setPaying(null); }}
        />
      )}
    </div>
  );
}

type Line = { product_id: string; qty: string; unit_price: string };

function CreateInvoice({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const customers = useCustomers();
  const products = useProducts();
  const [customerId, setCustomerId] = useState('');
  const [creditTermDays, setCreditTermDays] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_id: '', qty: '', unit_price: '' }]);
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      api('/ar/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          credit_term_days: creditTermDays ? Number(creditTermDays) : undefined,
          note: note || undefined,
          lines: lines
            .filter((l) => l.product_id && Number(l.qty) > 0)
            .map((l) => ({ product_id: l.product_id, qty: l.qty, unit_price: l.unit_price || '0' })),
        }),
      }),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerId) { setError('Customer required'); return; }
    if (lines.filter((l) => l.product_id && Number(l.qty) > 0).length === 0) { setError('Add at least one line'); return; }
    m.mutate();
  };

  const total = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0);

  return (
    <Modal title="Manual AR Invoice" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— select —</option>
              {customers.data?.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.customer_code} — {c.customer_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Credit term (days)</label>
            <input className="input text-right font-mono" inputMode="numeric" value={creditTermDays} onChange={(e) => setCreditTermDays(e.target.value)} placeholder="from customer policy if blank" />
          </div>
        </div>
        <div>
          <label className="label">Note</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="table-head">
              <th className="px-2 py-1 text-left">Product</th>
              <th className="px-2 py-1 text-right">Qty</th>
              <th className="px-2 py-1 text-right">Price</th>
              <th></th>
            </tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-2 py-1">
                    <select className="input" value={l.product_id} onChange={(e) => {
                      const p = products.data?.find((x) => x.product_id === e.target.value);
                      setLines(lines.map((x, j) => j === i ? { ...x, product_id: e.target.value, unit_price: p?.selling_price ?? x.unit_price } : x));
                    }}>
                      <option value="">— select —</option>
                      {products.data?.map((p) => <option key={p.product_id} value={p.product_id}>{p.sku_code} — {p.product_name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right"><input className="input w-20 text-right font-mono" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} /></td>
                  <td className="px-2 py-1 text-right"><input className="input w-24 text-right font-mono" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} /></td>
                  <td><button type="button" className="btn btn-ghost px-2 py-1 text-rose-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-surface-200 px-2 py-2">
            <button type="button" className="btn btn-ghost" onClick={() => setLines([...lines, { product_id: '', qty: '', unit_price: '' }])}>+ Add line</button>
          </div>
        </div>

        <div className="text-right text-sm text-surface-500">
          Total: <span className="font-mono font-medium text-surface-900">{fmtMoney(total)}</span>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Create invoice'}</button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentDialog({ invoice, onClose, onDone }: { invoice: Invoice; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(invoice.outstanding_amount);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => {
      const idem = `pay-${invoice.ar_invoice_id}-${Date.now()}`;
      return api(`/ar/invoices/${invoice.ar_invoice_id}/payments`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idem },
        body: JSON.stringify({
          amount, payment_method: paymentMethod, reference_no: reference || undefined,
        }),
      });
    },
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  const submit = (e: React.FormEvent) => { e.preventDefault(); setError(null); m.mutate(); };

  return (
    <Modal title={`Pay invoice ${invoice.invoice_no}`} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <div className="text-sm text-surface-600">
          Customer: <span className="font-medium">{invoice.customer.customer_name}</span> · Outstanding: <span className="font-mono">{fmtMoney(invoice.outstanding_amount)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount</label>
            <input className="input text-right font-mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option>CASH</option>
              <option>BANK_TRANSFER</option>
              <option>QR_PAYMENT</option>
              <option>OTHER</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Reference</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Working…' : 'Record payment'}</button>
        </div>
      </form>
    </Modal>
  );
}
