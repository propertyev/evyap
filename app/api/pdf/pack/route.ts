import { api } from '@/lib/session';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { computeYear } from '@/lib/engine';
import { renderPack } from '@/lib/pdf/pack';
import { loadYearInput } from '@/lib/services/years';

export const runtime = 'nodejs';

export const GET = api(async ({ ctx }, req) => {
  const year = Number(new URL(req.url).searchParams.get('year'));
  if (!year) throw new AppError('BAD_YEAR', 'year is required', 400);
  const [company, input] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } }),
    loadYearInput(prisma, ctx.companyId, year),
  ]);
  const buf = await renderPack({
    companyName: company.name, ssmNo: company.ssmNo, year, result: computeYear(input),
    cats: (input.categories ?? []).map((c) => ({ name: c.name, group: c.group })),
  });
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${company.name.replace(/\W+/g, '_')}_Management_Accounts_${year}.pdf"`,
    },
  });
});
