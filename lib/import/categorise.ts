// Auto-categorisation: category column -> learned rules -> default keyword rules -> fallback.
import { FALLBACK } from '../rules';
import type { Direction } from '../categories';

export interface CategoryLite {
  name: string;
  direction: Direction;
}

export interface RuleLite {
  id?: string;
  pattern: string;
  isRegex: boolean;
  category: string; // category NAME
  direction: Direction;
  priority: number;
}

export type CategoriseSource = 'column' | 'rule' | 'learned' | 'fallback';

export interface Categorised {
  category: string;
  direction: Direction;
  source: CategoriseSource;
}

interface Compiled extends RuleLite {
  test: (s: string) => boolean;
}

export function compileRules(rules: RuleLite[]): Compiled[] {
  return [...rules]
    .sort((a, b) => a.priority - b.priority)
    .map((r) => {
      let test: (s: string) => boolean;
      if (r.isRegex) {
        try {
          const re = new RegExp(r.pattern, 'i');
          test = (s) => re.test(s);
        } catch {
          test = () => false;
        }
      } else {
        const kw = r.pattern.toLowerCase();
        test = (s) => s.toLowerCase().includes(kw);
      }
      return { ...r, test };
    });
}

/** Match a free-text category cell to one of the known categories. */
export function matchCategoryName(text: string, categories: CategoryLite[]): CategoryLite | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const exact = categories.find((c) => c.name.toLowerCase() === t);
  if (exact) return exact;
  if (t.length >= 4) {
    const contains = categories.find((c) => c.name.toLowerCase().includes(t));
    if (contains) return contains;
    const within = categories.find((c) => c.name.length >= 4 && t.includes(c.name.toLowerCase()));
    if (within) return within;
  }
  return null;
}

export function categorise(
  details: string,
  direction: Direction,
  hint: string | null,
  categories: CategoryLite[],
  rules: Compiled[],
): Categorised {
  const names = new Map(categories.map((c) => [c.name, c]));

  if (hint) {
    const m = matchCategoryName(hint, categories);
    if (m) return { category: m.name, direction: m.direction, source: 'column' };
  }
  const text = details || hint || '';
  for (const r of rules) {
    if (r.direction !== direction) continue;
    if (!names.has(r.category)) continue;
    if (r.test(text) || (hint && r.test(hint))) {
      return { category: r.category, direction, source: r.priority < 100 ? 'learned' : 'rule' };
    }
  }
  return { category: FALLBACK[direction], direction, source: 'fallback' };
}

const STOP = new Set([
  'the', 'and', 'for', 'to', 'from', 'payment', 'pymt', 'pay', 'transfer', 'trf', 'ibg', 'duitnow', 'qr', 'ref',
  'inv', 'invoice', 'bill', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'sdn', 'bhd', 'online', 'cr', 'dr', 'debit', 'credit', 'cash', 'chq', 'cheque', 'fpx', 'ibk', 'giro',
]);

/** Derive a short, stable keyword from a transaction description for learned rules. */
export function learnKeyword(details: string): string | null {
  const tokens = details
    .toLowerCase()
    .replace(/[^a-z0-9&\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOP.has(t) && !/\d{3,}/.test(t));
  if (!tokens.length) return null;
  return tokens.slice(0, 2).join(' ');
}
