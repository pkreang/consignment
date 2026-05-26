"use client";

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';

type AuditRow = {
  audit_id: string;
  table_name: string;
  record_id: string | null;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE';
  changed_at: string;
  changedBy?: { username: string; full_name?: string } | null;
  old_value: unknown;
  new_value: unknown;
  context: unknown;
};
type Page<T> = { data: T[]; total: number };

const colorFor = (a: AuditRow['action_type']) =>
  a === 'CREATE'
    ? 'bg-emerald-100 text-emerald-700'
    : a === 'UPDATE'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-rose-100 text-rose-700';

export default function AuditPage() {
  const t = useTranslations('audit');
  const tc = useTranslations('common');
  const [page, setPage] = useState(1);
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, table, action],
    queryFn: () =>
      api<Page<AuditRow>>(
        `/audit?page=${page}&pageSize=20${table ? `&table_name=${encodeURIComponent(table)}` : ''}${action ? `&action_type=${action}` : ''}`,
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex gap-2">
          <input
            className="input max-w-[180px]"
            placeholder={t('tablePlaceholder')}
            value={table}
            onChange={(e) => {
              setTable(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="input max-w-[140px]"
          >
            <option value="">{t('allActions')}</option>
            <option>CREATE</option>
            <option>UPDATE</option>
            <option>DELETE</option>
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="table-head">
              <th className="px-3 py-2">{t('colWhen')}</th>
              <th className="px-3 py-2">{t('colAction')}</th>
              <th className="px-3 py-2">{t('colTable')}</th>
              <th className="px-3 py-2">{t('colRecord')}</th>
              <th className="px-3 py-2">{t('colBy')}</th>
              <th className="px-3 py-2">{t('colDiff')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-surface-500">{tc('loading')}</td>
              </tr>
            )}
            {data?.data.map((row) => (
              <tr key={row.audit_id} className="table-row align-top">
                <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtDate(row.changed_at)}</td>
                <td className="px-3 py-2">
                  <span className={`pill ${colorFor(row.action_type)}`}>{row.action_type}</span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.table_name}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.record_id ?? '—'}</td>
                <td className="px-3 py-2 text-xs">
                  {row.changedBy?.username ?? <span className="text-surface-400">{t('system')}</span>}
                </td>
                <td className="px-3 py-2">
                  <details>
                    <summary className="cursor-pointer text-xs text-brand-600">{t('view')}</summary>
                    <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <pre className="overflow-x-auto rounded bg-rose-50 p-2 text-[11px]">
                        {t('oldLabel')} {JSON.stringify(row.old_value, null, 2)}
                      </pre>
                      <pre className="overflow-x-auto rounded bg-emerald-50 p-2 text-[11px]">
                        {t('newLabel')} {JSON.stringify(row.new_value, null, 2)}
                      </pre>
                    </div>
                    {row.context ? (
                      <pre className="mt-2 overflow-x-auto rounded bg-surface-100 p-2 text-[11px]">
                        {t('contextLabel')} {JSON.stringify(row.context, null, 2)}
                      </pre>
                    ) : null}
                  </details>
                </td>
              </tr>
            ))}
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
    </div>
  );
}
