"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/modal';
import { useCustomers, useRoutes } from '@/lib/lookups';

type Assignment = {
  customer_route_id: string;
  customer: { customer_id: string; customer_code: string; customer_name: string };
  route: { route_id: string; route_code: string; route_name: string };
  visit_day: string | null;
};
type Page<T> = { data: T[]; total: number };

export default function CustomerRoutesPage() {
  const qc = useQueryClient();
  const routes = useRoutes();
  const [routeId, setRouteId] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['customer-routes', routeId, page],
    queryFn: () => {
      const p = new URLSearchParams({ pageSize: '20', page: String(page) });
      if (routeId) p.set('route_id', routeId);
      return api<Page<Assignment>>(`/customer-routes?${p.toString()}`);
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/customer-routes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-routes'] }),
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customer Route Assignments</h1>
        <div className="flex items-center gap-2">
          <select className="input max-w-[260px]" value={routeId} onChange={(e) => { setRouteId(e.target.value); setPage(1); }}>
            <option value="">All routes</option>
            {routes.data?.map((r) => <option key={r.route_id} value={r.route_id}>{r.route_code} — {r.route_name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>Assign</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-head">
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Route</th>
            <th className="px-3 py-2">Visit day</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.data.map((a) => (
              <tr key={a.customer_route_id} className="table-row">
                <td className="px-3 py-2"><div>{a.customer?.customer_name}</div><div className="font-mono text-xs text-surface-500">{a.customer?.customer_code}</div></td>
                <td className="px-3 py-2"><div>{a.route?.route_name}</div><div className="font-mono text-xs text-surface-500">{a.route?.route_code}</div></td>
                <td className="px-3 py-2 text-xs">{a.visit_day ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button className="btn btn-ghost px-2 py-1 text-rose-600 dark:text-rose-400" onClick={() => { if (confirm('Remove assignment?')) del.mutate(a.customer_route_id); }}>Remove</button>
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-surface-500">No assignments.</td></tr>}
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

      {creating && <AssignDialog onClose={() => setCreating(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['customer-routes'] }); setCreating(false); }} />}
    </div>
  );
}

function AssignDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const customers = useCustomers();
  const routes = useRoutes();
  const [customerId, setCustomerId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [visitDay, setVisitDay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      api('/customer-routes', {
        method: 'POST',
        body: JSON.stringify({ customer_id: customerId, route_id: routeId, visit_day: visitDay || undefined }),
      }),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <Modal title="Assign customer to route" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!customerId || !routeId) { setError('Both required'); return; } m.mutate(); }}>
        <div><label className="label">Customer</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— select —</option>
            {customers.data?.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.customer_code} — {c.customer_name}</option>)}
          </select>
        </div>
        <div><label className="label">Route</label>
          <select className="input" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">— select —</option>
            {routes.data?.map((r) => <option key={r.route_id} value={r.route_id}>{r.route_code} — {r.route_name}</option>)}
          </select>
        </div>
        <div><label className="label">Visit day (optional)</label>
          <select className="input" value={visitDay} onChange={(e) => setVisitDay(e.target.value)}>
            <option value="">—</option>
            <option>MON</option><option>TUE</option><option>WED</option><option>THU</option><option>FRI</option><option>SAT</option><option>SUN</option>
          </select>
        </div>
        {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Assign'}</button>
        </div>
      </form>
    </Modal>
  );
}
