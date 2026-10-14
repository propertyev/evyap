import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { createTransaction, listTransactions, type TxInput } from '@/lib/services/ledger';

export const GET = api(async ({ ctx }, req) => {
  const u = new URL(req.url);
  const year = Number(u.searchParams.get('year'));
  const m = u.searchParams.get('month');
  return { rows: await listTransactions(prisma, ctx.companyId, year, m === null || m === 'all' ? undefined : Number(m)) };
});

export const POST = api(async ({ ctx }, req) => {
  const id = await createTransaction(prisma, ctx, await json<TxInput>(req));
  return { id };
});
