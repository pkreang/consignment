"use client";

import { useQuery } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { api } from '@/lib/api';

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? '') + '/api/v1'
    : '/api/v1';

export type ColDef<T> = {
  label: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
};

export function defaultRange(days = 30): { date_from: string; date_to: string } {
  const to = new Date();
  const from = new Date(Date.now() - days * 86400_000);
  return { date_from: toLocalDate(from), date_to: toLocalDate(to) };
}

function toLocalDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toIso(d: string | undefined): string | undefined {
  return d ? new Date(d).toISOString() : undefined;
}

export function ReportPage<T>({
  title,
  endpoint,
  columns,
  withDateRange = true,
  extraParams = {},
  rowKey,
  extraFilters,
  description,
}: {
  title: string;
  endpoint: string;
  columns: ColDef<T>[];
  withDateRange?: boolean;
  extraParams?: Record<string, string | undefined>;
  rowKey: (row: T, i: number) => string;
  extraFilters?: ReactNode;
  description?: ReactNode;
}) {
  const init = withDateRange ? defaultRange() : { date_from: '', date_to: '' };
  const [from, setFrom] = useState(init.date_from);
  const [to, setTo] = useState(init.date_to);

  const params = new URLSearchParams();
  if (withDateRange) {
    if (from) params.set('date_from', toIso(from)!);
    if (to) params.set('date_to', toIso(to)!);
  }
  for (const [k, v] of Object.entries(extraParams)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  const fullPath = qs ? `${endpoint}?${qs}` : endpoint;

  const { data, isLoading } = useQuery({
    queryKey: ['report', endpoint, qs],
    queryFn: () => api<T[]>(fullPath),
  });

  const csvUrl = `${API_BASE}${fullPath}${qs ? '&' : '?'}format=csv`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-surface-500">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {withDateRange && (
            <>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-sm text-surface-400">to</span>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          {extraFilters}
          <a className="btn btn-ghost" href={csvUrl} target="_blank" rel="noreferrer">Download CSV</a>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-head">
              {columns.map((c, i) => (
                <th key={i} className={'px-3 py-2 ' + (c.align === 'right' ? 'text-right' : 'text-left')}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={columns.length} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.map((row, i) => (
              <tr key={rowKey(row, i)} className="table-row">
                {columns.map((c, j) => (
                  <td key={j} className={'px-3 py-2 ' + (c.align === 'right' ? 'text-right font-mono' : '') + ' ' + (c.className ?? '')}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-4 text-surface-500">No data.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.length > 0 && (
        <div className="text-right text-sm text-surface-500">{data.length} row{data.length === 1 ? '' : 's'}</div>
      )}
    </div>
  );
}
