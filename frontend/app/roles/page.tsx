"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/modal';

type Role = {
  role_id: string;
  role_name: string;
  permissions?: Array<{ permission_id: string; permission_code: string; description: string | null; module_name: string | null }>;
};
type Permission = { permission_id: string; permission_code: string; description: string | null; module_name: string | null };
type Page<T> = { data: T[]; total: number };

export default function RolesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<Page<Role>>('/roles?pageSize=200'),
  });
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [permEditing, setPermEditing] = useState<Role | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => api(`/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Failed'),
  });
  const onSaved = () => { qc.invalidateQueries({ queryKey: ['roles'] }); qc.invalidateQueries({ queryKey: ['lookup', 'roles'] }); setEditing(null); setCreating(false); setPermEditing(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Roles & Permissions</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>New Role</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-head"><th className="px-3 py-2">Role</th><th className="px-3 py-2">Permissions</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={3} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.data.map((r) => (
              <tr key={r.role_id} className="table-row">
                <td className="px-3 py-2 font-medium">{r.role_name}</td>
                <td className="px-3 py-2 text-xs text-surface-500">{r.permissions?.length ?? 0} permission(s)</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button className="btn btn-ghost px-2 py-1" onClick={() => setEditing(r)}>Rename</button>
                  <button className="btn btn-ghost px-2 py-1" onClick={() => setPermEditing(r)}>Permissions</button>
                  <button className="btn btn-ghost px-2 py-1 text-rose-600" onClick={() => { if (confirm(`Delete ${r.role_name}?`)) del.mutate(r.role_id); }}>Delete</button>
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-surface-500">No roles.</td></tr>}
          </tbody>
        </table>
      </div>
      {(creating || editing) && <RoleForm role={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={onSaved} />}
      {permEditing && <PermissionEditor role={permEditing} onClose={() => setPermEditing(null)} onSaved={onSaved} />}
    </div>
  );
}

function RoleForm({ role, onClose, onSaved }: { role: Role | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(role?.role_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      role ? api(`/roles/${role.role_id}`, { method: 'PUT', body: JSON.stringify({ role_name: name }) })
           : api('/roles', { method: 'POST', body: JSON.stringify({ role_name: name }) }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <Modal title={role ? `Rename ${role.role_name}` : 'New Role'} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) { setError('Name required'); return; } m.mutate(); }}>
        <div><label className="label">Role name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function PermissionEditor({ role, onClose, onSaved }: { role: Role; onClose: () => void; onSaved: () => void }) {
  const allPerms = useQuery({
    queryKey: ['permissions-all'],
    queryFn: () => api<Page<Permission>>('/permissions?pageSize=500'),
    staleTime: 60_000,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (role.permissions) setSelected(new Set(role.permissions.map((p) => p.permission_id)));
  }, [role]);

  const m = useMutation({
    mutationFn: () =>
      api(`/roles/${role.role_id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permission_ids: Array.from(selected) }),
      }),
    onSuccess: onSaved,
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Failed'),
  });

  // group by module
  const grouped = new Map<string, Permission[]>();
  for (const p of allPerms.data?.data ?? []) {
    const k = p.module_name ?? 'other';
    const arr = grouped.get(k) ?? [];
    arr.push(p);
    grouped.set(k, arr);
  }

  return (
    <Modal title={`Permissions — ${role.role_name}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        {!allPerms.data && <div className="text-surface-500">Loading…</div>}
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {Array.from(grouped.entries()).map(([mod, perms]) => (
            <div key={mod}>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-surface-500">{mod}</div>
              <div className="grid grid-cols-2 gap-1">
                {perms.map((p) => (
                  <label key={p.permission_id} className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-surface-50">
                    <input
                      type="checkbox"
                      checked={selected.has(p.permission_id)}
                      onChange={(e) => {
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(p.permission_id); else next.delete(p.permission_id);
                          return next;
                        });
                      }}
                    />
                    <span><span className="font-mono text-xs">{p.permission_code}</span>{p.description && <div className="text-xs text-surface-500">{p.description}</div>}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Saving…' : 'Save permissions'}</button>
        </div>
      </div>
    </Modal>
  );
}
