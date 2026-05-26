"use client";

import { useState } from 'react';
import { ReportPage } from '@/components/report-page';
import { fmtDate, fmtMoney } from '@/lib/format';

type Row = {
  product_id: string;
  sku_code: string;
  product_name: string;
  warehouse_qty: string;
  consignment_qty: string;
  last_sale: string | null;
  days_since_last_sale: number | null;
};

export default function DeadStockReport() {
  const [days, setDays] = useState('30');
  return (
    <ReportPage<Row>
      title="Dead Stock"
      description="Products with stock on hand but no sales in the past N days."
      endpoint="/reports/dead-stock"
      withDateRange={false}
      extraParams={{ days }}
      rowKey={(r) => r.product_id}
      extraFilters={
        <select className="input max-w-[140px]" value={days} onChange={(e) => setDays(e.target.value)}>
          {['7', '14', '30', '60', '90', '180'].map((n) => <option key={n} value={n}>No sales for {n}d</option>)}
        </select>
      }
      columns={[
        { label: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku_code}</span> },
        { label: 'Product', cell: (r) => r.product_name },
        { label: 'Warehouse qty', align: 'right', cell: (r) => fmtMoney(r.warehouse_qty) },
        { label: 'Consignment qty', align: 'right', cell: (r) => fmtMoney(r.consignment_qty) },
        { label: 'Last sale', cell: (r) => <span className="text-xs text-surface-500">{r.last_sale ? fmtDate(r.last_sale).slice(0, 10) : 'never'}</span> },
        { label: 'Days idle', align: 'right', cell: (r) => r.days_since_last_sale ?? '∞' },
      ]}
    />
  );
}
