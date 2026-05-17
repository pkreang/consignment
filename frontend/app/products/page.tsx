"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { Modal } from '@/components/modal';

type Product = {
  product_id: string;
  sku_code: string;
  barcode: string | null;
  product_name: string;
  selling_price: string;
  cost: string;
  unit: string;
  active_flag: boolean;
  min_stock: string;
  max_stock: string;
  shelf_life_days: number;
};

type Page<T> = { data: T[]; total: number };

type FormState = {
  sku_code: string;
  barcode: string;
  product_name: string;
  unit: string;
  cost: string;
  selling_price: string;
  shelf_life_days: string;
  min_stock: string;
  max_stock: string;
  active_flag: boolean;
};

const emptyForm: FormState = {
  sku_code: '',
  barcode: '',
  product_name: '',
  unit: 'PCS',
  cost: '0',
  selling_price: '0',
  shelf_life_days: '0',
  min_stock: '0',
  max_stock: '0',
  active_flag: true,
};

function toForm(p: Product): FormState {
  return {
    sku_code: p.sku_code,
    barcode: p.barcode ?? '',
    product_name: p.product_name,
    unit: p.unit,
    cost: p.cost,
    selling_price: p.selling_price,
    shelf_life_days: String(p.shelf_life_days ?? 0),
    min_stock: p.min_stock,
    max_stock: p.max_stock,
    active_flag: p.active_flag,
  };
}

function toPayload(f: FormState) {
  return {
    sku_code: f.sku_code.trim(),
    barcode: f.barcode.trim() || undefined,
    product_name: f.product_name.trim(),
    unit: f.unit.trim() || 'PCS',
    cost: f.cost.trim() || '0',
    selling_price: f.selling_price.trim() || '0',
    shelf_life_days: Number(f.shelf_life_days || 0),
    min_stock: f.min_stock.trim() || '0',
    max_stock: f.max_stock.trim() || '0',
    active_flag: f.active_flag,
  };
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['products', q, page],
    queryFn: () =>
      api<Page<Product>>(
        `/products?pageSize=20&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
  };

  const onSaved = () => {
    void qc.invalidateQueries({ queryKey: ['products'] });
    closeForm();
  };

  const del = useMutation({
    mutationFn: (id: string) => api(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex items-center gap-2">
          <input
            className="input max-w-xs"
            placeholder="Search by SKU / name"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <button
            className="btn btn-primary whitespace-nowrap"
            onClick={() => setCreating(true)}
          >
            New Product
          </button>
        </div>
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
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-slate-500">Loading…</td>
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
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    className="btn btn-ghost px-2 py-1"
                    onClick={() => setEditing(p)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost px-2 py-1 text-rose-600"
                    disabled={del.isPending}
                    onClick={() => {
                      if (confirm(`Delete ${p.product_name}?`)) {
                        del.mutate(p.product_id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && !isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-slate-500">
                  No products found.
                </td>
              </tr>
            )}
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

      {(creating || editing) && (
        <ProductForm product={editing} onClose={closeForm} onSaved={onSaved} />
      )}
    </div>
  );
}

function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    product ? toForm(product) : emptyForm,
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      product
        ? api(`/products/${product.product_id}`, {
            method: 'PUT',
            body: JSON.stringify(toPayload(form)),
          })
        : api('/products', {
            method: 'POST',
            body: JSON.stringify(toPayload(form)),
          }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.sku_code.trim() || !form.product_name.trim()) {
      setError('SKU code and product name are required.');
      return;
    }
    save.mutate();
  };

  return (
    <Modal title={product ? 'Edit Product' : 'New Product'} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">SKU code</label>
            <input
              className="input"
              value={form.sku_code}
              onChange={(e) => set('sku_code', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Barcode</label>
            <input
              className="input"
              value={form.barcode}
              onChange={(e) => set('barcode', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Product name</label>
          <input
            className="input"
            value={form.product_name}
            onChange={(e) => set('product_name', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Unit</label>
            <input
              className="input"
              value={form.unit}
              onChange={(e) => set('unit', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Cost</label>
            <input
              className="input text-right font-mono"
              inputMode="decimal"
              value={form.cost}
              onChange={(e) => set('cost', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Selling price</label>
            <input
              className="input text-right font-mono"
              inputMode="decimal"
              value={form.selling_price}
              onChange={(e) => set('selling_price', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Min stock</label>
            <input
              className="input text-right font-mono"
              inputMode="decimal"
              value={form.min_stock}
              onChange={(e) => set('min_stock', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Max stock</label>
            <input
              className="input text-right font-mono"
              inputMode="decimal"
              value={form.max_stock}
              onChange={(e) => set('max_stock', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Shelf life (days)</label>
            <input
              className="input text-right font-mono"
              inputMode="numeric"
              value={form.shelf_life_days}
              onChange={(e) => set('shelf_life_days', e.target.value)}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active_flag}
            onChange={(e) => set('active_flag', e.target.checked)}
          />
          Active
        </label>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
