import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { updateCompany } from '@/lib/services/setup';

export const PUT = api(async ({ ctx }, req) => {
  await updateCompany(prisma, ctx, await json(req));
  return { ok: true };
});
