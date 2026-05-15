import PDFDocument from 'pdfkit';
import { Response } from 'express';

/**
 * Lightweight PDF builders for AR invoices and visit receipts. We avoid heavy
 * template engines on purpose — these documents are operational receipts, not
 * marketing collateral, and the structure is stable.
 *
 * The PDF is streamed straight to the response so memory stays bounded
 * regardless of line count.
 */

type Money = string | number | null | undefined;

const fmt = (v: Money): string => {
  if (v === null || v === undefined || v === '') return '0.00';
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const fmtDate = (v: Date | string | null | undefined): string => {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleDateString('en-CA');
};

interface InvoiceInput {
  invoice_no: string;
  invoice_date: Date | string;
  due_date: Date | string;
  status: string;
  customer: { customer_code: string; customer_name: string; address?: string | null };
  visit?: { visit_no: string } | null;
  total_amount: Money;
  outstanding_amount: Money;
  items: Array<{
    product: { sku_code: string; product_name: string };
    qty: Money;
    unit_price: Money;
    line_amount: Money;
  }>;
}

function header(doc: PDFKit.PDFDocument, title: string) {
  doc
    .fontSize(20)
    .fillColor('#1857b3')
    .text('Consignment ERP Lite', 50, 50)
    .fontSize(10)
    .fillColor('#475569')
    .text('Sales & Receivables', 50, 75);

  doc
    .fontSize(18)
    .fillColor('#0f172a')
    .text(title, 50, 50, { align: 'right' });

  doc
    .moveTo(50, 110)
    .lineTo(545, 110)
    .strokeColor('#cbd5e1')
    .stroke();
}

function fieldGrid(
  doc: PDFKit.PDFDocument,
  rows: Array<Array<{ label: string; value: string }>>,
  startY: number,
): number {
  let y = startY;
  for (const row of rows) {
    const colWidth = 495 / row.length;
    row.forEach((c, i) => {
      const x = 50 + i * colWidth;
      doc
        .fontSize(8)
        .fillColor('#64748b')
        .text(c.label.toUpperCase(), x, y);
      doc.fontSize(11).fillColor('#0f172a').text(c.value, x, y + 11);
    });
    y += 36;
  }
  return y;
}

function tableHeader(doc: PDFKit.PDFDocument, y: number, columns: Array<{ label: string; x: number; width: number; align?: 'left' | 'right' }>) {
  doc.rect(50, y, 495, 20).fill('#f1f5f9');
  doc.fillColor('#475569').fontSize(9);
  for (const c of columns) {
    doc.text(c.label, c.x, y + 6, { width: c.width, align: c.align ?? 'left' });
  }
  doc.fillColor('#0f172a');
}

export function streamInvoicePdf(res: Response, inv: InvoiceInput): void {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Invoice ${inv.invoice_no}` } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="invoice-${inv.invoice_no}.pdf"`,
  );
  doc.pipe(res);

  header(doc, 'TAX INVOICE');

  doc.fontSize(11);
  const customer = inv.customer;
  let y = fieldGrid(
    doc,
    [
      [
        { label: 'Invoice No.', value: inv.invoice_no },
        { label: 'Invoice Date', value: fmtDate(inv.invoice_date) },
        { label: 'Due Date', value: fmtDate(inv.due_date) },
        { label: 'Status', value: inv.status },
      ],
      [
        {
          label: 'Bill To',
          value: `${customer.customer_code} — ${customer.customer_name}\n${customer.address ?? ''}`,
        },
        { label: 'Source Visit', value: inv.visit?.visit_no ?? '—' },
      ],
    ],
    130,
  );
  y += 8;

  const columns = [
    { label: 'SKU', x: 50, width: 80 },
    { label: 'Description', x: 135, width: 235 },
    { label: 'Qty', x: 375, width: 50, align: 'right' as const },
    { label: 'Unit Price', x: 425, width: 60, align: 'right' as const },
    { label: 'Amount', x: 485, width: 60, align: 'right' as const },
  ];

  tableHeader(doc, y, columns);
  y += 22;
  doc.fontSize(10);

  for (const it of inv.items) {
    doc.text(it.product.sku_code, columns[0]!.x, y, { width: columns[0]!.width });
    doc.text(it.product.product_name, columns[1]!.x, y, {
      width: columns[1]!.width,
    });
    doc.text(fmt(it.qty), columns[2]!.x, y, {
      width: columns[2]!.width,
      align: 'right',
    });
    doc.text(fmt(it.unit_price), columns[3]!.x, y, {
      width: columns[3]!.width,
      align: 'right',
    });
    doc.text(fmt(it.line_amount), columns[4]!.x, y, {
      width: columns[4]!.width,
      align: 'right',
    });
    y += 18;
    if (y > 720) {
      doc.addPage();
      y = 60;
    }
  }

  y += 4;
  doc.moveTo(330, y).lineTo(545, y).strokeColor('#cbd5e1').stroke();
  y += 8;
  doc
    .fontSize(11)
    .fillColor('#0f172a')
    .text('Total', 330, y, { width: 100 })
    .text(`${fmt(inv.total_amount)} THB`, 430, y, {
      width: 115,
      align: 'right',
    });
  y += 18;
  doc
    .fillColor('#1857b3')
    .text('Outstanding', 330, y, { width: 100 })
    .text(`${fmt(inv.outstanding_amount)} THB`, 430, y, {
      width: 115,
      align: 'right',
    });

  doc.end();
}

interface ReceiptInput {
  visit_no: string;
  visit_date: Date | string;
  status: string;
  customer: { customer_code: string; customer_name: string };
  employee: { employee_name: string };
  items: Array<{
    product: { sku_code: string; product_name: string };
    qty_before: Money;
    qty_counted: Money;
    qty_sold: Money;
    qty_replenished: Money;
    unit_price: Money;
    sales_amount: Money;
  }>;
  total_sales_amount: Money;
  collections?: Array<{
    collection_no: string;
    amount_collected: Money;
    payment_method: string;
    reference_no?: string | null;
  }>;
  ar_invoices?: Array<{ invoice_no: string; total_amount: Money; status: string }>;
}

export function streamVisitReceiptPdf(res: Response, v: ReceiptInput): void {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Visit ${v.visit_no}` } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="visit-${v.visit_no}.pdf"`,
  );
  doc.pipe(res);

  header(doc, 'VISIT RECEIPT');
  let y = fieldGrid(
    doc,
    [
      [
        { label: 'Visit No.', value: v.visit_no },
        { label: 'Visit Date', value: fmtDate(v.visit_date) },
        { label: 'Status', value: v.status },
      ],
      [
        {
          label: 'Customer',
          value: `${v.customer.customer_code} — ${v.customer.customer_name}`,
        },
        { label: 'Sales Rep', value: v.employee.employee_name },
      ],
    ],
    130,
  );
  y += 8;

  const cols = [
    { label: 'SKU', x: 50, width: 75 },
    { label: 'Product', x: 128, width: 165 },
    { label: 'Before', x: 295, width: 50, align: 'right' as const },
    { label: 'Counted', x: 345, width: 50, align: 'right' as const },
    { label: 'Sold', x: 395, width: 45, align: 'right' as const },
    { label: 'Refill', x: 440, width: 45, align: 'right' as const },
    { label: 'Amount', x: 485, width: 60, align: 'right' as const },
  ];
  tableHeader(doc, y, cols);
  y += 22;
  doc.fontSize(9);
  for (const it of v.items) {
    doc.text(it.product.sku_code, cols[0]!.x, y, { width: cols[0]!.width });
    doc.text(it.product.product_name, cols[1]!.x, y, { width: cols[1]!.width });
    doc.text(fmt(it.qty_before), cols[2]!.x, y, { width: cols[2]!.width, align: 'right' });
    doc.text(fmt(it.qty_counted), cols[3]!.x, y, { width: cols[3]!.width, align: 'right' });
    doc.text(fmt(it.qty_sold), cols[4]!.x, y, { width: cols[4]!.width, align: 'right' });
    doc.text(fmt(it.qty_replenished), cols[5]!.x, y, { width: cols[5]!.width, align: 'right' });
    doc.text(fmt(it.sales_amount), cols[6]!.x, y, { width: cols[6]!.width, align: 'right' });
    y += 16;
    if (y > 720) {
      doc.addPage();
      y = 60;
    }
  }

  y += 6;
  doc.moveTo(330, y).lineTo(545, y).strokeColor('#cbd5e1').stroke();
  y += 8;
  doc
    .fontSize(11)
    .fillColor('#0f172a')
    .text('Total Sale', 330, y, { width: 100 })
    .text(`${fmt(v.total_sales_amount)} THB`, 430, y, {
      width: 115,
      align: 'right',
    });
  y += 24;

  if (v.collections?.length) {
    doc.fontSize(12).fillColor('#1857b3').text('Collections', 50, y);
    y += 18;
    doc.fontSize(10).fillColor('#0f172a');
    for (const c of v.collections) {
      doc.text(
        `${c.collection_no}  ${c.payment_method}${
          c.reference_no ? ` (${c.reference_no})` : ''
        }`,
        50,
        y,
      );
      doc.text(`${fmt(c.amount_collected)} THB`, 430, y, {
        width: 115,
        align: 'right',
      });
      y += 14;
    }
    y += 8;
  }

  if (v.ar_invoices?.length) {
    doc.fontSize(12).fillColor('#1857b3').text('AR Invoices', 50, y);
    y += 18;
    doc.fontSize(10).fillColor('#0f172a');
    for (const inv of v.ar_invoices) {
      doc.text(`${inv.invoice_no}  ${inv.status}`, 50, y);
      doc.text(`${fmt(inv.total_amount)} THB`, 430, y, {
        width: 115,
        align: 'right',
      });
      y += 14;
    }
  }

  doc.end();
}
