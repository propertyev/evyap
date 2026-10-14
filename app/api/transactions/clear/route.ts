import { z } from 'zod';
import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { clearYear } from '@/lib/services/ledger';

export const POST = api(async ({ ctx }, req) => {
  const { year, confirmation } = z.object({ year: z.number().int(), confirmation: z.string() }).parse(await json(req));
  return clearYear(prisma, ctx, year, confirmation);
});
