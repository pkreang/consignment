"use client";

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useCustomers, useProducts, useWarehouses } from '@/lib/lookups';
import { fmtMoney } from '@/lib/format';

type Line = { product_id: string; qty: string; unit_price: string };

export default function LoadPage() {
  const router = useRouter();
  const customers = useCustomers();
  const warehouses = useWarehouses();
  const products = useProducts();

  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [remark, setRemark] = useState('');
  const [overrideCredit, setOverrideCredit] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_id: '', qty: '', unit_price: '' }]);
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      const idem = `load-${customerId}-${Date.now()}`;
      return api('/inventory/load-to-customer', {
        method: 'POST',
        headers: { 'Idempotency-Key': idem },
        body: JSON.stringify({
          customer_id: customerId,
          warehouse_id: warehouseId,
          remark: remark || undefined,
          override_credit: overrideCredit || undefined,
          override_reason: overrideCredit ? overrideReason : undefined,
          lines: lines
            .filter((l) => l.product_id && Number(l.qty) > 0)
            .map((l) => ({
              product_id: l.product_id,
              qty: l.qty,
              unit_price: l.unit_price || undefined,
            })),
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

  const total = lines.reduce((s, l) => s + (Number(l.qty || 0) * Number(l.unit_price || 0)), 0);

  return (
    <form className="space-y-4" onSubmit={submit}>
      <h1 className="text-2xl font-semibold">Load Stock to Customer</h1>
      <div className="card grid gap-3 p-4 md:grid-cols-2">
        <div>
          <label className="label">Customer</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— select customer —</option>
            {customers.data?.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.customer_code} — {c.customer_name} (limit {fmtMoney(c.credit_limit)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">From warehouse</label>
          <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">— select warehouse —</option>
            {warehouses.data?.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_code} — {w.warehouse_name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Remark</label>
          <input className="input" value={remark} onChange={(e) => setRemark(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={overrideCredit} onChange={(e) => setOverrideCredit(e.target.checked)} />
            Override credit limit (requires <code className="font-mono text-xs">credit.override</code> permission)
          </label>
          {overrideCredit && (
            <input className="input mt-2" placeholder="Override reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          )}
        </div>
      </div>

      <Lines lines={lines} setLines={setLines} products={products.data ?? []} />

      <div className="flex items-center justify-between">
        <div className="text-sm text-surface-500">Estimated value: <span className="font-mono font-medium text-surface-900">{fmtMoney(total)}</span></div>
        <div className="flex gap-2">
          {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>
            {m.isPending ? 'Loading…' : 'Load to customer'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Lines({
  lines, setLines, products,
}: {
  lines: Line[];
  setLines: (l: Line[]) => void;
  products: { product_id: string; sku_code: string; product_name: string; selling_price: string }[];
}) {
  const update = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((l, j) => (i === j ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines(lines.filter((_, j) => j !== i));
  const add = () => setLines([...lines, { product_id: '', qty: '', unit_price: '' }]);

  return (
    <div className="card overflow-x-auto">
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
                  const p = products.find((x) => x.product_id === e.target.value);
                  update(i, { product_id: e.target.value, unit_price: p?.selling_price ?? l.unit_price });
                }}>
                  <option value="">— select —</option>
                  {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.sku_code} — {p.product_name}</option>)}
                </select>
              </td>
              <td className="px-3 py-2 text-right">
                <input className="input w-28 text-right font-mono" inputMode="decimal" value={l.qty} onChange={(e) => update(i, { qty: e.target.value })} />
              </td>
              <td className="px-3 py-2 text-right">
                <input className="input w-28 text-right font-mono" inputMode="decimal" value={l.unit_price} onChange={(e) => update(i, { unit_price: e.target.value })} />
              </td>
              <td className="px-3 py-2 text-right">
                <button type="button" className="btn btn-ghost px-2 py-1 text-rose-600 dark:text-rose-400" onClick={() => remove(i)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-surface-200 px-3 py-2">
        <button type="button" className="btn btn-ghost" onClick={add}>+ Add line</button>
      </div>
    </div>
  );
}
