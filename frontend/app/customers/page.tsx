"use client";

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

type Customer = {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  credit_term_days: number;
  credit_limit: string;
  active_flag: boolean;
};

type Page<T> = { data: T[]; total: number };

export default function CustomersPage() {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['customers', q, page],
    queryFn: () =>
      api<Page<Customer>>(
        `/customers?pageSize=20&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <input
          className="input max-w-xs"
          placeholder={t('searchPlaceholder')}
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
              <th className="px-3 py-2">{t('colCode')}</th>
              <th className="px-3 py-2">{t('colName')}</th>
              <th className="px-3 py-2 text-right">{t('colCreditTerm')}</th>
              <th className="px-3 py-2 text-right">{t('colCreditLimit')}</th>
              <th className="px-3 py-2">{t('colActive')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-slate-500">{tc('loading')}</td>
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
                  <span
                    className={
                      'pill ' +
                      (c.active_flag ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700')
                    }
                  >
                    {c.active_flag ? tc('active') : tc('inactive')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-slate-500">
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
    </div>
  );
}
