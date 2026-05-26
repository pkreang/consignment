"use client";

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';

type Tab = 'warehouse' | 'consignment' | 'movements';
type Page<T> = { data: T[]; total: number };
type WhStock = {
  id: string;
  warehouse_id: string;
  product_id: string;
  warehouse: { warehouse_code: string; warehouse_name: string };
  product: { sku_code: string; product_name: string; min_stock: string; max_stock: string };
  qty_on_hand: string;
  qty_reserved: string;
  qty_available: string;
};
type CnStock = {
  id: string;
  customer_id: string;
  product_id: string;
  customer: { customer_code: string; customer_name: string };
  product: { sku_code: string; product_name: string };
  qty_on_hand: string;
  last_visit_date: string | null;
};
type Movement = {
  movement_id: string;
  movement_date: string;
  movement_type: string;
  ref_doc_type: string;
  ref_doc_id: string;
  warehouse_id: string | null;
  customer_id: string | null;
  product: { sku_code: string; product_name: string };
  qty_in: string;
  qty_out: string;
  balance_after: string;
  unit_cost: string | null;
  unit_price: string | null;
};

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('warehouse');
  const [low, setLow] = useState(false);
  const [page, setPage] = useState(1);
  const [mType, setMType] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="-mx-1 flex items-center gap-1 overflow-x-auto sm:mx-0 sm:gap-2">
          <Link className="btn btn-ghost whitespace-nowrap" href="/inventory/load">Load</Link>
          <Link className="btn btn-ghost whitespace-nowrap" href="/inventory/return">Return</Link>
          <Link className="btn btn-ghost whitespace-nowrap" href="/inventory/adjustment">Adjust</Link>
          <Link className="btn btn-primary whitespace-nowrap" href="/inventory/production-receipt">Production</Link>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-surface-200 text-sm dark:border-surface-800">
        {(['warehouse', 'consignment', 'movements'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={
              'whitespace-nowrap border-b-2 px-3 py-2 transition ' +
              (tab === t
                ? 'border-brand-600 font-medium text-brand-700 dark:text-brand-400'
                : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300')
            }
          >
            {t === 'warehouse' ? 'Warehouse stock' : t === 'consignment' ? 'Consignment stock' : 'Movements'}
          </button>
        ))}
      </div>

      {tab === 'warehouse' && (
        <WarehouseTab low={low} setLow={setLow} page={page} setPage={setPage} />
      )}
      {tab === 'consignment' && <ConsignmentTab page={page} setPage={setPage} />}
      {tab === 'movements' && <MovementsTab mType={mType} setMType={setMType} page={page} setPage={setPage} />}
    </div>
  );
}

function WarehouseTab({ low, setLow, page, setPage }: { low: boolean; setLow: (b: boolean) => void; page: number; setPage: (n: number) => void; }) {
  const { data, isLoading } = useQuery({
    queryKey: ['inv-wh', low, page],
    queryFn: () =>
      api<Page<WhStock>>(`/inventory/warehouse?pageSize=20&page=${page}${low ? '&low_stock=true' : ''}`),
  });
  return (
    <>
      <label className="flex items-center gap-2 text-sm text-surface-600">
        <input type="checkbox" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(1); }} />
        Low stock only
      </label>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr className="table-head">
            <th className="px-3 py-2">Warehouse</th>
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2 text-right">On hand</th>
            <th className="px-3 py-2 text-right">Reserved</th>
            <th className="px-3 py-2 text-right">Available</th>
            <th className="px-3 py-2 text-right">Min / Max</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.data.map((s) => (
              <tr key={s.id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{s.warehouse?.warehouse_code}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.product?.sku_code}</td>
                <td className="px-3 py-2">{s.product?.product_name}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(s.qty_on_hand)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(s.qty_reserved)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(s.qty_available)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-surface-500">
                  {fmtMoney(s.product?.min_stock)} / {fmtMoney(s.product?.max_stock)}
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-surface-500">No rows.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={data?.total} rows={data?.data.length} />
    </>
  );
}

function ConsignmentTab({ page, setPage }: { page: number; setPage: (n: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['inv-cn', page],
    queryFn: () => api<Page<CnStock>>(`/inventory/consignment?pageSize=20&page=${page}`),
  });
  return (
    <>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr className="table-head">
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2 text-right">On hand</th>
            <th className="px-3 py-2">Last visit</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.data.map((s) => (
              <tr key={s.id} className="table-row">
                <td className="px-3 py-2"><div className="font-medium">{s.customer?.customer_name}</div><div className="font-mono text-xs text-surface-500">{s.customer?.customer_code}</div></td>
                <td className="px-3 py-2 font-mono text-xs">{s.product?.sku_code}</td>
                <td className="px-3 py-2">{s.product?.product_name}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(s.qty_on_hand)}</td>
                <td className="px-3 py-2 text-xs text-surface-500">{fmtDate(s.last_visit_date)}</td>
              </tr>
            ))}
            {data && data.data.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-surface-500">No rows.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={data?.total} rows={data?.data.length} />
    </>
  );
}

function MovementsTab({ mType, setMType, page, setPage }: { mType: string; setMType: (s: string) => void; page: number; setPage: (n: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['inv-mv', mType, page],
    queryFn: () =>
      api<Page<Movement>>(`/inventory/movements?pageSize=20&page=${page}${mType ? `&movement_type=${mType}` : ''}`),
  });
  return (
    <>
      <select className="input max-w-[260px]" value={mType} onChange={(e) => { setMType(e.target.value); setPage(1); }}>
        <option value="">All movement types</option>
        <option>WAREHOUSE_ADJUSTMENT</option>
        <option>PRODUCTION_RECEIPT</option>
        <option>LOAD_TO_CUSTOMER</option>
        <option>REPLENISHMENT</option>
        <option>SALE_CONFIRMED</option>
        <option>RETURN_FROM_CUSTOMER</option>
        <option>CUSTOMER_ADJUSTMENT</option>
      </select>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr className="table-head">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Ref</th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2 text-right">In</th>
            <th className="px-3 py-2 text-right">Out</th>
            <th className="px-3 py-2 text-right">Balance</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.data.map((m) => (
              <tr key={m.movement_id} className="table-row">
                <td className="px-3 py-2 text-xs text-surface-500">{fmtDate(m.movement_date)}</td>
                <td className="px-3 py-2"><span className="pill-neutral">{m.movement_type}</span></td>
                <td className="px-3 py-2 font-mono text-xs text-surface-500">{m.ref_doc_type}:{m.ref_doc_id}</td>
                <td className="px-3 py-2"><div>{m.product?.product_name}</div><div className="font-mono text-xs text-surface-500">{m.product?.sku_code}</div></td>
                <td className="px-3 py-2 text-right font-mono text-emerald-700 dark:text-emerald-400">{Number(m.qty_in) > 0 ? fmtMoney(m.qty_in) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-rose-700 dark:text-rose-300">{Number(m.qty_out) > 0 ? fmtMoney(m.qty_out) : ''}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(m.balance_after)}</td>
              </tr>
            ))}
            {data && data.data.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-surface-500">No movements.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={data?.total} rows={data?.data.length} />
    </>
  );
}

function Pager({ page, setPage, total, rows }: { page: number; setPage: (n: number) => void; total?: number; rows?: number; }) {
  return (
    <div className="flex items-center justify-between text-sm text-surface-500">
      <div>Total: {total?.toLocaleString() ?? '—'} • Page {page}</div>
      <div className="flex gap-1">
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
        <button className="btn btn-ghost" disabled={(rows ?? 0) < 20} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
