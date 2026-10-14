import { createHash } from 'node:crypto';

export function normDetails(details: string): string {
  return details.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Dedup key: date | amount | direction | details (+ occurrence index for genuinely repeated rows). */
export function txHash(date: string, amountSen: number, direction: 'IN' | 'OUT', details: string, occurrence = 0): string {
  const base = `${date}|${amountSen}|${direction}|${normDetails(details)}`;
  const h = createHash('sha1').update(base).digest('hex');
  return occurrence > 0 ? `${h}#${occurrence}` : h;
}
