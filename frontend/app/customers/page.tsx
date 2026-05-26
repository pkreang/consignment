"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { Modal } from '@/components/modal';
import { useErrorMessage } from '@/lib/use-error-message';

type Customer = {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  owner_name: string | null;
  phone: string | null;
  line_id: string | null;
  address: string | null;
  province: string | null;
  visit_frequency_days: number;
  max_capacity_qty: string;
  credit_term_days: number;
  credit_limit: string;
  active_flag: boolean;
};

type Page<T> = { data: T[]; total: number };

type FormState = {
  customer_code: string;
  customer_name: string;
  owner_name: string;
  phone: string;
  line_id: string;
  address: string;
  province: string;
  visit_frequency_days: string;
  max_capacity_qty: string;
  credit_term_days: string;
  credit_limit: string;
  active_flag: boolean;
};

const emptyForm: FormState = {
  customer_code: '',
  customer_name: '',
  owner_name: '',
  phone: '',
  line_id: '',
  address: '',
  province: '',
  visit_frequency_days: '3',
  max_capacity_qty: '0',
  credit_term_days: '0',
  credit_limit: '0',
  active_flag: true,
};

function toForm(c: Customer): FormState {
  return {
    customer_code: c.customer_code,
    customer_name: c.customer_name,
    owner_name: c.owner_name ?? '',
    phone: c.phone ?? '',
    line_id: c.line_id ?? '',
    address: c.address ?? '',
    province: c.province ?? '',
    visit_frequency_days: String(c.visit_frequency_days ?? 3),
    max_capacity_qty: c.max_capacity_qty ?? '0',
    credit_term_days: String(c.credit_term_days ?? 0),
    credit_limit: c.credit_limit ?? '0',
    active_flag: c.active_flag,
  };
}

function toPayload(f: FormState) {
  return {
    customer_code: f.customer_code.trim(),
    customer_name: f.customer_name.trim(),
    owner_name: f.owner_name.trim() || undefined,
    phone: f.phone.trim() || undefined,
    line_id: f.line_id.trim() || undefined,
    address: f.address.trim() || undefined,
    province: f.province.trim() || undefined,
    visit_frequency_days: Number(f.visit_frequency_days || 0),
    max_capacity_qty: f.max_capacity_qty.trim() || '0',
    credit_term_days: Number(f.credit_term_days || 0),
    credit_limit: f.credit_limit.trim() || '0',
    active_flag: f.active_flag,
  };
}

export default function CustomersPage() {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', q, page],
    queryFn: () =>
      api<Page<Customer>>(
        `/customers?pageSize=20&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
  };

  const onSaved = () => {
    void qc.invalidateQueries({ queryKey: ['customers'] });
    closeForm();
  };

  const del = useMutation({
    mutationFn: (id: string) => api(`/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
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
            {t('newCustomer')}
          </button>
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        {isLoading && (
          <div className="card p-4 text-sm text-surface-500">{tc('loading')}</div>
        )}
        {data?.data.map((c) => (
          <div key={c.customer_id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{c.customer_name}</div>
                <div className="font-mono text-xs text-surface-500">{c.customer_code}</div>
              </div>
              <span className={c.active_flag ? 'pill-success' : 'pill-neutral'}>
                {c.active_flag ? tc('active') : tc('inactive')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-surface-600 dark:text-surface-400">
              <div>
                <div className="text-surface-500">{t('colCreditTerm')}</div>
                <div>{t('creditTermDays', { days: c.credit_term_days })}</div>
              </div>
              <div className="text-right">
                <div className="text-surface-500">{t('colCreditLimit')}</div>
                <div className="font-mono">{fmtMoney(c.credit_limit)}</div>
              </div>
            </div>
            <div className="flex justify-end gap-1 border-t border-surface-100 pt-2 dark:border-surface-800">
              <button className="btn btn-ghost px-2 py-1" onClick={() => setEditing(c)}>
                {tc('edit')}
              </button>
              <button
                className="btn btn-ghost px-2 py-1 text-rose-600 dark:text-rose-400"
                disabled={del.isPending}
                onClick={() => {
                  if (confirm(t('deleteConfirm', { name: c.customer_name }))) {
                    del.mutate(c.customer_id);
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
              <th className="px-3 py-2">{t('colCode')}</th>
              <th className="px-3 py-2">{t('colName')}</th>
              <th className="px-3 py-2 text-right">{t('colCreditTerm')}</th>
              <th className="px-3 py-2 text-right">{t('colCreditLimit')}</th>
              <th className="px-3 py-2">{t('colActive')}</th>
              <th className="px-3 py-2 text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-surface-500">{tc('loading')}</td>
              </tr>
            )}
            {data?.data.map((c) => (
              <tr key={c.customer_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{c.customer_code}</td>
                <td className="px-3 py-2 font-medium">{c.customer_name}</td>
                <td className="px-3 py-2 text-right">
                  {t('creditTermDays', { days: c.credit_term_days })}
                </td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(c.credit_limit)}</td>
                <td className="px-3 py-2">
                  <span className={c.active_flag ? 'pill-success' : 'pill-neutral'}>
                    {c.active_flag ? tc('active') : tc('inactive')}
                  </span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    className="btn btn-ghost px-2 py-1"
                    onClick={() => setEditing(c)}
                  >
                    {tc('edit')}
                  </button>
                  <button
                    className="btn btn-ghost px-2 py-1 text-rose-600 dark:text-rose-400"
                    disabled={del.isPending}
                    onClick={() => {
                      if (confirm(t('deleteConfirm', { name: c.customer_name }))) {
                        del.mutate(c.customer_id);
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
                <td colSpan={6} className="px-3 py-4 text-surface-500">
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
        <CustomerForm customer={editing} onClose={closeForm} onSaved={onSaved} />
      )}
    </div>
  );
}

function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [form, setForm] = useState<FormState>(
    customer ? toForm(customer) : emptyForm,
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      customer
        ? api(`/customers/${customer.customer_id}`, {
            method: 'PUT',
            body: JSON.stringify(toPayload(form)),
          })
        : api('/customers', {
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
    if (!form.customer_code.trim() || !form.customer_name.trim()) {
      setError(t('validationRequired'));
      return;
    }
    save.mutate();
  };

  return (
    <Modal
      title={customer ? t('editCustomer') : t('newCustomer')}
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t('fieldCustomerCode')}</label>
            <input
              className="input"
              value={form.customer_code}
              onChange={(e) => set('customer_code', e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('fieldCustomerName')}</label>
            <input
              className="input"
              value={form.customer_name}
              onChange={(e) => set('customer_name', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t('fieldOwnerName')}</label>
            <input
              className="input"
              value={form.owner_name}
              onChange={(e) => set('owner_name', e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('fieldPhone')}</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t('fieldLineId')}</label>
            <input
              className="input"
              value={form.line_id}
              onChange={(e) => set('line_id', e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('fieldProvince')}</label>
            <input
              className="input"
              value={form.province}
              onChange={(e) => set('province', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">{t('fieldAddress')}</label>
          <input
            className="input"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">{t('fieldVisitFreq')}</label>
            <input
              className="input text-right font-mono"
              inputMode="numeric"
              value={form.visit_frequency_days}
              onChange={(e) => set('visit_frequency_days', e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('fieldMaxCapacity')}</label>
            <input
              className="input text-right font-mono"
              inputMode="decimal"
              value={form.max_capacity_qty}
              onChange={(e) => set('max_capacity_qty', e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('fieldCreditTermDays')}</label>
            <input
              className="input text-right font-mono"
              inputMode="numeric"
              value={form.credit_term_days}
              onChange={(e) => set('credit_term_days', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">{t('fieldCreditLimit')}</label>
          <input
            className="input text-right font-mono"
            inputMode="decimal"
            value={form.credit_limit}
            onChange={(e) => set('credit_limit', e.target.value)}
          />
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
