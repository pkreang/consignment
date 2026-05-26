"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/modal';

type Group = { group_id: string; group_name: string };
type Page<T> = { data: T[]; total: number };

export default function CustomerGroupsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Group | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['customer-groups', page],
    queryFn: () => api<Page<Group>>(`/customer-groups?pageSize=20&page=${page}`),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/customer-groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-groups'] }),
    onError: (e) => alert(e instanceof ApiError ? e.message : 'Failed'),
  });
  const onSaved = () => { qc.invalidateQueries({ queryKey: ['customer-groups'] }); qc.invalidateQueries({ queryKey: ['lookup', 'customer-groups'] }); setEditing(null); setCreating(false); };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customer Groups</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>New Group</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="table-head"><th className="px-3 py-2">Name</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={2} className="px-3 py-4 text-surface-500">Loading…</td></tr>}
            {data?.data.map((g) => (
              <tr key={g.group_id} className="table-row">
                <td className="px-3 py-2 font-medium">{g.group_name}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button className="btn btn-ghost px-2 py-1" onClick={() => setEditing(g)}>Edit</button>
                  <button className="btn btn-ghost px-2 py-1 text-rose-600" onClick={() => { if (confirm(`Delete ${g.group_name}?`)) del.mutate(g.group_id); }}>Delete</button>
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={2} className="px-3 py-4 text-surface-500">No groups.</td></tr>}
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
      {(creating || editing) && (
        <GroupForm group={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={onSaved} />
      )}
    </div>
  );
}

function GroupForm({ group, onClose, onSaved }: { group: Group | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(group?.group_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      group
        ? api(`/customer-groups/${group.group_id}`, { method: 'PUT', body: JSON.stringify({ group_name: name }) })
        : api('/customer-groups', { method: 'POST', body: JSON.stringify({ group_name: name }) }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <Modal title={group ? 'Edit Group' : 'New Group'} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) { setError('Name required'); return; } m.mutate(); }}>
        <div><label className="label">Group name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
