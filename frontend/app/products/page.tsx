"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { Modal } from '@/components/modal';
import { useErrorMessage } from '@/lib/use-error-message';

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
  const t = useTranslations('products');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
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
    onError: (e) => alert(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <input
            className="input sm:max-w-xs"
            placeholder={t('searchPlaceholder')}
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
            {t('newProduct')}
          </button>
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        {isLoading && (
          <div className="card p-4 text-sm text-surface-500">{tc('loading')}</div>
        )}
        {data?.data.map((p) => (
          <div key={p.product_id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{p.product_name}</div>
                <div className="font-mono text-xs text-surface-500">
                  {p.sku_code} · {p.unit}
                </div>
              </div>
              <span className={p.active_flag ? 'pill-success' : 'pill-neutral'}>
                {p.active_flag ? tc('active') : tc('inactive')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-surface-600 dark:text-surface-400">
              <div>
                <div className="text-surface-500">{t('colCost')}</div>
                <div className="font-mono">{fmtMoney(p.cost)}</div>
              </div>
              <div className="text-right">
                <div className="text-surface-500">{t('colPrice')}</div>
                <div className="font-mono">{fmtMoney(p.selling_price)}</div>
              </div>
            </div>
            <div className="flex justify-end gap-1 border-t border-surface-100 pt-2 dark:border-surface-800">
              <button className="btn btn-ghost px-2 py-1" onClick={() => setEditing(p)}>
                {tc('edit')}
              </button>
              <button
                className="btn btn-ghost px-2 py-1 text-rose-600 dark:text-rose-400"
                disabled={del.isPending}
                onClick={() => {
                  if (confirm(t('deleteConfirm', { name: p.product_name }))) {
                    del.mutate(p.product_id);
                  }
                }}
              >
                {tc('delete')}
              </button>
            </div>
          </div>
        ))}
        {data && data.data.length === 0 && !isLoading && (
          <div className="card p-4 text-sm text-surface-500">{t('empty')}</div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="table-head">
              <th className="px-3 py-2">{t('colSku')}</th>
              <th className="px-3 py-2">{t('colName')}</th>
              <th className="px-3 py-2">{t('colUnit')}</th>
              <th className="px-3 py-2 text-right">{t('colCost')}</th>
              <th className="px-3 py-2 text-right">{t('colPrice')}</th>
              <th className="px-3 py-2 text-right">{t('colMin')}</th>
              <th className="px-3 py-2 text-right">{t('colMax')}</th>
              <th className="px-3 py-2 text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-surface-500">{tc('loading')}</td>
              </tr>
            )}
            {data?.data.map((p) => (
              <tr key={p.product_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{p.sku_code}</td>
                <td className="px-3 py-2 font-medium">{p.product_name}</td>
                <td className="px-3 py-2 text-xs uppercase text-surface-500">{p.unit}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(p.cost)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(p.selling_price)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(p.min_stock)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(p.max_stock)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    className="btn btn-ghost px-2 py-1"
                    onClick={() => setEditing(p)}
                  >
                    {tc('edit')}
                  </button>
                  <button
                    className="btn btn-ghost px-2 py-1 text-rose-600 dark:text-rose-400"
                    disabled={del.isPending}
                    onClick={() => {
                      if (confirm(t('deleteConfirm', { name: p.product_name }))) {
                        del.mutate(p.product_id);
                      }
                    }}
                  >
                    {tc('delete')}
                  </button>
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && !isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-surface-500">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-surface-500">
          <div>{tc('pagination', { total: data.total.toLocaleString(), page })}</div>
          <div className="flex gap-1">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {tc('prev')}
            </button>
            <button
              className="btn btn-ghost"
              disabled={data.data.length < 20}
              onClick={() => setPage((p) => p + 1)}
            >
              {tc('next')}
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
  const t = useTranslations('products');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
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
    onError: (e) => setError(errorMessage(e)),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.sku_code.trim() || !form.product_name.trim()) {
      setError(t('validationRequired'));
      return;
    }
    save.mutate();
  };

  return (
    <Modal title={product ? t('editProduct') : t('newProduct')} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t('fieldSkuCode')}</label>
            <input
              className="input"
              value={form.sku_code}
              onChange={(e) => set('sku_code', e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('fieldBarcode')}</label>
            <input
              className="input"
              value={form.barcode}
              onChange={(e) => set('barcode', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">{t('fieldProductName')}</label>
          <input
            className="input"
            value={form.product_name}
            onChange={(e) => set('product_name', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">{t('fieldUnit')}</label>
            <input
              className="input"
              value={form.unit}
              onChange={(e) => set('unit', e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('fieldCost')}</label>
            <input
              className="input text-right font-mono"
              inputMode="decimal"
              value={form.cost}
              onChange={(e) => set('cost', e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('fieldSellingPrice')}</label>
            <input
              className="input text-right font-mono"
              inputMode="decimal"
              value={form.selling_price}
              onChange={(e) => set('selling_price', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">{t('fieldMinStock')}</label>
            <input
              className="input text-right font-mono"
              inputMode="decimal"
              value={form.min_stock}
              onChange={(e) => set('min_stock', e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('fieldMaxStock')}</label>
            <input
              className="input text-right font-mono"
              inputMode="decimal"
              value={form.max_stock}
              onChange={(e) => set('max_stock', e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('fieldShelfLife')}</label>
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
          {tc('active')}
        </label>
        {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tc('cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={save.isPending}
          >
            {save.isPending ? tc('saving') : tc('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
