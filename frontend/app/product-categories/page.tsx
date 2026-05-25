"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/modal';

type Category = { category_id: string; category_code: string; category_name: string };
type Page<T> = { data: T[]; total: number };

export default function ProductCategoriesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['product-categories', page],
    queryFn: () => api<Page<Category>>(`/product-categories?pageSize=20&page=${page}`),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/product-categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-categories'] }),
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Failed'),
  });
  const onSaved = () => { qc.invalidateQueries({ queryKey: ['product-categories'] }); qc.invalidateQueries({ queryKey: ['lookup', 'product-categories'] }); setEditing(null); setCreating(false); };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Product Categories</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>New Category</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-head"><th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={3} className="px-3 py-4 text-slate-500">Loading…</td></tr>}
            {data?.data.map((c) => (
              <tr key={c.category_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{c.category_code}</td>
                <td className="px-3 py-2 font-medium">{c.category_name}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button className="btn btn-ghost px-2 py-1" onClick={() => setEditing(c)}>Edit</button>
                  <button className="btn btn-ghost px-2 py-1 text-rose-600" onClick={() => { if (confirm(`Delete ${c.category_name}?`)) del.mutate(c.category_id); }}>Delete</button>
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-slate-500">No categories.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div>Total: {data.total} • Page {page}</div>
          <div className="flex gap-1">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <button className="btn btn-ghost" disabled={data.data.length < 20} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
      {(creating || editing) && <CategoryForm cat={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={onSaved} />}
    </div>
  );
}

function CategoryForm({ cat, onClose, onSaved }: { cat: Category | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(cat?.category_code ?? '');
  const [name, setName] = useState(cat?.category_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ category_code: code, category_name: name });
      return cat
        ? api(`/product-categories/${cat.category_id}`, { method: 'PUT', body })
        : api('/product-categories', { method: 'POST', body });
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <Modal title={cat ? 'Edit Category' : 'New Category'} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!code.trim() || !name.trim()) { setError('Code & name required'); return; } m.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Code</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
