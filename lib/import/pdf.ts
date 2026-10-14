// Text-based bank-statement PDF parsing (heuristic).
import { parseAmount } from './amounts';
import { parseDate } from './dates';
import type { RawRow } from './columns';

const DATE_START = /^\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}[\s\-/.][A-Za-z]{3}[a-z]*[\s\-/.,]*\d{2,4}|\d{1,2}[/\-.]\d{1,2}(?![/\-.\d])|\d{1,2}\s+[A-Za-z]{3}(?![a-z]))/;
const AMOUNT_TOKEN = /\(?-?\d{1,3}(?:,\d{3})*\.\d{2}\)?(?:\s?(?:CR|DR|\+|-))?(?![\d.])/gi;
const BALANCE_LINE = /(balance|baki|b\/f|c\/f|brought forward|carried forward|opening|closing)/i;

export function guessYear(text: string): number {
  const years = [...text.matchAll(/\b(20[1-4]\d)\b/g)].map((m) => +m[1]);
  if (!years.length) return new Date().getFullYear();
  const counts = new Map<number, number>();
  years.forEach((y) => counts.set(y, (counts.get(y) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export interface PdfParse {
  rows: RawRow[];
  warnings: string[];
}

export function parseStatementText(text: string): PdfParse {
  const yearHint = guessYear(text);
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '');
  const rows: RawRow[] = [];
  const warnings: string[] = [];
  let prevBalance: number | null = null;
  let current: RawRow | null = null;

  const flush = () => {
    if (current) rows.push(current);
    current = null;
  };

  lines.forEach((line, idx) => {
    const dm = line.match(DATE_START);
    const tokens = [...line.matchAll(AMOUNT_TOKEN)];

    if (!dm) {
      // continuation of the previous description (no amounts on the line)
      if (current && tokens.length === 0 && !BALANCE_LINE.test(line)) {
        (current as RawRow).details = `${(current as RawRow).details} ${line.trim()}`.trim();
      }
      return;
    }

    const date = parseDate(dm[1], yearHint);
    if (!date) return;
    let rest = line.slice(dm[0].length);
    if (!tokens.length) return;

    // balance carried forward lines seed the running balance but are not transactions
    if (BALANCE_LINE.test(rest) && tokens.length === 1) {
      flush();
      prevBalance = parseAmount(tokens[0][0]);
      return;
    }

    const last = tokens[tokens.length - 1];
    const hasBalance = tokens.length >= 2;
    const amtTok = hasBalance ? tokens[tokens.length - 2] : last;
    const balTok = hasBalance ? last : null;
    const firstAmountPos = tokens[hasBalance ? tokens.length - 2 : tokens.length - 1].index! - dm[0].length;
    rest = rest.slice(0, Math.max(0, firstAmountPos));

    let amt = parseAmount(amtTok[0].replace(/\+$/, ''));
    if (amt === null || amt === 0) return;
    let dir: 'IN' | 'OUT' | null = null;
    const raw = amtTok[0];
    if (/(DR|-)$/i.test(raw.trim()) || /^\(.*\)$/.test(raw.trim()) || amt < 0) dir = 'OUT';
    else if (/(CR|\+)$/i.test(raw.trim())) dir = 'IN';
    const bal = balTok ? parseAmount(balTok[0]) : null;
    if (!dir && bal !== null && prevBalance !== null) {
      dir = bal - prevBalance >= 0 ? 'IN' : 'OUT';
    }
    if (!dir) {
      dir = /\b(cr|credit|deposit|received|payment from|transfer from|collection)\b/i.test(rest) ? 'IN' : 'OUT';
      warnings.push(`Line ${idx + 1}: direction guessed from keywords`);
    }
    if (bal !== null) prevBalance = bal;

    flush();
    current = {
      rowIndex: idx, date, details: rest.replace(/\s+/g, ' ').trim(), direction: dir, amount: Math.abs(amt), categoryHint: null,
    };
  });
  flush();
  return { rows, warnings };
}

export async function extractPdfText(buf: Buffer): Promise<string> {
  // import the lib file directly: pdf-parse's index.js runs a debug routine when not in a CJS main module
  const mod = await import('pdf-parse/lib/pdf-parse.js');
  const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default;
  const res = await pdfParse(buf);
  return res.text;
}
