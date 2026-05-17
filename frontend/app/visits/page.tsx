"use client";

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney, pillForStatus } from '@/lib/format';

type Visit = {
  visit_id: string;
  visit_no: string;
  visit_status: string;
  visit_date: string;
  total_sales_amount: string;
  customer: { customer_code: string; customer_name: string };
  employee: { employee_name: string };
};

type Page<T> = { data: T[]; total: number };

export default function VisitsPage() {
  const t = useTranslations('visits');
  const tc = useTranslations('common');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['visits', status, page],
    queryFn: () =>
      api<Page<Visit>>(
        `/sales-visits?pageSize=20&page=${page}${
          status ? `&status=${status}` : ''
        }`,
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="input max-w-[180px]"
          >
            <option value="">{t('allStatuses')}</option>
            <option>DRAFT</option>
            <option>CHECKED_IN</option>
            <option>COUNTED</option>
            <option>CONFIRMED</option>
            <option>CANCELLED</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-head">
              <th className="px-3 py-2">{t('colVisitNo')}</th>
              <th className="px-3 py-2">{t('colCustomer')}</th>
              <th className="px-3 py-2">{t('colSalesRep')}</th>
              <th className="px-3 py-2">{t('colDate')}</th>
              <th className="px-3 py-2 text-right">{t('colSales')}</th>
              <th className="px-3 py-2">{t('colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-sm text-slate-500">
                  {tc('loading')}
                </td>
              </tr>
            )}
            {data?.data.map((v) => (
              <tr key={v.visit_id} className="table-row">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/visits/${v.visit_id}`} className="text-brand-600 hover:underline">
                    {v.visit_no}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{v.customer?.customer_name}</div>
                  <div className="text-xs text-slate-500">{v.customer?.customer_code}</div>
                </td>
                <td className="px-3 py-2">{v.employee?.employee_name}</td>
                <td className="px-3 py-2">{fmtDate(v.visit_date)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(v.total_sales_amount)}</td>
                <td className="px-3 py-2">
                  <span className={`pill ${pillForStatus(v.visit_status)}`}>{v.visit_status}</span>
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div>{tc('pagination', { total: data.total.toLocaleString(), page })}</div>
          <div className="flex gap-1">
            <button
              className="btn btn-ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {tc('prev')}
            </button>
            <button
              className="btn btn-ghost"
              disabled={data.data.length < 20}
              onClick={() => setPage((p) => p + 1)}
            >
              {tc('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
