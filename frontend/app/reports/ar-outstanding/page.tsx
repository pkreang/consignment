"use client";

import Link from 'next/link';
import { ReportPage } from '@/components/report-page';
import { fmtMoney } from '@/lib/format';

type Row = { customer_id: string; customer_code: string; customer_name: string; open_count: number; total_outstanding: string };

export default function ArOutstandingReport() {
  return (
    <ReportPage<Row>
      title="AR Outstanding by Customer"
      endpoint="/reports/ar-outstanding"
      withDateRange={false}
      rowKey={(r) => r.customer_id}
      columns={[
        { label: 'Customer', cell: (r) => (<Link className="text-brand-600 hover:underline" href={`/ar?customerId=${r.customer_id}`}><div className="font-medium">{r.customer_name}</div><div className="font-mono text-xs text-slate-500">{r.customer_code}</div></Link>) },
        { label: 'Open invoices', align: 'right', cell: (r) => r.open_count.toLocaleString() },
        { label: 'Outstanding (THB)', align: 'right', cell: (r) => fmtMoney(r.total_outstanding) },
      ]}
    />
  );
}
