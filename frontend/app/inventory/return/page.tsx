"use client";

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useCustomers, useProducts, useWarehouses } from '@/lib/lookups';
import { fmtMoney } from '@/lib/format';

type Line = { product_id: string; qty: string; unit_price: string };

export default function ReturnPage() {
  const router = useRouter();
  const customers = useCustomers();
  const warehouses = useWarehouses();
  const products = useProducts();

  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [remark, setRemark] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_id: '', qty: '', unit_price: '' }]);
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      const idem = `return-${customerId}-${Date.now()}`;
      return api('/inventory/return-from-customer', {
        method: 'POST',
        headers: { 'Idempotency-Key': idem },
        body: JSON.stringify({
          customer_id: customerId,
          warehouse_id: warehouseId,
          remark: remark || undefined,
          lines: lines
            .filter((l) => l.product_id && Number(l.qty) > 0)
            .map((l) => ({ product_id: l.product_id, qty: l.qty, unit_price: l.unit_price || undefined })),
        }),
      });
    },
    onSuccess: () => router.push('/inventory'),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerId || !warehouseId) { setError('Customer & warehouse are required'); return; }
    if (lines.filter((l) => l.product_id && Number(l.qty) > 0).length === 0) {
      setError('Add at least one line with qty > 0'); return;
    }
    m.mutate();
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <h1 className="text-2xl font-semibold">Return Stock from Customer</h1>
      <div className="card grid gap-3 p-4 md:grid-cols-2">
        <div>
          <label className="label">Customer</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— select —</option>
            {customers.data?.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>{c.customer_code} — {c.customer_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Return to warehouse</label>
          <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">— select —</option>
            {warehouses.data?.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_code} — {w.warehouse_name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Remark</label>
          <input className="input" value={remark} onChange={(e) => setRemark(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-head">
            <th className="px-3 py-2 text-left">Product</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Unit price</th>
            <th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="table-row">
                <td className="px-3 py-2">
                  <select className="input" value={l.product_id} onChange={(e) => {
                    const p = products.data?.find((x) => x.product_id === e.target.value);
                    setLines(lines.map((x, j) => j === i ? { ...x, product_id: e.target.value, unit_price: p?.selling_price ?? x.unit_price } : x));
                  }}>
                    <option value="">— select —</option>
                    {products.data?.map((p) => <option key={p.product_id} value={p.product_id}>{p.sku_code} — {p.product_name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <input className="input w-28 text-right font-mono" inputMode="decimal" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                </td>
                <td className="px-3 py-2 text-right">
                  <input className="input w-28 text-right font-mono" inputMode="decimal" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="btn btn-ghost px-2 py-1 text-rose-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-200 px-3 py-2">
          <button type="button" className="btn btn-ghost" onClick={() => setLines([...lines, { product_id: '', qty: '', unit_price: '' }])}>+ Add line</button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Estimated value: <span className="font-mono font-medium text-slate-900">{fmtMoney(lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0))}</span>
        </div>
        <div className="flex items-center gap-3">
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>
            {m.isPending ? 'Working…' : 'Return stock'}
          </button>
        </div>
      </div>
    </form>
  );
}
