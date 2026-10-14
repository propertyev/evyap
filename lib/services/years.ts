// Fiscal-year loading, locking and year-end close.
import { AppError } from '../errors';
import { audit } from '../audit';
import type { Group } from '../categories';
import { carryForward, computeYear, type EngineInput, type YearResult } from '../engine';
import { assertCan } from '../permissions';
import { big, num, type Ctx, type Db } from './types';

export async function getOrCreateFiscalYear(db: Db, companyId: string, year: number) {
  return db.fiscalYear.upsert({
    where: { companyId_year: { companyId, year } },
    update: {},
    create: { companyId, year },
  });
}

export async function listYears(db: Db, companyId: string): Promise<number[]> {
  const ys = await db.fiscalYear.findMany({ where: { companyId }, select: { year: true }, orderBy: { year: 'asc' } });
  return ys.map((y) => y.year);
}

export async function assertYearsUnlocked(db: Db, companyId: string, years: number[]) {
  const unique = [...new Set(years)];
  if (!unique.length) return;
  const locked = await db.fiscalYear.findMany({
    where: { companyId, year: { in: unique }, locked: true }, select: { year: true },
  });
  if (locked.length) {
    throw new AppError(
      'YEAR_LOCKED',
      `Financial year ${locked.map((l) => l.year).join(', ')} is locked and read-only.`,
      409,
    );
  }
}

export async function loadYearInput(db: Db, companyId: string, year: number): Promise<EngineInput> {
  const [fy, cats, txs, dcs] = await Promise.all([
    getOrCreateFiscalYear(db, companyId, year),
    db.category.findMany({ where: { companyId } }),
    db.transaction.findMany({
      where: { companyId, year },
      select: { date: true, direction: true, categoryId: true, amount: true },
    }),
    db.debtorCreditor.findMany({ where: { companyId, year }, select: { date: true, type: true, amount: true } }),
  ]);
  const assets = await db.fixedAsset.findMany({ where: { fiscalYearId: fy.id } });
  const nameById = new Map(cats.map((c) => [c.id, c.name]));
  return {
    year,
    closingStock: num(fy.closingStock),
    opening: {
      stock: num(fy.openStock), capital: num(fy.openCapital), pl: num(fy.openPL), cash: num(fy.openCash),
      longTermLoan: num(fy.openLongTermLoan), otherLTLiab: num(fy.openOtherLTLiab),
      advances: num(fy.openAdvances), tradeDebtors: num(fy.openTradeDebtors), creditors: num(fy.openCreditors),
    },
    fixedAssets: assets.map((a) => ({
      category: a.category, openingNBV: num(a.openingNBV), cost: num(a.cost), ratePct: a.depreciationRatePct,
    })),
    transactions: txs.map((t) => ({
      date: t.date, direction: t.direction as 'IN' | 'OUT', category: nameById.get(t.categoryId) ?? 'Lain-lain Perbelanjaan',
      amount: num(t.amount),
    })),
    debtorCreditors: dcs.map((d) => ({ date: d.date, type: d.type as 'DEBTOR' | 'CREDITOR', amount: num(d.amount) })),
    categories: cats.map((c) => ({ name: c.name, group: c.group as Group, code: c.accountCode })),
  };
}

export async function computeCompanyYear(db: Db, companyId: string, year: number): Promise<YearResult> {
  return computeYear(await loadYearInput(db, companyId, year));
}

export interface CloseResult {
  closedYear: number;
  nextYear: number;
  tally: number;
}

/** Locks `year` and creates/updates the next FiscalYear with opening balances carried forward. */
export async function closeYear(
  prisma: import('@prisma/client').PrismaClient, ctx: Ctx, year: number, opts: { force?: boolean } = {},
): Promise<CloseResult> {
  assertCan(ctx.role, 'year:close');
  return prisma.$transaction(async (tx) => {
    const fy = await getOrCreateFiscalYear(tx, ctx.companyId, year);
    if (fy.locked) throw new AppError('YEAR_LOCKED', `Year ${year} is already closed.`, 409);
    const input = await loadYearInput(tx, ctx.companyId, year);
    const result = computeYear(input);
    if (result.tally !== 0 && !opts.force) {
      throw new AppError(
        'NOT_TALLY',
        'The Balance Sheet does not tally. Fix the Last Year Figure / Trial Balance before closing the year.',
        409, { difference: result.tally },
      );
    }
    const cf = carryForward(result, input.opening);
    const nextYear = year + 1;
    const o = cf.opening;
    const data = {
      openStock: big(o.stock), openCapital: big(o.capital), openPL: big(o.pl), openCash: big(o.cash),
      openLongTermLoan: big(o.longTermLoan), openOtherLTLiab: big(o.otherLTLiab), openAdvances: big(o.advances),
      openTradeDebtors: big(o.tradeDebtors), openCreditors: big(o.creditors),
    };
    const next = await tx.fiscalYear.upsert({
      where: { companyId_year: { companyId: ctx.companyId, year: nextYear } },
      update: data,
      create: { companyId: ctx.companyId, year: nextYear, ...data },
    });
    for (const a of cf.assets) {
      if (a.openingNBV === 0 && a.cost === 0 && a.ratePct === 0) continue;
      await tx.fixedAsset.upsert({
        where: { fiscalYearId_category: { fiscalYearId: next.id, category: a.category } },
        update: { openingNBV: big(a.openingNBV), cost: big(a.cost), depreciationRatePct: a.ratePct },
        create: {
          fiscalYearId: next.id, category: a.category, openingNBV: big(a.openingNBV), cost: big(a.cost),
          depreciationRatePct: a.ratePct,
        },
      });
    }
    const prevTax = await tx.taxSetting.findUnique({ where: { fiscalYearId: fy.id } });
    await tx.taxSetting.upsert({
      where: { fiscalYearId: next.id },
      update: {},
      create: { fiscalYearId: next.id, zakatPct: prevTax?.zakatPct ?? 2.5 },
    });
    await tx.fiscalYear.update({ where: { id: fy.id }, data: { locked: true } });
    await audit(tx, ctx, 'YEAR_CLOSE', 'FiscalYear', fy.id, { year, locked: false }, { year, locked: true, nextYear, opening: o });
    return { closedYear: year, nextYear, tally: result.tally };
  });
}

export async function reopenYear(prisma: import('@prisma/client').PrismaClient, ctx: Ctx, year: number) {
  assertCan(ctx.role, 'year:reopen');
  const fy = await prisma.fiscalYear.findUnique({ where: { companyId_year: { companyId: ctx.companyId, year } } });
  if (!fy) throw new AppError('NOT_FOUND', 'Year not found', 404);
  await prisma.fiscalYear.update({ where: { id: fy.id }, data: { locked: false } });
  await audit(prisma, ctx, 'YEAR_REOPEN', 'FiscalYear', fy.id, { locked: true }, { locked: false });
}
