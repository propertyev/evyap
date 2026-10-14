import { cache } from 'react';
import { prisma } from './db';
import { computeYear } from './engine';
import { requireSession, selectedYear } from './session';
import { getOrCreateFiscalYear, loadYearInput } from './services/years';
import type { CatInfo } from './statements';

/** Everything a report page needs, loaded once per request. */
export const getPage = cache(async () => {
  const s = await requireSession();
  const { year, years } = await selectedYear(s.ctx.companyId);
  const [company, fy, input] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: s.ctx.companyId } }),
    getOrCreateFiscalYear(prisma, s.ctx.companyId, year),
    loadYearInput(prisma, s.ctx.companyId, year),
  ]);
  const result = computeYear(input);
  const cats: CatInfo[] = (input.categories ?? []).map((c) => ({ name: c.name, group: c.group }));
  const allYears = years.includes(year) ? years : [...years, year].sort();
  return {
    ctx: s.ctx, user: s.user, company, year, years: allYears, locked: fy.locked, fy, input, result, cats,
  };
});
