"use client";

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

type ProvidersResp = { providers: Array<{ name: string; enabled: boolean; dryRun?: boolean }> };

export default function NotificationsPage() {
  const providers = useQuery({ queryKey: ['providers'], queryFn: () => api<ProvidersResp>('/notifications/providers') });
  const [title, setTitle] = useState('test notification');
  const [body, setBody] = useState('hello from consignment-erp');
  const [severity, setSeverity] = useState<'info' | 'warn' | 'critical'>('info');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const testM = useMutation({
    mutationFn: () => api('/notifications/test', { method: 'POST', body: JSON.stringify({ title, body, severity }) }),
    onSuccess: () => setTestMsg('✓ Sent (check provider/log).'),
    onError: (e) => setTestMsg('✗ ' + (e instanceof ApiError ? e.message : 'failed')),
  });
  const scanM = useMutation({
    mutationFn: () => api<{ scanned: number; notified: number }>('/notifications/ar-overdue-scan', { method: 'POST' }),
    onSuccess: (r) => setScanMsg(`✓ Scanned ${r.scanned} overdue invoice(s), notified ${r.notified} customer(s).`),
    onError: (e) => setScanMsg('✗ ' + (e instanceof ApiError ? e.message : 'failed')),
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Notifications</h1>

      <section className="card p-4">
        <h2 className="mb-3 text-lg font-medium">Configured providers</h2>
        {!providers.data && <div className="text-sm text-slate-500">Loading…</div>}
        {providers.data && providers.data.providers.length === 0 && (
          <div className="text-sm text-slate-500">No providers configured. Set <code className="font-mono text-xs">NOTIFY_WEBHOOK_URL</code> or <code className="font-mono text-xs">LINE_NOTIFY_TOKEN</code> in backend env.</div>
        )}
        {providers.data && (
          <ul className="divide-y text-sm">
            {providers.data.providers.map((p) => (
              <li key={p.name} className="flex items-center justify-between py-2">
                <span className="font-mono">{p.name}</span>
                <span className="flex items-center gap-2 text-xs">
                  {p.dryRun && <span className="pill bg-amber-100 text-amber-800">dry-run</span>}
                  <span className={'pill ' + (p.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700')}>{p.enabled ? 'enabled' : 'disabled'}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-medium">Send test</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div>
            <label className="label">Severity</label>
            <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as never)}>
              <option value="info">info</option><option value="warn">warn</option><option value="critical">critical</option>
            </select>
          </div>
        </div>
        <div><label className="label">Body</label><textarea rows={3} className="input" value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="flex justify-end gap-3">
          {testMsg && <div className={'text-sm ' + (testMsg.startsWith('✓') ? 'text-emerald-700' : 'text-rose-700')}>{testMsg}</div>}
          <button className="btn btn-primary" disabled={testM.isPending} onClick={() => testM.mutate()}>{testM.isPending ? 'Sending…' : 'Send test'}</button>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-medium">AR Overdue Scan</h2>
        <p className="text-sm text-slate-500">Scan all open AR invoices that are past their due date and dispatch a grouped alert per customer. Read-only — does not mutate anything.</p>
        <div className="flex justify-end gap-3">
          {scanMsg && <div className={'text-sm ' + (scanMsg.startsWith('✓') ? 'text-emerald-700' : 'text-rose-700')}>{scanMsg}</div>}
          <button className="btn btn-primary" disabled={scanM.isPending} onClick={() => scanM.mutate()}>{scanM.isPending ? 'Scanning…' : 'Run overdue scan'}</button>
        </div>
      </section>
    </div>
  );
}
