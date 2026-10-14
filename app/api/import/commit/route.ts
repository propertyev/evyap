import { api, json, selectedYear } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { commitImport, type CommitInput } from '@/lib/services/import';

export const POST = api(async ({ ctx }, req) => {
  const body = await json<CommitInput>(req);
  const { year } = await selectedYear(ctx.companyId);
  const result = await commitImport(prisma, ctx, body, year);
  const res = NextResponse.json(result);
  if (result.switchToYear) {
    res.cookies.set('fy', String(result.switchToYear), { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
});
