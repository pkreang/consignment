"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/modal';

type Warehouse = { warehouse_id: string; warehouse_code: string; warehouse_name: string; active_flag: boolean };
type Page<T> = { data: T[]; total: number };

export default function WarehousesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['warehouses', q, page],
    queryFn: () => api<Page<Warehouse>>(`/warehouses?pageSize=20&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/warehouses/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Failed'),
  });
  const onSaved = () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); qc.invalidateQueries({ queryKey: ['lookup', 'warehouses'] }); setEditing(null); setCreating(false); };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Warehouses</h1>
        <div className="flex items-center gap-2">
          <input className="input max-w-xs" placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <button className="btn btn-primary" onClick={() => setCreating(true)}>New Warehouse</button>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-head"><th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Active</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.data.map((w) => (
              <tr key={w.warehouse_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{w.warehouse_code}</td>
                <td className="px-3 py-2 font-medium">{w.warehouse_name}</td>
                <td className="px-3 py-2"><span className={'pill ' + (w.active_flag ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-200 text-surface-700')}>{w.active_flag ? 'Active' : 'Inactive'}</span></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button className="btn btn-ghost px-2 py-1" onClick={() => setEditing(w)}>Edit</button>
                  <button className="btn btn-ghost px-2 py-1 text-rose-600" onClick={() => { if (confirm(`Delete ${w.warehouse_name}?`)) del.mutate(w.warehouse_id); }}>Delete</button>
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-surface-500">No warehouses.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="flex items-center justify-between text-sm text-surface-500">
          <div>Total: {data.total} • Page {page}</div>
          <div className="flex gap-1">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <button className="btn btn-ghost" disabled={data.data.length < 20} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
      {(creating || editing) && <WarehouseForm warehouse={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={onSaved} />}
    </div>
  );
}

function WarehouseForm({ warehouse, onClose, onSaved }: { warehouse: Warehouse | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(warehouse?.warehouse_code ?? '');
  const [name, setName] = useState(warehouse?.warehouse_name ?? '');
  const [active, setActive] = useState(warehouse?.active_flag ?? true);
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ warehouse_code: code, warehouse_name: name, active_flag: active });
      return warehouse
        ? api(`/warehouses/${warehouse.warehouse_id}`, { method: 'PUT', body })
        : api('/warehouses', { method: 'POST', body });
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <Modal title={warehouse ? 'Edit Warehouse' : 'New Warehouse'} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!code.trim() || !name.trim()) { setError('Code & name required'); return; } m.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Code</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
