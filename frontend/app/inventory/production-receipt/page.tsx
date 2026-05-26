"use client";

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useProducts, useWarehouses } from '@/lib/lookups';

type Line = {
  product_id: string;
  qty: string;
  unit_cost: string;
  lot_no: string;
  manufacturing_date: string;
  expiry_date: string;
};

const emptyLine: Line = { product_id: '', qty: '', unit_cost: '', lot_no: '', manufacturing_date: '', expiry_date: '' };

export default function ProductionReceiptPage() {
  const router = useRouter();
  const warehouses = useWarehouses();
  const products = useProducts();

  const [warehouseId, setWarehouseId] = useState('');
  const [remark, setRemark] = useState('');
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      api('/inventory/production-receipt', {
        method: 'POST',
        body: JSON.stringify({
          warehouse_id: warehouseId,
          remark: remark || undefined,
          lines: lines
            .filter((l) => l.product_id && Number(l.qty) > 0)
            .map((l) => ({
              product_id: l.product_id,
              qty: l.qty,
              unit_cost: l.unit_cost || undefined,
              lot_no: l.lot_no || undefined,
              manufacturing_date: l.manufacturing_date ? new Date(l.manufacturing_date).toISOString() : undefined,
              expiry_date: l.expiry_date ? new Date(l.expiry_date).toISOString() : undefined,
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
    if (lines.filter((l) => l.product_id && Number(l.qty) > 0).length === 0) {
      setError('Add at least one line with qty > 0'); return;
    }
    m.mutate();
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <h1 className="text-2xl font-semibold">Production Receipt</h1>
      <p className="text-sm text-surface-500">Receive finished goods into the warehouse. Optional lot info enables FEFO tracking.</p>
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
          <input className="input" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Batch 2026-05-25" />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead><tr className="table-head">
            <th className="px-3 py-2 text-left">Product</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Unit cost</th>
            <th className="px-3 py-2 text-left">Lot no</th>
            <th className="px-3 py-2 text-left">Mfg date</th>
            <th className="px-3 py-2 text-left">Expiry</th>
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
                <td className="px-3 py-2 text-right"><input className="input w-24 text-right font-mono" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} /></td>
                <td className="px-3 py-2 text-right"><input className="input w-24 text-right font-mono" value={l.unit_cost} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_cost: e.target.value } : x))} /></td>
                <td className="px-3 py-2"><input className="input w-28 font-mono" value={l.lot_no} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, lot_no: e.target.value } : x))} /></td>
                <td className="px-3 py-2"><input type="date" className="input" value={l.manufacturing_date} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, manufacturing_date: e.target.value } : x))} /></td>
                <td className="px-3 py-2"><input type="date" className="input" value={l.expiry_date} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, expiry_date: e.target.value } : x))} /></td>
                <td className="px-3 py-2 text-right"><button type="button" className="btn btn-ghost px-2 py-1 text-rose-600 dark:text-rose-400" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-surface-200 px-3 py-2">
          <button type="button" className="btn btn-ghost" onClick={() => setLines([...lines, { ...emptyLine }])}>+ Add line</button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Working…' : 'Receive into warehouse'}</button>
      </div>
    </form>
  );
}
