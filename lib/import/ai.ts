// Optional AI categorisation (feature flag AI_CATEGORISE=true). Only descriptions of rows that no rule
// matched are sent, and the answer is constrained to the company's own category list.
import type { Direction } from '../categories';

export const aiEnabled = () => process.env.AI_CATEGORISE === 'true' && !!process.env.ANTHROPIC_API_KEY;

export interface AiItem {
  id: number;
  details: string;
  direction: Direction;
}

export async function suggestCategories(
  items: AiItem[],
  categories: { name: string; direction: Direction }[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!items.length) return out;
  const allowed = new Map<Direction, string[]>([
    ['IN', categories.filter((c) => c.direction === 'IN').map((c) => c.name)],
    ['OUT', categories.filter((c) => c.direction === 'OUT').map((c) => c.name)],
  ]);

  const prompt =
    'You categorise Malaysian small-business bank transactions. For each item choose exactly one category from the ' +
    'list for its direction (IN = money received, OUT = money paid). Reply with ONLY a JSON object mapping item id to ' +
    'category name; use "" if none fits.\n' +
    `IN categories: ${JSON.stringify(allowed.get('IN'))}\n` +
    `OUT categories: ${JSON.stringify(allowed.get('OUT'))}\n` +
    `Items: ${JSON.stringify(items.slice(0, 200).map((i) => ({ id: i.id, direction: i.direction, description: i.details.slice(0, 200) })))}`;

  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) return out;
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return out;
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    return out;
  }
  for (const item of items) {
    const name = parsed[String(item.id)];
    if (name && allowed.get(item.direction)?.includes(name)) out.set(item.id, name);
  }
  return out;
}
