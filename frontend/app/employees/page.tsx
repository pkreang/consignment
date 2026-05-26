"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/modal';

type Employee = { employee_id: string; employee_code: string; employee_name: string; mobile_no: string | null; active_flag: boolean };
type Page<T> = { data: T[]; total: number };

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['employees', q, page],
    queryFn: () => api<Page<Employee>>(`/employees?pageSize=20&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Failed'),
  });
  const onSaved = () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['lookup', 'employees'] }); setEditing(null); setCreating(false); };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <div className="flex items-center gap-2">
          <input className="input max-w-xs" placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <button className="btn btn-primary" onClick={() => setCreating(true)}>New Employee</button>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-head"><th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Mobile</th><th className="px-3 py-2">Active</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.data.map((e) => (
              <tr key={e.employee_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{e.employee_code}</td>
                <td className="px-3 py-2 font-medium">{e.employee_name}</td>
                <td className="px-3 py-2 text-xs">{e.mobile_no ?? '—'}</td>
                <td className="px-3 py-2"><span className={'pill ' + (e.active_flag ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-200 text-surface-700')}>{e.active_flag ? 'Active' : 'Inactive'}</span></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button className="btn btn-ghost px-2 py-1" onClick={() => setEditing(e)}>Edit</button>
                  <button className="btn btn-ghost px-2 py-1 text-rose-600" onClick={() => { if (confirm(`Delete ${e.employee_name}?`)) del.mutate(e.employee_id); }}>Delete</button>
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-surface-500">No employees.</td></tr>}
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
      {(creating || editing) && <EmployeeForm employee={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={onSaved} />}
    </div>
  );
}

function EmployeeForm({ employee, onClose, onSaved }: { employee: Employee | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(employee?.employee_code ?? '');
  const [name, setName] = useState(employee?.employee_name ?? '');
  const [mobile, setMobile] = useState(employee?.mobile_no ?? '');
  const [active, setActive] = useState(employee?.active_flag ?? true);
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ employee_code: code, employee_name: name, mobile_no: mobile || undefined, active_flag: active });
      return employee
        ? api(`/employees/${employee.employee_id}`, { method: 'PUT', body })
        : api('/employees', { method: 'POST', body });
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <Modal title={employee ? 'Edit Employee' : 'New Employee'} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!code.trim() || !name.trim()) { setError('Code & name required'); return; } m.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Code</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        <div><label className="label">Mobile</label><input className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
