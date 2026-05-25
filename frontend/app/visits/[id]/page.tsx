"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { fmtDate, fmtMoney, pillForStatus } from '@/lib/format';
import { useWarehouses } from '@/lib/lookups';
import { Modal } from '@/components/modal';

type VisitItem = {
  visit_item_id: string;
  product_id: string;
  product: { sku_code: string; product_name: string };
  qty_before: string;
  qty_counted: string;
  qty_sold: string;
  qty_replenished: string;
  unit_price: string;
  sales_amount: string;
};
type VisitDetail = {
  visit_id: string;
  visit_no: string;
  visit_status: 'DRAFT' | 'CHECKED_IN' | 'COUNTED' | 'CONFIRMED' | 'CANCELLED';
  visit_date: string;
  total_sales_amount: string;
  customer: { customer_id: string; customer_code: string; customer_name: string; credit_term_days: number };
  employee: { employee_name: string };
  items: VisitItem[];
  collections?: Array<{ collection_no: string; amount_collected: string; payment_method: string }>;
  arInvoices?: Array<{ ar_invoice_id: string; invoice_no: string; total_amount: string; status: string }>;
};

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? '') + '/api/v1'
    : '/api/v1';

export default function VisitDetailPage() {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['visit', params.id],
    queryFn: () => api<VisitDetail>(`/sales-visits/${params.id}`),
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['visit', params.id] });

  if (!data) return <div className="card p-6">Loading…</div>;
  const isDraft = data.visit_status === 'DRAFT';
  const canConfirm = data.visit_status === 'CHECKED_IN' || data.visit_status === 'COUNTED';
  const canRecord = canConfirm || isDraft;
  const canCheckout = data.visit_status === 'CONFIRMED';
  const canCancel = data.visit_status !== 'CONFIRMED' && data.visit_status !== 'CANCELLED';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">Visit {data.visit_no}</h1>
          <span className={`pill ${pillForStatus(data.visit_status)}`}>{data.visit_status}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a className="btn btn-ghost" href={`${API_BASE}/sales-visits/${data.visit_id}/receipt.pdf`} target="_blank" rel="noreferrer">
            Download PDF
          </a>
          {isDraft && (<button className="btn btn-ghost" onClick={() => setShowCheckin(true)}>Check in</button>)}
          {canRecord && (<button className="btn btn-ghost" onClick={() => setShowItems(true)}>Record items</button>)}
          {canConfirm && (<button className="btn btn-primary" onClick={() => setShowConfirm(true)}>Confirm visit</button>)}
          {canCheckout && (<button className="btn btn-ghost" onClick={() => setShowCheckout(true)}>Check out</button>)}
          {canCancel && (<button className="btn btn-ghost text-rose-600" onClick={() => setShowCancel(true)}>Cancel</button>)}
        </div>
      </div>

      <div className="card grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
        <Field label="Customer">{data.customer?.customer_name}</Field>
        <Field label="Sales rep">{data.employee?.employee_name}</Field>
        <Field label="Visit date">{fmtDate(data.visit_date)}</Field>
        <Field label="Total sales">{fmtMoney(data.total_sales_amount)} THB</Field>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Items</h2>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-head">
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Before</th>
                <th className="px-3 py-2 text-right">Counted</th>
                <th className="px-3 py-2 text-right">Sold</th>
                <th className="px-3 py-2 text-right">Replenished</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Sales</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.visit_item_id} className="table-row">
                  <td className="px-3 py-2 font-mono text-xs">{it.product?.sku_code}</td>
                  <td className="px-3 py-2">{it.product?.product_name}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.qty_before)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.qty_counted)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.qty_sold)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.qty_replenished)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.unit_price)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.sales_amount)}</td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-4 text-slate-500">No items recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!!data.collections?.length && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Collections</h2>
          <ul className="card divide-y text-sm">
            {data.collections.map((c) => (
              <li key={c.collection_no} className="flex items-center justify-between px-4 py-2">
                <span className="font-mono text-xs text-slate-500">{c.collection_no}</span>
                <span className="font-medium">{fmtMoney(c.amount_collected)} THB</span>
                <span className="text-xs text-slate-500">{c.payment_method}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!data.arInvoices?.length && (
        <section>
          <h2 className="mb-2 text-lg font-medium">AR Invoices</h2>
          <ul className="card divide-y text-sm">
            {data.arInvoices.map((inv) => (
              <li key={inv.invoice_no} className="flex items-center justify-between px-4 py-2">
                <span className="font-mono text-xs text-slate-500">{inv.invoice_no}</span>
                <span className="font-medium">{fmtMoney(inv.total_amount)} THB</span>
                <span className="flex items-center gap-3">
                  <a className="text-xs text-brand-600 hover:underline" href={`${API_BASE}/ar/invoices/${inv.ar_invoice_id}/pdf`} target="_blank" rel="noreferrer">PDF</a>
                  <span className={`pill ${pillForStatus(inv.status)}`}>{inv.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showItems && <RecordItemsDialog visit={data} onClose={() => setShowItems(false)} onDone={refresh} />}
      {showConfirm && <ConfirmDialog visit={data} onClose={() => setShowConfirm(false)} onDone={refresh} />}
      {showCheckin && <CheckinDialog visit={data} onClose={() => setShowCheckin(false)} onDone={refresh} />}
      {showCheckout && <CheckoutDialog visit={data} onClose={() => setShowCheckout(false)} onDone={refresh} />}
      {showCancel && <CancelDialog visit={data} onClose={() => setShowCancel(false)} onDone={refresh} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}

function CheckinDialog({ visit, onClose, onDone }: { visit: VisitDetail; onClose: () => void; onDone: () => void }) {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      api(`/sales-visits/${visit.visit_id}/checkin`, {
        method: 'POST',
        body: JSON.stringify({
          gps_latitude: lat || undefined,
          gps_longitude: lon || undefined,
          photo_url: photoUrl || undefined,
        }),
      }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  const useGeo = () => {
    if (!navigator.geolocation) { setError('Geolocation not available'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(String(pos.coords.latitude)); setLon(String(pos.coords.longitude)); },
      (err) => setError(err.message),
    );
  };

  return (
    <Modal title={`Check in — ${visit.visit_no}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Latitude</label><input className="input font-mono" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
          <div><label className="label">Longitude</label><input className="input font-mono" value={lon} onChange={(e) => setLon(e.target.value)} /></div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={useGeo}>Use browser location</button>
        <div><label className="label">Photo URL</label><input className="input" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." /></div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Checking in…' : 'Check in'}</button>
        </div>
      </div>
    </Modal>
  );
}

function CheckoutDialog({ visit, onClose, onDone }: { visit: VisitDetail; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      api(`/sales-visits/${visit.visit_id}/checkout`, {
        method: 'POST',
        body: JSON.stringify({ note: note || undefined }),
      }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Modal title={`Check out — ${visit.visit_no}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div><label className="label">Note</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Working…' : 'Check out'}</button>
        </div>
      </div>
    </Modal>
  );
}

function CancelDialog({ visit, onClose, onDone }: { visit: VisitDetail; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      api(`/sales-visits/${visit.visit_id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || undefined }),
      }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Modal title={`Cancel visit ${visit.visit_no}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-rose-700">This will mark the visit as CANCELLED. No stock or AR changes are written.</p>
        <div><label className="label">Reason</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>Keep</button>
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Working…' : 'Cancel visit'}</button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmDialog({ visit, onClose, onDone }: { visit: VisitDetail; onClose: () => void; onDone: () => void }) {
  const isCod = visit.customer.credit_term_days === 0;
  const warehouses = useWarehouses();
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'QR_PAYMENT' | 'OTHER'>('CASH');
  const [amount, setAmount] = useState(isCod ? visit.total_sales_amount : '0');
  const [reference, setReference] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [overrideCredit, setOverrideCredit] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hasReplenish = visit.items.some((it) => Number(it.qty_replenished) > 0);

  const m = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (hasReplenish) {
        if (!warehouseId) throw new Error('warehouse_id is required when replenishing');
        body.warehouse_id = warehouseId;
      }
      if (Number(amount) > 0 || isCod) {
        body.payment_method = paymentMethod;
        body.amount_collected = amount;
        if (reference) body.reference_no = reference;
      }
      if (overrideCredit) {
        body.override_credit = true;
        body.override_reason = overrideReason || undefined;
      }
      const idemKey = `confirm-${visit.visit_id}-${Date.now()}`;
      return api(`/sales-visits/${visit.visit_id}/confirm`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idemKey },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => { onDone(); onClose(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Modal title={`Confirm visit ${visit.visit_no}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">
          Total sales: <span className="font-medium">{fmtMoney(visit.total_sales_amount)} THB</span>
          {isCod && <span className="ml-2 text-xs text-amber-600">COD — full payment required</span>}
        </p>
        {hasReplenish && (
          <div>
            <label className="label">Warehouse for replenishment</label>
            <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">— select —</option>
              {warehouses.data?.map((w) => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_code} — {w.warehouse_name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Payment method</label>
          <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as never)}>
            <option>CASH</option>
            <option>BANK_TRANSFER</option>
            <option>QR_PAYMENT</option>
            <option>OTHER</option>
          </select>
        </div>
        <div><label className="label">Amount collected</label><input type="text" inputMode="decimal" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="label">Reference</label><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={overrideCredit} onChange={(e) => setOverrideCredit(e.target.checked)} />
          Override credit limit (needs <code className="font-mono text-xs">credit.override</code>)
        </label>
        {overrideCredit && (
          <input className="input" placeholder="Override reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
        )}
        {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Working…' : 'Confirm'}</button>
        </div>
      </div>
    </Modal>
  );
}

function RecordItemsDialog({ visit, onClose, onDone }: { visit: VisitDetail; onClose: () => void; onDone: () => void }) {
  const [items, setItems] = useState(() =>
    visit.items.map((it) => ({
      product_id: it.product_id,
      sku: it.product.sku_code,
      qty_counted: it.qty_counted,
      qty_replenished: it.qty_replenished,
      unit_price: it.unit_price,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      api(`/sales-visits/${visit.visit_id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((it) => ({
            product_id: it.product_id,
            qty_counted: it.qty_counted,
            qty_replenished: it.qty_replenished || '0',
            unit_price: it.unit_price,
          })),
        }),
      }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  if (items.length === 0) {
    return (
      <Modal title={`Record items — ${visit.visit_no}`} onClose={onClose}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-500">No products in consignment yet. Load stock to the customer first via Operations → Load to Customer.</p>
          <div className="flex justify-end pt-2">
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Record items — ${visit.visit_no}`} onClose={onClose}>
      <div className="space-y-3">
        <table className="w-full text-sm">
          <thead><tr className="table-head">
            <th className="py-1 text-left">SKU</th>
            <th className="py-1 text-right">Counted</th>
            <th className="py-1 text-right">Replenish</th>
            <th className="py-1 text-right">Price</th>
          </tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.product_id}>
                <td className="py-1 font-mono text-xs">{it.sku}</td>
                <td className="py-1 text-right">
                  <input className="input w-24 text-right font-mono" value={it.qty_counted} onChange={(e) => setItems((arr) => arr.map((x, j) => j === i ? { ...x, qty_counted: e.target.value } : x))} />
                </td>
                <td className="py-1 text-right">
                  <input className="input w-24 text-right font-mono" value={it.qty_replenished} onChange={(e) => setItems((arr) => arr.map((x, j) => j === i ? { ...x, qty_replenished: e.target.value } : x))} />
                </td>
                <td className="py-1 text-right">
                  <input className="input w-24 text-right font-mono" value={it.unit_price} onChange={(e) => setItems((arr) => arr.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Saving…' : 'Save items'}</button>
        </div>
      </div>
    </Modal>
  );
}
