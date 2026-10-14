// Header detection and column mapping for imported sheets.
import { createHash } from 'node:crypto';
import { parseAmount } from './amounts';

export interface ColumnMap {
  date?: number;
  details?: number;
  category?: number;
  amount?: number;
  in?: number;
  out?: number;
  flag?: number;
}

export const ROLE_LABELS: Record<keyof ColumnMap, string> = {
  date: 'Date', details: 'Details', category: 'Category', amount: 'Amount', in: 'Cash In', out: 'Cash Out', flag: 'Dr/Cr flag',
};

const RE = {
  dateHeader: /date|tarikh/i,
  amountHeader: /amount|amaun|debit|credit|kredit|withdraw|deposit|cash in|cash out|\brm\b|\(rm\)/i,
  date: /date|tarikh/i,
  details: /desc|detail|particular|keterangan|narration|remark|transaction|butiran|reference/i,
  category: /categ|kategori|type/i,
  amount: /amount|amaun|^rm\b|\(rm\)|\brm$|total/i,
  in: /credit|kredit|deposit|cash in|money in|masuk/i,
  out: /debit|withdraw|cash out|money out|keluar/i,
  flag: /^(dr\s*\/\s*cr|cr\s*\/\s*dr|d\s*\/\s*c|c\s*\/\s*d|in\s*\/\s*out|direction|debit\s*\/\s*credit|credit\s*\/\s*debit|sign|dc)$/i,
};

const cellText = (v: unknown) => String(v ?? '').trim();

/** Scan the first 30 rows for a row containing a date column and an amount-like column. */
export function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = (rows[i] ?? []).map((c) => cellText(c).toLowerCase());
    if (cells.some((c) => RE.dateHeader.test(c)) && cells.some((c) => RE.amountHeader.test(c))) return i;
  }
  return -1;
}

const FLAG_VALUES = /^(dr|cr|d|c|debit|credit|in|out|db|kredit)$/i;

/** Auto-detect the column map from a header row (+ sample of data rows for ambiguous "type" columns). */
export function detectColumns(header: unknown[], sample: unknown[][] = []): ColumnMap {
  const h = header.map((c) => cellText(c).toLowerCase());
  const used = new Set<number>();
  const take = (re: RegExp, accept?: (i: number) => boolean): number | undefined => {
    const i = h.findIndex((c, idx) => c !== '' && !used.has(idx) && re.test(c) && (!accept || accept(idx)));
    if (i >= 0) used.add(i);
    return i >= 0 ? i : undefined;
  };
  const colValues = (i: number) => sample.map((r) => cellText(r?.[i])).filter((v) => v !== '');
  const isFlagCol = (i: number) => {
    const vals = colValues(i);
    return vals.length > 0 && vals.every((v) => FLAG_VALUES.test(v));
  };

  const map: ColumnMap = {};
  map.date = take(RE.date);
  map.in = take(RE.in);
  map.out = take(RE.out);
  map.flag = take(RE.flag);
  map.amount = take(RE.amount);
  // A "Type" column whose values are Dr/Cr is a flag, otherwise it is the category.
  if (map.flag === undefined) {
    const t = h.findIndex((c, idx) => !used.has(idx) && /^type$|transaction type|trans type/.test(c) && isFlagCol(idx));
    if (t >= 0) {
      map.flag = t;
      used.add(t);
    }
  }
  map.category = take(RE.category);
  map.details = take(RE.details);
  // Prefer a more descriptive details column when several match (e.g. "Description" over "Reference")
  if (map.details !== undefined) {
    const better = h.findIndex((c, idx) => !used.has(idx) && /desc|detail|particular|keterangan|narration|butiran/.test(c));
    if (better >= 0 && !/desc|detail|particular|keterangan|narration|butiran/.test(h[map.details])) {
      used.delete(map.details);
      map.details = better;
      used.add(better);
    }
  }
  for (const k of Object.keys(map) as (keyof ColumnMap)[]) if (map[k] === undefined) delete map[k];
  return map;
}

/** Stable fingerprint of a header row — identifies "the same bank format". */
export function headerSignature(header: unknown[]): string {
  const norm = header
    .map((c) => cellText(c).toLowerCase().replace(/\s+/g, ' '))
    .filter((c) => c !== '')
    .join('|');
  return createHash('sha1').update(norm).digest('hex').slice(0, 16);
}

export function describeMap(header: unknown[], map: ColumnMap): string {
  return (Object.keys(map) as (keyof ColumnMap)[])
    .filter((k) => map[k] !== undefined)
    .map((k) => `${ROLE_LABELS[k]} ← "${cellText(header[map[k]!])}"`)
    .join(', ');
}

export interface RawRow {
  rowIndex: number;
  date: string;
  details: string;
  direction: 'IN' | 'OUT';
  amount: number; // sen, positive
  categoryHint: string | null;
}

const TOTAL_ROW = /^\s*(total|jumlah|grand total|sub ?total|balance|baki|opening balance|closing balance|b\/f|c\/f|brought forward|carried forward)\b/i;

/** Convert sheet rows below the header into normalised transactions using the column map. */
export function extractRows(
  rows: unknown[][],
  headerIndex: number,
  map: ColumnMap,
  parseDateFn: (v: unknown) => string | null,
): RawRow[] {
  const out: RawRow[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((v) => v === null || v === undefined || cellText(v) === '')) continue;
    if (map.date === undefined) continue;
    const date = parseDateFn(r[map.date]);
    if (!date) continue; // blank/total/balance-only rows have no date

    const details = map.details !== undefined ? cellText(r[map.details]) : '';
    if (TOTAL_ROW.test(details)) continue;

    let direction: 'IN' | 'OUT' | null = null;
    let amount = 0;
    if (map.in !== undefined || map.out !== undefined) {
      const inV = map.in !== undefined ? parseAmount(r[map.in]) : null;
      const outV = map.out !== undefined ? parseAmount(r[map.out]) : null;
      if (inV) {
        direction = inV > 0 ? 'IN' : 'OUT';
        amount = Math.abs(inV);
      } else if (outV) {
        direction = outV > 0 ? 'OUT' : 'IN';
        amount = Math.abs(outV);
      }
    }
    if (!direction && map.amount !== undefined) {
      const a = parseAmount(r[map.amount]);
      if (a) {
        amount = Math.abs(a);
        direction = a < 0 ? 'OUT' : 'IN';
        if (map.flag !== undefined) {
          const f = cellText(r[map.flag]);
          if (/^(dr|d|db|debit|out)$/i.test(f)) direction = 'OUT';
          else if (/^(cr|c|credit|kredit|in)$/i.test(f)) direction = 'IN';
        }
      }
    }
    if (!direction || amount === 0) continue; // balance-only / empty rows
    const hint = map.category !== undefined ? cellText(r[map.category]) : '';
    out.push({ rowIndex: i, date, details, direction, amount, categoryHint: hint || null });
  }
  return out;
}
