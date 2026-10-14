// Amount parsing for bank statements. Returns signed integer sen, or null when not a number.
import { toSen } from '../money';

/**
 * Rules: strip RM / commas / spaces; (x), leading "-" and trailing "-" and "DR" mean negative;
 * "CR" and leading "+" mean positive.
 */
export function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return toSen(value);
  let s = String(value).trim();
  if (!s) return null;
  let sign = 1;
  if (/\bDR\b\.?$/i.test(s) || /\d\s*DR$/i.test(s)) {
    sign = -1;
    s = s.replace(/\s*DR\.?$/i, '');
  } else if (/\bCR\b\.?$/i.test(s) || /\d\s*CR$/i.test(s)) {
    s = s.replace(/\s*CR\.?$/i, '');
  }
  s = s.replace(/^\+/, '');
  const v = toSen(s);
  if (v === null) return null;
  return sign * v;
}

/** True when the cell looks like a number (used to tell amount cells from text). */
export function looksNumeric(value: unknown): boolean {
  return parseAmount(value) !== null;
}
