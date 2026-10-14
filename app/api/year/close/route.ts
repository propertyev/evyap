import { z } from 'zod';
import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { closeYear } from '@/lib/services/years';

export const POST = api(async ({ ctx }, req) => {
  const { year, force } = z.object({ year: z.number().int(), force: z.boolean().optional() }).parse(await json(req));
  return closeYear(prisma, ctx, year, { force });
});
