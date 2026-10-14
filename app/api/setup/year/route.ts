import { z } from 'zod';
import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { fiscalYearInput, updateFiscalYear } from '@/lib/services/setup';

export const PUT = api(async ({ ctx }, req) => {
  const body = z.object({ year: z.number().int() }).extend({ figures: fiscalYearInput }).parse(await json(req));
  await updateFiscalYear(prisma, ctx, body.year, body.figures);
  return { ok: true };
});
