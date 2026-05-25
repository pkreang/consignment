"use client";

import { useState } from 'react';
import { ReportPage } from '@/components/report-page';
import { fmtMoney } from '@/lib/format';

type Row = { product_id: string; sku_code: string; product_name: string; total_qty: string; total_amount: string; consignment_qty: string };

export default function SlowMoversReport() {
  const [limit, setLimit] = useState('20');
  return (
    <ReportPage<Row>
      title="Slow Movers"
      description="Active products with the lowest sold quantity in the period (ascending)."
      endpoint="/reports/slow-movers"
      extraParams={{ limit }}
      rowKey={(r) => r.product_id}
      extraFilters={
        <select className="input max-w-[110px]" value={limit} onChange={(e) => setLimit(e.target.value)}>
          {['10', '20', '50', '100'].map((n) => <option key={n} value={n}>Bottom {n}</option>)}
        </select>
      }
      columns={[
        { label: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku_code}</span> },
        { label: 'Product', cell: (r) => r.product_name },
        { label: 'Sold qty', align: 'right', cell: (r) => fmtMoney(r.total_qty) },
        { label: 'Sold amount', align: 'right', cell: (r) => fmtMoney(r.total_amount) },
        { label: 'Consignment qty', align: 'right', cell: (r) => fmtMoney(r.consignment_qty) },
      ]}
    />
  );
}
