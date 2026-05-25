"use client";

import { ReportPage } from '@/components/report-page';
import { fmtMoney } from '@/lib/format';

type Row = {
  id: string;
  warehouse: { warehouse_code: string; warehouse_name: string };
  product: { sku_code: string; product_name: string };
  qty_on_hand: string;
  qty_reserved: string;
  qty_available: string;
};

export default function CurrentStockReport() {
  return (
    <ReportPage<Row>
      title="Current Warehouse Stock"
      endpoint="/reports/current-stock"
      withDateRange={false}
      rowKey={(r, i) => r.id ?? String(i)}
      columns={[
        { label: 'Warehouse', cell: (r) => <span className="font-mono text-xs">{r.warehouse?.warehouse_code}</span> },
        { label: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.product?.sku_code}</span> },
        { label: 'Product', cell: (r) => r.product?.product_name },
        { label: 'On hand', align: 'right', cell: (r) => fmtMoney(r.qty_on_hand) },
        { label: 'Reserved', align: 'right', cell: (r) => fmtMoney(r.qty_reserved) },
        { label: 'Available', align: 'right', cell: (r) => fmtMoney(r.qty_available) },
      ]}
    />
  );
}
