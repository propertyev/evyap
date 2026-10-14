import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { createEntry, listEntries, listParties } from '@/lib/services/dc';

export const GET = api(async ({ ctx }, req) => {
  const u = new URL(req.url);
  const m = u.searchParams.get('month');
  const year = Number(u.searchParams.get('year'));
  const [rows, parties] = await Promise.all([
    listEntries(prisma, ctx.companyId, year, m === null || m === 'all' ? undefined : Number(m)),
    listParties(prisma, ctx.companyId),
  ]);
  return { rows, parties };
});

export const POST = api(async ({ ctx }, req) => ({ id: await createEntry(prisma, ctx, await json(req)) }));
