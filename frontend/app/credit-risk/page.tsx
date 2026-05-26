"use client";

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';

type Row = {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  credit_limit: string;
  ar_outstanding: string;
  consignment_value: string;
  credit_exposure: string;
  available_credit: string;
  usage_pct: number;
};

export default function CreditRiskPage() {
  const t = useTranslations('creditRisk');
  const tc = useTranslations('common');
  const [threshold, setThreshold] = useState(80);
  const { data, isLoading } = useQuery({
    queryKey: ['credit-risk', threshold],
    queryFn: () => api<{ data: Row[] } | Row[]>(`/credit/risk?threshold_pct=${threshold}`),
  });
  const rows = Array.isArray(data) ? data : data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <label className="flex items-center gap-2 text-sm text-surface-600">
          {t('threshold')}
          <input
            type="number"
            min={0}
            max={200}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="input w-24"
          />
        </label>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="table-head">
              <th className="px-3 py-2">{t('colCustomer')}</th>
              <th className="px-3 py-2 text-right">{t('colCreditLimit')}</th>
              <th className="px-3 py-2 text-right">{t('colArOutstanding')}</th>
              <th className="px-3 py-2 text-right">{t('colConsignmentValue')}</th>
              <th className="px-3 py-2 text-right">{t('colTotalExposure')}</th>
              <th className="px-3 py-2 text-right">{t('colAvailable')}</th>
              <th className="px-3 py-2 text-right">{t('colUsage')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-surface-500">{tc('loading')}</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.customer_id} className="table-row">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.customer_name}</div>
                  <div className="text-xs text-surface-500">{r.customer_code}</div>
                </td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.credit_limit)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.ar_outstanding)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.consignment_value)}</td>
                <td className="px-3 py-2 text-right font-mono font-medium">
                  {fmtMoney(r.credit_exposure)}
                </td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.available_credit)}</td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={
                      'pill ' +
                      (r.usage_pct >= 100
                        ? 'bg-rose-100 text-rose-700'
                        : r.usage_pct >= 80
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700')
                    }
                  >
                    {r.usage_pct?.toFixed?.(1) ?? '—'}%
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-surface-500">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
