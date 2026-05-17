"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney, pillForStatus } from '@/lib/format';
import { useErrorMessage } from '@/lib/use-error-message';

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
  const t = useTranslations('visits');
  const tc = useTranslations('common');
  const { data } = useQuery({
    queryKey: ['visit', params.id],
    queryFn: () => api<VisitDetail>(`/sales-visits/${params.id}`),
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [showItems, setShowItems] = useState(false);

  if (!data) return <div className="card p-6">{tc('loading')}</div>;
  const canConfirm = data.visit_status === 'CHECKED_IN' || data.visit_status === 'COUNTED';
  const canRecord = canConfirm || data.visit_status === 'DRAFT';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">{t('detailTitle', { visitNo: data.visit_no })}</h1>
          <span className={`pill ${pillForStatus(data.visit_status)}`}>{data.visit_status}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            className="btn btn-ghost"
            href={`${API_BASE}/sales-visits/${data.visit_id}/receipt.pdf`}
            target="_blank"
            rel="noreferrer"
          >
            {t('downloadPdf')}
          </a>
          {canRecord && (
            <button className="btn btn-ghost" onClick={() => setShowItems(true)}>
              {t('recordItems')}
            </button>
          )}
          {canConfirm && (
            <button className="btn btn-primary" onClick={() => setShowConfirm(true)}>
              {t('confirmVisit')}
            </button>
          )}
        </div>
      </div>

      <div className="card grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
        <Field label={t('colCustomer')}>{data.customer?.customer_name}</Field>
        <Field label={t('colSalesRep')}>{data.employee?.employee_name}</Field>
        <Field label={t('fieldVisitDate')}>{fmtDate(data.visit_date)}</Field>
        <Field label={t('fieldTotalSales')}>{fmtMoney(data.total_sales_amount)} THB</Field>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">{t('sectionItems')}</h2>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-head">
                <th className="px-3 py-2">{t('colSku')}</th>
                <th className="px-3 py-2">{t('colProduct')}</th>
                <th className="px-3 py-2 text-right">{t('colBefore')}</th>
                <th className="px-3 py-2 text-right">{t('colCounted')}</th>
                <th className="px-3 py-2 text-right">{t('colSold')}</th>
                <th className="px-3 py-2 text-right">{t('colReplenished')}</th>
                <th className="px-3 py-2 text-right">{t('colPrice')}</th>
                <th className="px-3 py-2 text-right">{t('colSales')}</th>
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
            </tbody>
          </table>
        </div>
      </section>

      {!!data.collections?.length && (
        <section>
          <h2 className="mb-2 text-lg font-medium">{t('sectionCollections')}</h2>
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
          <h2 className="mb-2 text-lg font-medium">{t('sectionArInvoices')}</h2>
          <ul className="card divide-y text-sm">
            {data.arInvoices.map((inv) => (
              <li key={inv.invoice_no} className="flex items-center justify-between px-4 py-2">
                <span className="font-mono text-xs text-slate-500">{inv.invoice_no}</span>
                <span className="font-medium">{fmtMoney(inv.total_amount)} THB</span>
                <span className="flex items-center gap-3">
                  <a
                    className="text-xs text-brand-600 hover:underline"
                    href={`${API_BASE}/ar/invoices/${inv.ar_invoice_id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF
                  </a>
                  <span className={`pill ${pillForStatus(inv.status)}`}>{inv.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showItems && (
        <RecordItemsDialog
          visit={data}
          onClose={() => setShowItems(false)}
          onDone={() => qc.invalidateQueries({ queryKey: ['visit', params.id] })}
        />
      )}
      {showConfirm && (
        <ConfirmDialog
          visit={data}
          onClose={() => setShowConfirm(false)}
          onDone={() => qc.invalidateQueries({ queryKey: ['visit', params.id] })}
        />
      )}
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

function ConfirmDialog({
  visit,
  onClose,
  onDone,
}: {
  visit: VisitDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('visits');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const isCod = visit.customer.credit_term_days === 0;
  const hasReplenish = visit.items.some((it) => Number(it.qty_replenished) > 0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'QR_PAYMENT' | 'OTHER'>('CASH');
  const [amount, setAmount] = useState(isCod ? visit.total_sales_amount : '0');
  const [reference, setReference] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (hasReplenish) {
        body.warehouse_id = warehouseId;
      }
      if (Number(amount) > 0 || isCod) {
        body.payment_method = paymentMethod;
        body.amount_collected = amount;
        if (reference) body.reference_no = reference;
      }
      const idemKey = `confirm-${visit.visit_id}-${Date.now()}`;
      return api(`/sales-visits/${visit.visit_id}/confirm`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idemKey },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      onDone();
      onClose();
    },
  });

  function submit() {
    if (hasReplenish && !warehouseId) {
      setFormError(t('warehouseRequired'));
      return;
    }
    setFormError(null);
    m.mutate();
  }

  return (
    <Modal title={t('confirmModalTitle', { visitNo: visit.visit_no })} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">
          {t('totalSalesLabel')}{' '}
          <span className="font-medium">{fmtMoney(visit.total_sales_amount)} THB</span>
          {isCod && <span className="ml-2 text-xs text-amber-600">{t('codNote')}</span>}
        </p>
        {hasReplenish && (
          <div>
            <label className="label">{t('warehouseLabel')}</label>
            <input
              className="input"
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setFormError(null);
              }}
              placeholder={t('warehousePlaceholder')}
            />
          </div>
        )}
        <div>
          <label className="label">{t('paymentMethod')}</label>
          <select
            className="input"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as never)}
          >
            <option>CASH</option>
            <option>BANK_TRANSFER</option>
            <option>QR_PAYMENT</option>
            <option>OTHER</option>
          </select>
        </div>
        <div>
          <label className="label">{t('amountCollected')}</label>
          <input
            type="text"
            inputMode="decimal"
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t('reference')}</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        {(formError || m.error) && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError ?? errorMessage(m.error)}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>
            {tc('cancel')}
          </button>
          <button className="btn btn-primary" disabled={m.isPending} onClick={submit}>
            {m.isPending ? tc('working') : t('confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RecordItemsDialog({
  visit,
  onClose,
  onDone,
}: {
  visit: VisitDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('visits');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [items, setItems] = useState(() =>
    visit.items.map((it) => ({
      product_id: it.product_id,
      sku: it.product.sku_code,
      qty_counted: it.qty_counted,
      qty_replenished: it.qty_replenished,
      unit_price: it.unit_price,
    })),
  );
  const m = useMutation({
    mutationFn: async () =>
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
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Modal title={t('recordModalTitle', { visitNo: visit.visit_no })} onClose={onClose}>
      <div className="space-y-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-head">
              <th className="py-1 text-left">{t('colSku')}</th>
              <th className="py-1 text-right">{t('colCounted')}</th>
              <th className="py-1 text-right">{t('colReplenish')}</th>
              <th className="py-1 text-right">{t('colPrice')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.product_id}>
                <td className="py-1 font-mono text-xs">{it.sku}</td>
                <td className="py-1 text-right">
                  <input
                    className="input w-24 text-right font-mono"
                    value={it.qty_counted}
                    onChange={(e) =>
                      setItems((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, qty_counted: e.target.value } : x)),
                      )
                    }
                  />
                </td>
                <td className="py-1 text-right">
                  <input
                    className="input w-24 text-right font-mono"
                    value={it.qty_replenished}
                    onChange={(e) =>
                      setItems((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, qty_replenished: e.target.value } : x)),
                      )
                    }
                  />
                </td>
                <td className="py-1 text-right">
                  <input
                    className="input w-24 text-right font-mono"
                    value={it.unit_price}
                    onChange={(e) =>
                      setItems((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {m.error && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage(m.error)}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>
            {tc('cancel')}
          </button>
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? tc('saving') : t('saveItems')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg space-y-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-xl text-slate-400 hover:text-slate-700">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
