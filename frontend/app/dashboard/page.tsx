"use client";

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney, pillForStatus } from '@/lib/format';
import { useErrorMessage } from '@/lib/use-error-message';

type Dashboard = {
  today: { sales_amount: string; visits_confirmed: number };
  visits_in_progress: number;
  warehouse_value: string;
  consignment_value: string;
  ar_outstanding: { amount: string; invoice_count: number };
  customers_active: number;
  products_active: number;
};

type Visit = {
  visit_id: string;
  visit_no: string;
  visit_status: string;
  visit_date: string;
  total_sales_amount: string;
  customer: { customer_code: string; customer_name: string };
};

type LowStock = {
  id: string;
  qty_on_hand: string;
  qty_available: string;
  warehouse: { warehouse_code: string };
  product: { sku_code: string; product_name: string; min_stock: string };
};

type Page<T> = { data: T[]; total: number };

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();

  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/reports/dashboard'),
  });
  const recentVisits = useQuery({
    queryKey: ['recent-visits'],
    queryFn: () => api<Page<Visit>>('/sales-visits?pageSize=5&page=1'),
  });
  const lowStock = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => api<Page<LowStock>>('/inventory/warehouse?low_stock=true&pageSize=5&page=1'),
  });

  const username = readUsernameFromToken();
  const today = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
  }).format(new Date());
  const data = dashboard.data;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {username ? t('welcomeNamed', { name: username }) : t('welcome')}
        </h1>
        <p className="text-sm text-surface-500">{today}</p>
      </header>

      {dashboard.error && (
        <div className="alert-error">
          {t('loadError', { message: errorMessage(dashboard.error) })}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label={t('todaySales')}
          value={data ? fmtMoney(data.today.sales_amount) : '—'}
          suffix="THB"
          loading={dashboard.isLoading}
        />
        <Kpi
          label={t('visitsConfirmed')}
          value={data ? String(data.today.visits_confirmed) : '—'}
          loading={dashboard.isLoading}
        />
        <Kpi
          label={t('visitsInProgress')}
          value={data ? String(data.visits_in_progress) : '—'}
          loading={dashboard.isLoading}
        />
        <Kpi
          label={t('outstandingAr')}
          value={data ? fmtMoney(data.ar_outstanding.amount) : '—'}
          hint={data ? t('invoiceCount', { count: data.ar_outstanding.invoice_count }) : undefined}
          suffix="THB"
          loading={dashboard.isLoading}
        />
        <Kpi
          label={t('consignmentValue')}
          value={data ? fmtMoney(data.consignment_value) : '—'}
          suffix="THB"
          loading={dashboard.isLoading}
        />
        <Kpi
          label={t('warehouseValue')}
          value={data ? fmtMoney(data.warehouse_value) : '—'}
          suffix="THB"
          loading={dashboard.isLoading}
        />
        <Kpi
          label={t('customersActive')}
          value={data ? String(data.customers_active) : '—'}
          loading={dashboard.isLoading}
        />
        <Kpi
          label={t('productsActive')}
          value={data ? String(data.products_active) : '—'}
          loading={dashboard.isLoading}
        />
      </div>

      {/* Detail sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title={t('recentVisits')}
          href="/visits"
          viewAll={t('viewAll')}
          empty={recentVisits.isLoading ? tc('loading') : t('noRecentVisits')}
          isEmpty={!recentVisits.isLoading && (recentVisits.data?.data.length ?? 0) === 0}
        >
          <ul className="divide-y divide-surface-200 dark:divide-surface-800">
            {recentVisits.data?.data.map((v) => (
              <li key={v.visit_id}>
                <Link
                  href={`/visits/${v.visit_id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-50 dark:hover:bg-surface-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{v.customer?.customer_name}</div>
                    <div className="font-mono text-xs text-surface-500">
                      {v.visit_no} · {fmtDate(v.visit_date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">{fmtMoney(v.total_sales_amount)}</div>
                    <span className={`pill ${pillForStatus(v.visit_status)}`}>{v.visit_status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title={t('lowStockAlerts')}
          href="/inventory"
          viewAll={t('viewAll')}
          empty={lowStock.isLoading ? tc('loading') : t('noLowStock')}
          isEmpty={!lowStock.isLoading && (lowStock.data?.data.length ?? 0) === 0}
        >
          <ul className="divide-y divide-surface-200 dark:divide-surface-800">
            {lowStock.data?.data.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.product?.product_name}</div>
                  <div className="font-mono text-xs text-surface-500">
                    {s.product?.sku_code} · {s.warehouse?.warehouse_code}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-rose-700 dark:text-rose-300">
                    {fmtMoney(s.qty_on_hand)}
                  </div>
                  <div className="text-xs text-surface-500">
                    {t('minStock', { min: fmtMoney(s.product?.min_stock) })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  suffix,
  hint,
  loading,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-surface-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">
        {loading ? <span className="text-surface-300 dark:text-surface-700">···</span> : value}
        {!loading && suffix && (
          <span className="ml-1 text-sm font-normal text-surface-400">{suffix}</span>
        )}
      </div>
      {hint && <div className="mt-0.5 text-xs text-surface-500">{hint}</div>}
    </div>
  );
}

/** Decode the JWT payload to get the username for the greeting.
 *  No signature verification — server still enforces auth on every call. */
function readUsernameFromToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.username === 'string' ? payload.username : null;
  } catch {
    return null;
  }
}

function Section({
  title,
  href,
  viewAll,
  isEmpty,
  empty,
  children,
}: {
  title: string;
  href: string;
  viewAll: string;
  isEmpty: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
        <h2 className="font-medium">{title}</h2>
        <Link
          href={href}
          className="text-xs text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          {viewAll} →
        </Link>
      </header>
      {isEmpty ? (
        <div className="px-4 py-6 text-center text-sm text-surface-500">{empty}</div>
      ) : (
        children
      )}
    </section>
  );
}
