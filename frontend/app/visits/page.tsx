"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { fmtDate, fmtMoney, pillForStatus } from '@/lib/format';
import { useCustomers, useEmployees, useRoutes } from '@/lib/lookups';
import { Modal } from '@/components/modal';

type Visit = {
  visit_id: string;
  visit_no: string;
  visit_status: string;
  visit_date: string;
  total_sales_amount: string;
  customer: { customer_code: string; customer_name: string };
  employee: { employee_name: string };
};
type Page<T> = { data: T[]; total: number };

export default function VisitsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['visits', status, page],
    queryFn: () =>
      api<Page<Visit>>(
        `/sales-visits?pageSize=20&page=${page}${status ? `&status=${status}` : ''}`,
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Sales Visits</h1>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="input sm:max-w-[180px]"
          >
            <option value="">All statuses</option>
            <option>DRAFT</option>
            <option>CHECKED_IN</option>
            <option>COUNTED</option>
            <option>CONFIRMED</option>
            <option>CANCELLED</option>
          </select>
          <button className="btn btn-primary whitespace-nowrap" onClick={() => setCreating(true)}>New visit</button>
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        {isLoading && <div className="card p-4 text-sm text-surface-500">Loading…</div>}
        {data?.data.map((v) => (
          <Link key={v.visit_id} href={`/visits/${v.visit_id}`} className="card block space-y-2 p-4 transition hover:border-brand-300 dark:hover:border-brand-500/50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-xs text-brand-600 dark:text-brand-400">{v.visit_no}</div>
                <div className="font-medium">{v.customer?.customer_name}</div>
                <div className="text-xs text-surface-500">{v.customer?.customer_code}</div>
              </div>
              <span className={`pill ${pillForStatus(v.visit_status)}`}>{v.visit_status}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-surface-600 dark:text-surface-400">
              <div>
                <div className="text-surface-500">{fmtDate(v.visit_date)}</div>
                <div>{v.employee?.employee_name}</div>
              </div>
              <div className="text-right">
                <div className="text-surface-500">Sales</div>
                <div className="font-mono">{fmtMoney(v.total_sales_amount)}</div>
              </div>
            </div>
          </Link>
        ))}
        {data && data.data.length === 0 && (
          <div className="card p-4 text-center text-sm text-surface-500">No visits found</div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="table-head">
              <th className="px-3 py-2">Visit #</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Sales rep</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Sales</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-3 py-4 text-sm text-surface-500">Loading…</td></tr>
            )}
            {data?.data.map((v) => (
              <tr key={v.visit_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/visits/${v.visit_id}`} className="text-brand-600 dark:text-brand-400 hover:underline">{v.visit_no}</Link>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{v.customer?.customer_name}</div>
                  <div className="text-xs text-surface-500">{v.customer?.customer_code}</div>
                </td>
                <td className="px-3 py-2">{v.employee?.employee_name}</td>
                <td className="px-3 py-2">{fmtDate(v.visit_date)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(v.total_sales_amount)}</td>
                <td className="px-3 py-2"><span className={`pill ${pillForStatus(v.visit_status)}`}>{v.visit_status}</span></td>
              </tr>
            ))}
            {data && data.data.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-surface-500">No visits found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-surface-500">
          <div>Total: {data.total.toLocaleString()} • Page {page}</div>
          <div className="flex gap-1">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <button className="btn btn-ghost" disabled={data.data.length < 20} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {creating && <CreateVisitDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateVisitDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const customers = useCustomers();
  const employees = useEmployees();
  const routes = useRoutes();
  const [customerId, setCustomerId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      api<{ visit_id: string }>('/sales-visits', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          employee_id: employeeId || undefined,
          route_id: routeId || undefined,
          note: note || undefined,
        }),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['visits'] });
      router.push(`/visits/${res.visit_id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerId) { setError('Customer is required'); return; }
    m.mutate();
  };

  return (
    <Modal title="New Sales Visit" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label">Customer</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— select —</option>
            {customers.data?.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.customer_code} — {c.customer_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Sales rep</label>
            <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">— current user —</option>
              {employees.data?.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.employee_code} — {e.employee_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Route</label>
            <select className="input" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              <option value="">— optional —</option>
              {routes.data?.map((r) => <option key={r.route_id} value={r.route_id}>{r.route_code} — {r.route_name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Note</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Creating…' : 'Create & open'}</button>
        </div>
      </form>
    </Modal>
  );
}
