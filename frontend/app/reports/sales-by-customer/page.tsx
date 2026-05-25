"use client";

import { ReportPage } from '@/components/report-page';
import { fmtMoney } from '@/lib/format';

type Row = { customer_id: string; customer_code: string; customer_name: string; total_qty: string; total_amount: string; visit_count: number };

export default function SalesByCustomerReport() {
  return (
    <ReportPage<Row>
      title="Sales by Customer"
      endpoint="/reports/sales-by-customer"
      rowKey={(r) => r.customer_id}
      columns={[
        { label: 'Customer', cell: (r) => (<div><div className="font-medium">{r.customer_name}</div><div className="font-mono text-xs text-slate-500">{r.customer_code}</div></div>) },
        { label: 'Visits', align: 'right', cell: (r) => r.visit_count.toLocaleString() },
        { label: 'Qty sold', align: 'right', cell: (r) => fmtMoney(r.total_qty) },
        { label: 'Total amount (THB)', align: 'right', cell: (r) => fmtMoney(r.total_amount) },
      ]}
    />
  );
}
