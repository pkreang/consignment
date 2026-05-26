"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/modal';
import { useEmployees, useRoles } from '@/lib/lookups';

type User = {
  user_id: string;
  username: string;
  full_name: string | null;
  role: { role_id: string; role_name: string } | null;
  employee: { employee_name: string } | null;
  active_flag: boolean;
};
type Page<T> = { data: T[]; total: number };

export default function UsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [pwUser, setPwUser] = useState<User | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['users', q, page],
    queryFn: () => api<Page<User>>(`/users?pageSize=20&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Failed'),
  });
  const onSaved = () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditing(null); setCreating(false); setPwUser(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <div className="flex items-center gap-2">
          <input className="input max-w-xs" placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <button className="btn btn-primary" onClick={() => setCreating(true)}>New User</button>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-head"><th className="px-3 py-2">Username</th><th className="px-3 py-2">Full name</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Active</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.data.map((u) => (
              <tr key={u.user_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">{u.username}</td>
                <td className="px-3 py-2 font-medium">{u.full_name ?? '—'}</td>
                <td className="px-3 py-2 text-sm">{u.role?.role_name ?? '—'}</td>
                <td className="px-3 py-2 text-sm">{u.employee?.employee_name ?? '—'}</td>
                <td className="px-3 py-2"><span className={'pill ' + (u.active_flag ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-200 text-surface-700')}>{u.active_flag ? 'Active' : 'Inactive'}</span></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button className="btn btn-ghost px-2 py-1" onClick={() => setEditing(u)}>Edit</button>
                  <button className="btn btn-ghost px-2 py-1" onClick={() => setPwUser(u)}>Password</button>
                  <button className="btn btn-ghost px-2 py-1 text-rose-600" onClick={() => { if (confirm(`Delete ${u.username}?`)) del.mutate(u.user_id); }}>Delete</button>
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-surface-500">No users.</td></tr>}
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
      {(creating || editing) && <UserForm user={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={onSaved} />}
      {pwUser && <PasswordDialog user={pwUser} onClose={() => setPwUser(null)} onDone={onSaved} />}
    </div>
  );
}

function UserForm({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const employees = useEmployees();
  const roles = useRoles();
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [roleId, setRoleId] = useState(user?.role?.role_id ?? '');
  const [employeeId, setEmployeeId] = useState('');
  const [active, setActive] = useState(user?.active_flag ?? true);
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => {
      if (user) {
        return api(`/users/${user.user_id}`, {
          method: 'PUT',
          body: JSON.stringify({
            full_name: fullName || undefined,
            employee_id: employeeId || undefined,
            role_id: roleId || undefined,
            active_flag: active,
          }),
        });
      }
      return api('/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          full_name: fullName || undefined,
          employee_id: employeeId || undefined,
          role_id: roleId || undefined,
          active_flag: active,
        }),
      });
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <Modal title={user ? `Edit ${user.username}` : 'New User'} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (!user && (!username.trim() || password.length < 8)) { setError('Username and password (≥8 chars) required'); return; }
        m.mutate();
      }}>
        {!user && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Username</label><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            <div><label className="label">Password (≥8)</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          </div>
        )}
        <div><label className="label">Full name</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Role</label>
            <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">— select —</option>
              {roles.data?.map((r) => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Employee</label>
            <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">— none —</option>
              {employees.data?.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.employee_code} — {e.employee_name}</option>)}
            </select>
          </div>
        </div>
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

function PasswordDialog({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api(`/users/${user.user_id}/password`, { method: 'PUT', body: JSON.stringify({ password: pw }) }),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <Modal title={`Change password — ${user.username}`} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (pw.length < 8) { setError('Password ≥8 chars'); return; } m.mutate(); }}>
        <div><label className="label">New password</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Set password'}</button>
        </div>
      </form>
    </Modal>
  );
}
