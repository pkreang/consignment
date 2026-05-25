"use client";

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import { useProducts } from '@/lib/lookups';

type Lot = {
  lot_id: string;
  product_id: string;
  product: { sku_code: string; product_name: string };
  lot_no: string;
  manufacturing_date: string | null;
  expiry_date: string | null;
  qty_received: string;
  qty_remaining: string;
  unit_cost: string | null;
};
type Page<T> = { data: T[]; total: number };

export default function LotsPage() {
  const products = useProducts();
  const [productId, setProductId] = useState('');
  const [expiringBefore, setExpiringBefore] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['lots', productId, expiringBefore, page],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '20', page: String(page) });
      if (productId) params.set('product_id', productId);
      if (expiringBefore) params.set('expiring_before', new Date(expiringBefore).toISOString());
      return api<Page<Lot>>(`/inventory/lots?${params.toString()}`);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Product Lots (FEFO)</h1>
        <div className="flex items-center gap-2">
          <select className="input max-w-[260px]" value={productId} onChange={(e) => { setProductId(e.target.value); setPage(1); }}>
            <option value="">All products</option>
            {products.data?.map((p) => <option key={p.product_id} value={p.product_id}>{p.sku_code} — {p.product_name}</option>)}
          </select>
          <input type="date" className="input" value={expiringBefore} onChange={(e) => { setExpiringBefore(e.target.value); setPage(1); }} title="Expiring before" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-head">
            <th className="px-3 py-2">Lot no</th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Mfg</th>
            <th className="px-3 py-2">Expiry</th>
            <th className="px-3 py-2 text-right">Received</th>
            <th className="px-3 py-2 text-right">Remaining</th>
            <th className="px-3 py-2 text-right">Unit cost</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-3 py-4 text-slate-500">Loading…</td></tr>}
            {data?.data.map((l) => (
              <tr key={l.lot_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{l.lot_no}</td>
                <td className="px-3 py-2"><div>{l.product?.product_name}</div><div className="font-mono text-xs text-slate-500">{l.product?.sku_code}</div></td>
                <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(l.manufacturing_date)}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(l.expiry_date)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(l.qty_received)}</td>
                <td className="px-3 py-2 text-right font-mono font-medium">{fmtMoney(l.qty_remaining)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(l.unit_cost)}</td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-slate-500">No lots.</td></tr>}
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
    </div>
  );
}
