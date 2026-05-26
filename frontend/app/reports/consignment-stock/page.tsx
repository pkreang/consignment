"use client";

import { ReportPage } from '@/components/report-page';
import { fmtMoney } from '@/lib/format';

type Row = { customer_id: string; customer_code: string; customer_name: string; total_qty: string; total_value: string };

export default function ConsignmentStockReport() {
  return (
    <ReportPage<Row>
      title="Consignment Stock by Customer"
      endpoint="/reports/consignment-stock"
      withDateRange={false}
      rowKey={(r) => String(r.customer_id)}
      columns={[
        { label: 'Customer', cell: (r) => (<div><div className="font-medium">{r.customer_name}</div><div className="font-mono text-xs text-surface-500">{r.customer_code}</div></div>) },
        { label: 'Qty on hand', align: 'right', cell: (r) => fmtMoney(r.total_qty) },
        { label: 'Value (THB)', align: 'right', cell: (r) => fmtMoney(r.total_value) },
      ]}
    />
  );
}
