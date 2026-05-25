"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import { useCustomers } from '@/lib/lookups';
import { Modal } from '@/components/modal';

type Collection = {
  collection_id: string;
  collection_no: string;
  collection_date: string;
  amount_collected: string;
  payment_method: string;
  reference_no: string | null;
  customer: { customer_code: string; customer_name: string };
  collector?: { employee_name: string } | null;
};
type Page<T> = { data: T[]; total: number };

export default function CollectionsPage() {
  const qc = useQueryClient();
  const customers = useCustomers();
  const [customerId, setCustomerId] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['collections', customerId, page],
    queryFn: () => {
      const p = new URLSearchParams({ pageSize: '20', page: String(page) });
      if (customerId) p.set('customer_id', customerId);
      return api<Page<Collection>>(`/collections?${p.toString()}`);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Collections</h1>
        <div className="flex items-center gap-2">
          <select className="input max-w-[240px]" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setPage(1); }}>
            <option value="">All customers</option>
            {customers.data?.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.customer_code} — {c.customer_name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>Record collection</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-head">
            <th className="px-3 py-2">Collection #</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Collector</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2">Method</th>
            <th className="px-3 py-2">Reference</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-3 py-4 text-slate-500">Loading…</td></tr>}
            {data?.data.map((c) => (
              <tr key={c.collection_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{c.collection_no}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(c.collection_date)}</td>
                <td className="px-3 py-2"><div>{c.customer?.customer_name}</div><div className="font-mono text-xs text-slate-500">{c.customer?.customer_code}</div></td>
                <td className="px-3 py-2 text-xs">{c.collector?.employee_name ?? '—'}</td>
                <td className="px-3 py-2 text-right font-mono font-medium">{fmtMoney(c.amount_collected)}</td>
                <td className="px-3 py-2"><span className="pill bg-slate-100 text-slate-700">{c.payment_method}</span></td>
                <td className="px-3 py-2 text-xs text-slate-500">{c.reference_no ?? '—'}</td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-slate-500">No collections.</td></tr>}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div>Total: {data.total.toLocaleString()} • Page {page}</div>
          <div className="flex gap-1">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <button className="btn btn-ghost" disabled={data.data.length < 20} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {creating && (
        <CreateForm
          onClose={() => setCreating(false)}
          onDone={() => { qc.invalidateQueries({ queryKey: ['collections'] }); setCreating(false); }}
        />
      )}
    </div>
  );
}

function CreateForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const customers = useCustomers();
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => {
      const idem = `coll-${customerId}-${Date.now()}`;
      return api('/collections', {
        method: 'POST',
        headers: { 'Idempotency-Key': idem },
        body: JSON.stringify({
          customer_id: customerId,
          amount_collected: amount,
          payment_method: paymentMethod,
          reference_no: reference || undefined,
          note: note || undefined,
        }),
      });
    },
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerId || !amount || Number(amount) <= 0) { setError('Customer & positive amount required'); return; }
    m.mutate();
  };

  return (
    <Modal title="Record collection" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label">Customer</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— select —</option>
            {customers.data?.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.customer_code} — {c.customer_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount</label>
            <input className="input text-right font-mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Payment method</label>
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
        <div>
          <label className="label">Note</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">Payment is allocated to oldest open AR invoices first (FIFO).</p>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Recording…' : 'Record collection'}</button>
        </div>
      </form>
    </Modal>
  );
}
