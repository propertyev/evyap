// Money helpers. All amounts in the system are integer SEN (1 RM = 100 sen).

/** Parse a user/Excel number or numeric string (RM) into integer sen. Returns null if unparseable. */
export function toSen(input: unknown): number | null {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'bigint') return Number(input) * 100;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return Math.round(parseFloat((input * 100).toPrecision(15)));
  }
  let s = String(input).trim().replace(/RM/gi, '').replace(/[,\s]/g, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    neg = !neg;
    s = s.slice(1);
  }
  if (s.endsWith('-')) {
    neg = !neg;
    s = s.slice(0, -1);
  }
  const m = s.match(/^(\d*)(?:\.(\d*))?$/);
  if (!m || (m[1] === '' && (m[2] === undefined || m[2] === ''))) return null;
  const whole = m[1] === '' ? 0 : parseInt(m[1], 10);
  const fracRaw = (m[2] ?? '').padEnd(3, '0');
  let frac = parseInt(fracRaw.slice(0, 2), 10);
  if (parseInt(fracRaw[2], 10) >= 5) frac += 1; // round half up at the 3rd decimal
  const sen = whole * 100 + frac;
  return neg ? -sen : sen;
}

/** Format integer sen as "1,234.56"; negatives as "(1,234.56)". */
export function fmt(sen: number | bigint | null | undefined, opts: { dash?: boolean } = {}): string {
  const n = typeof sen === 'bigint' ? Number(sen) : sen ?? 0;
  if (opts.dash && n === 0) return '-';
  const abs = Math.abs(Math.round(n));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const body = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + frac;
  return n < 0 ? `(${body})` : body;
}

/** Plain decimal string for inputs/CSV: 123456 -> "1234.56" */
export function senToDecimal(sen: number | bigint): string {
  const n = typeof sen === 'bigint' ? Number(sen) : sen;
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Percentage of an amount, rounded to the nearest sen (half away from zero). */
export function pct(sen: number, ratePct: number): number {
  const v = (sen * ratePct) / 100;
  return v < 0 ? -Math.round(-v) : Math.round(v);
}

/** Split a total into n parts that sum exactly to the total (remainder spread from the end). */
export function spread(total: number, n: number): number[] {
  const base = Math.trunc(total / n);
  const out = Array<number>(n).fill(base);
  let rem = total - base * n;
  for (let i = n - 1; rem !== 0 && i >= 0; i--) {
    const step = rem > 0 ? 1 : -1;
    out[i] += step;
    rem -= step;
  }
  return out;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
