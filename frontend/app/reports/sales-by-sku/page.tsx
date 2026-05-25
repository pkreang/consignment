"use client";

import { ReportPage } from '@/components/report-page';
import { fmtMoney } from '@/lib/format';

type Row = { product_id: string; sku_code: string; product_name: string; total_qty: string; total_amount: string };

export default function SalesBySkuReport() {
  return (
    <ReportPage<Row>
      title="Sales by SKU"
      endpoint="/reports/sales-by-sku"
      rowKey={(r) => r.product_id}
      columns={[
        { label: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku_code}</span> },
        { label: 'Product', cell: (r) => r.product_name },
        { label: 'Qty', align: 'right', cell: (r) => fmtMoney(r.total_qty) },
        { label: 'Amount (THB)', align: 'right', cell: (r) => fmtMoney(r.total_amount) },
      ]}
    />
  );
}
