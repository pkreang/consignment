"use client";

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useProducts, useWarehouses } from '@/lib/lookups';

type Line = { product_id: string; delta_qty: string; unit_cost: string };

export default function AdjustmentPage() {
  const router = useRouter();
  const warehouses = useWarehouses();
  const products = useProducts();

  const [warehouseId, setWarehouseId] = useState('');
  const [remark, setRemark] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_id: '', delta_qty: '', unit_cost: '' }]);
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      api('/inventory/adjustment', {
        method: 'POST',
        body: JSON.stringify({
          warehouse_id: warehouseId,
          remark: remark || undefined,
          lines: lines
            .filter((l) => l.product_id && Number(l.delta_qty) !== 0)
            .map((l) => ({
              product_id: l.product_id,
              delta_qty: l.delta_qty,
              unit_cost: l.unit_cost || undefined,
            })),
        }),
      }),
    onSuccess: () => router.push('/inventory'),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!warehouseId) { setError('Warehouse is required'); return; }
    if (lines.filter((l) => l.product_id && Number(l.delta_qty) !== 0).length === 0) {
      setError('Add at least one line with delta ≠ 0'); return;
    }
    m.mutate();
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <h1 className="text-2xl font-semibold">Warehouse Stock Adjustment</h1>
      <p className="text-sm text-slate-500">Use positive delta to add, negative to subtract (e.g. -3 for 3 units shrinkage).</p>
      <div className="card grid gap-3 p-4 md:grid-cols-2">
        <div>
          <label className="label">Warehouse</label>
          <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">— select —</option>
            {warehouses.data?.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_code} — {w.warehouse_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Remark</label>
          <input className="input" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. cycle count variance" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-head">
            <th className="px-3 py-2 text-left">Product</th>
            <th className="px-3 py-2 text-right">Delta qty</th>
            <th className="px-3 py-2 text-right">Unit cost</th>
            <th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="table-row">
                <td className="px-3 py-2">
                  <select className="input" value={l.product_id} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, product_id: e.target.value } : x))}>
                    <option value="">— select —</option>
                    {products.data?.map((p) => <option key={p.product_id} value={p.product_id}>{p.sku_code} — {p.product_name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <input className="input w-28 text-right font-mono" inputMode="decimal" value={l.delta_qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, delta_qty: e.target.value } : x))} placeholder="±qty" />
                </td>
                <td className="px-3 py-2 text-right">
                  <input className="input w-28 text-right font-mono" inputMode="decimal" value={l.unit_cost} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_cost: e.target.value } : x))} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="btn btn-ghost px-2 py-1 text-rose-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-200 px-3 py-2">
          <button type="button" className="btn btn-ghost" onClick={() => setLines([...lines, { product_id: '', delta_qty: '', unit_cost: '' }])}>+ Add line</button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={m.isPending}>
          {m.isPending ? 'Working…' : 'Post adjustment'}
        </button>
      </div>
    </form>
  );
}
