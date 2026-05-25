"use client";

import { ReportPage } from '@/components/report-page';
import { fmtMoney } from '@/lib/format';

type Row = { employee_id: string; employee_code: string; employee_name: string; total_amount: string; visit_count: number };

export default function SalesByEmployeeReport() {
  return (
    <ReportPage<Row>
      title="Sales by Employee"
      endpoint="/reports/sales-by-employee"
      rowKey={(r) => r.employee_id}
      columns={[
        { label: 'Code', cell: (r) => <span className="font-mono text-xs">{r.employee_code}</span> },
        { label: 'Employee', cell: (r) => r.employee_name },
        { label: 'Visits', align: 'right', cell: (r) => r.visit_count.toLocaleString() },
        { label: 'Amount (THB)', align: 'right', cell: (r) => fmtMoney(r.total_amount) },
      ]}
    />
  );
}
