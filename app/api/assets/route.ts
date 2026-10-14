import { z } from 'zod';
import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { assetInput, saveAsset } from '@/lib/services/setup';

export const PUT = api(async ({ ctx }, req) => {
  const body = z.object({ year: z.number().int() }).extend({ asset: assetInput }).parse(await json(req));
  await saveAsset(prisma, ctx, body.year, body.asset);
  return { ok: true };
});
