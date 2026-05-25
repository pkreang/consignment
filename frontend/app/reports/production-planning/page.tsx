"use client";

import { useState } from 'react';
import { ReportPage } from '@/components/report-page';
import { fmtMoney } from '@/lib/format';

type Row = {
  product_id: string;
  sku_code: string;
  product_name: string;
  min_stock: string;
  max_stock: string;
  avg_daily_sales: string;
  window_days: number;
  lead_time_days: number;
  projected_lead_time_demand: string;
  warehouse_qty: string;
  consignment_qty: string;
  total_on_hand: string;
  suggested_production_qty: string;
};

export default function ProductionPlanningReport() {
  const [leadTime, setLeadTime] = useState('7');
  return (
    <ReportPage<Row>
      title="Production Planning"
      description="Demand forecast based on the period's average daily sales, lead time, and current on-hand stock."
      endpoint="/reports/production-planning"
      extraParams={{ lead_time_days: leadTime }}
      rowKey={(r) => r.product_id}
      extraFilters={
        <select className="input max-w-[150px]" value={leadTime} onChange={(e) => setLeadTime(e.target.value)}>
          {['3', '7', '14', '30'].map((n) => <option key={n} value={n}>Lead {n}d</option>)}
        </select>
      }
      columns={[
        { label: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku_code}</span> },
        { label: 'Product', cell: (r) => r.product_name },
        { label: 'Avg/day', align: 'right', cell: (r) => fmtMoney(r.avg_daily_sales) },
        { label: 'Lead demand', align: 'right', cell: (r) => fmtMoney(r.projected_lead_time_demand) },
        { label: 'On hand', align: 'right', cell: (r) => fmtMoney(r.total_on_hand) },
        { label: 'Min / Max', align: 'right', cell: (r) => `${fmtMoney(r.min_stock)} / ${fmtMoney(r.max_stock)}` },
        { label: 'Produce', align: 'right', cell: (r) => <span className="font-medium">{fmtMoney(r.suggested_production_qty)}</span> },
      ]}
    />
  );
}
