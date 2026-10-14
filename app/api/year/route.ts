import { NextResponse } from 'next/server';
import { z } from 'zod';
import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getOrCreateFiscalYear } from '@/lib/services/years';

// Select the financial year (cookie). Creates the year if it does not exist yet.
export const POST = api(async ({ ctx }, req) => {
  const { year } = z.object({ year: z.number().int().min(1990).max(2100) }).parse(await json(req));
  await getOrCreateFiscalYear(prisma, ctx.companyId, year);
  const res = NextResponse.json({ year });
  res.cookies.set('fy', String(year), { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  return res;
});
