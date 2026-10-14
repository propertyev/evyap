import { z } from 'zod';
import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { loadTaxReport, saveTaxSettings, taxSettingsInput } from '@/lib/services/setup';

export const GET = api(async ({ ctx }, req) => {
  const year = Number(new URL(req.url).searchParams.get('year'));
  return loadTaxReport(prisma, ctx.companyId, year);
});

export const PUT = api(async ({ ctx }, req) => {
  const body = z.object({ year: z.number().int() }).extend({ settings: taxSettingsInput }).parse(await json(req));
  await saveTaxSettings(prisma, ctx, body.year, body.settings);
  return { ok: true };
});
