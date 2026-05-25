"use client";

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Kind = 'products' | 'customers';
type ImportSuccess = { ok: true; total: number; created: number; updated: number };
type ImportError = { ok: false; total: number; errors: Array<{ line: number; error: string }> };

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? '') + '/api/v1'
    : '/api/v1';

export default function ImportsPage() {
  const [kind, setKind] = useState<Kind>('products');
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<ImportSuccess | null>(null);
  const [errs, setErrs] = useState<ImportError | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => api<ImportSuccess>(`/imports/${kind}`, { method: 'POST', body: JSON.stringify({ csv }) }),
    onSuccess: (r) => { setResult(r); setErrs(null); setErrorMsg(null); },
    onError: (e) => {
      setResult(null);
      if (e instanceof ApiError && e.body && typeof e.body === 'object' && 'errors' in e.body) {
        setErrs(e.body as ImportError);
        setErrorMsg(null);
      } else {
        setErrs(null);
        setErrorMsg(e instanceof ApiError ? e.message : 'Failed');
      }
    },
  });

  const onFile = async (file: File) => setCsv(await file.text());

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">CSV Bulk Import</h1>

      <div className="flex gap-1 border-b border-slate-200 text-sm">
        {(['products', 'customers'] as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => { setKind(k); setResult(null); setErrs(null); setErrorMsg(null); }}
            className={
              'border-b-2 px-3 py-2 capitalize ' +
              (kind === k ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')
            }
          >
            {k}
          </button>
        ))}
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">Upload a CSV file or paste CSV content. Rows are upserted by natural key inside one transaction.</div>
          <a className="btn btn-ghost" href={`${API_BASE}/imports/${kind}/sample.csv`} target="_blank" rel="noreferrer">Download template</a>
        </div>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          className="text-sm"
        />
        <textarea
          rows={10}
          className="input font-mono text-xs"
          placeholder="Or paste CSV here (first row = header)"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={m.isPending || !csv.trim()} onClick={() => m.mutate()}>
            {m.isPending ? 'Importing…' : `Import ${kind}`}
          </button>
        </div>

        {errorMsg && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMsg}</div>}

        {result && (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            ✓ {result.total} row(s) processed — {result.created} created, {result.updated} updated.
          </div>
        )}

        {errs && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
            <div className="mb-1 text-sm font-medium text-rose-700">{errs.errors.length} row error(s) — nothing imported:</div>
            <ul className="space-y-1 text-xs text-rose-800">
              {errs.errors.map((e) => <li key={e.line}>Row {e.line}: {e.error}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
