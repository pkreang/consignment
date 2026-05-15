/**
 * Minimal RFC-4180-ish CSV parser. Tab/comma delimited, "double-quoted"
 * escaped fields, CRLF or LF line endings. Returns `Record<string, string>`
 * keyed by the header row.
 *
 * We avoid a heavyweight dep here — the import surface is small and we want
 * predictable handling for the spreadsheets ops teams export from Excel.
 */

export interface ParseCsvOptions {
  /** Delimiter override; defaults to comma. */
  delimiter?: string;
  /** Trim leading/trailing whitespace on each field. Defaults to true. */
  trim?: boolean;
}

export function parseCsv(
  source: string,
  options: ParseCsvOptions = {},
): Array<Record<string, string>> {
  const delim = options.delimiter ?? ',';
  const trim = options.trim ?? true;
  const rows = tokenize(source, delim);
  if (rows.length === 0) return [];
  const headers = rows[0]!.map((h) => (trim ? h.trim() : h));
  const out: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    if (row.length === 1 && row[0] === '') continue; // blank
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]!] = trim ? (row[c] ?? '').trim() : row[c] ?? '';
    }
    out.push(obj);
  }
  return out;
}

function tokenize(src: string, delim: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delim) {
      cur.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = '';
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}
