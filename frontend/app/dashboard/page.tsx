"use client";

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, isAuthed } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

type Dashboard = {
  today_sales?: string;
  today_collection?: string;
  open_visits?: number;
  outstanding_ar?: string;
  consignment_value?: string;
  [key: string]: unknown;
};

export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => {
    if (!isAuthed()) router.replace('/login');
  }, [router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/reports/dashboard'),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {isLoading && <div className="card p-6">Loading…</div>}
      {error && (
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load dashboard ({(error as Error).message})
        </div>
      )}
      {data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Today's sales" value={fmtMoney(data.today_sales as string)} suffix="THB" />
          <Kpi
            label="Today's collection"
            value={fmtMoney(data.today_collection as string)}
            suffix="THB"
          />
          <Kpi
            label="Open visits"
            value={String((data.open_visits as number | undefined) ?? '—')}
          />
          <Kpi
            label="Outstanding AR"
            value={fmtMoney(data.outstanding_ar as string)}
            suffix="THB"
          />
          <Kpi
            label="Consignment value"
            value={fmtMoney(data.consignment_value as string)}
            suffix="THB"
          />
        </div>
      )}
      <details className="card p-4 text-sm">
        <summary className="cursor-pointer text-slate-500">Raw payload</summary>
        <pre className="mt-3 overflow-x-auto text-xs">
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Kpi({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}
