"use client";

import { ReportPage } from '@/components/report-page';
import { fmtDate, fmtMoney } from '@/lib/format';

type Row = { date: string; payment_method: string; collection_count: number; total_amount: string };

export default function CollectionReport() {
  return (
    <ReportPage<Row>
      title="Collection Report"
      endpoint="/reports/collection"
      rowKey={(r, i) => `${r.date}-${r.payment_method}-${i}`}
      columns={[
        { label: 'Date', cell: (r) => <span className="text-xs text-surface-500">{fmtDate(r.date).slice(0, 10)}</span> },
        { label: 'Payment method', cell: (r) => <span className="pill bg-surface-100 text-surface-700">{r.payment_method}</span> },
        { label: 'Count', align: 'right', cell: (r) => r.collection_count.toLocaleString() },
        { label: 'Total (THB)', align: 'right', cell: (r) => fmtMoney(r.total_amount) },
      ]}
    />
  );
}
