export function fmtMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function pillForStatus(status: string): string {
  switch (status) {
    case 'CONFIRMED':
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700';
    case 'CHECKED_IN':
    case 'COUNTED':
    case 'OPEN':
    case 'PARTIAL':
      return 'bg-amber-100 text-amber-800';
    case 'CANCELLED':
    case 'OVERDUE':
      return 'bg-rose-100 text-rose-700';
    case 'DRAFT':
    default:
      return 'bg-slate-200 text-slate-700';
  }
}
