import { z } from 'zod';
import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { reopenYear } from '@/lib/services/years';

export const POST = api(async ({ ctx }, req) => {
  const { year } = z.object({ year: z.number().int() }).parse(await json(req));
  await reopenYear(prisma, ctx, year);
  return { ok: true };
});
