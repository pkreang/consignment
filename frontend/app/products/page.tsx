"use client";

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

type Product = {
  product_id: string;
  sku_code: string;
  product_name: string;
  selling_price: string;
  cost: string;
  unit: string;
  active_flag: boolean;
  min_stock: string;
  max_stock: string;
};

type Page<T> = { data: T[]; total: number };

export default function ProductsPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['products', q, page],
    queryFn: () =>
      api<Page<Product>>(
        `/products?pageSize=20&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <input
          className="input max-w-xs"
          placeholder="Search by SKU / name"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-head">
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Min</th>
              <th className="px-3 py-2 text-right">Max</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-slate-500">Loading…</td>
              </tr>
            )}
            {data?.data.map((p) => (
              <tr key={p.product_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{p.sku_code}</td>
                <td className="px-3 py-2 font-medium">{p.product_name}</td>
                <td className="px-3 py-2 text-xs uppercase text-slate-500">{p.unit}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(p.cost)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(p.selling_price)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(p.min_stock)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(p.max_stock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div>Total: {data.total.toLocaleString()} • Page {page}</div>
          <div className="flex gap-1">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <button
              className="btn btn-ghost"
              disabled={data.data.length < 20}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
