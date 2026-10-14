// Company profile, Last Year Figure, closing stock, fixed assets and tax settings.
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { audit } from '../audit';
import { FA_NAMES } from '../categories';
import { AppError } from '../errors';
import { assertCan } from '../permissions';
import { computeTax, type TaxResult } from '../tax';
import { loadTaxConfig } from '../tax-config';
import { assertYearsUnlocked, computeCompanyYear, getOrCreateFiscalYear } from './years';
import { big, num, type Ctx, type Db } from './types';

export const companyInput = z.object({
  name: z.string().trim().min(1).max(200),
  ssmNo: z.string().max(60).default(''),
  address: z.string().max(500).default(''),
  phone: z.string().max(60).default(''),
  email: z.string().max(200).default(''),
  logoUrl: z.string().max(700_000).default(''), // data: URI (≤ ~500 KB image)
});

export async function updateCompany(prisma: PrismaClient, ctx: Ctx, raw: z.input<typeof companyInput>) {
  assertCan(ctx.role, 'settings:edit');
  const input = companyInput.parse(raw);
  if (input.logoUrl && !/^data:image\/(png|jpe?g|svg\+xml|webp);base64,/.test(input.logoUrl) && !/^https?:\/\//.test(input.logoUrl)) {
    throw new AppError('BAD_LOGO', 'Logo must be a PNG, JPG, SVG or WebP image.', 422);
  }
  const before = await prisma.company.findUnique({ where: { id: ctx.companyId } });
  await prisma.company.update({ where: { id: ctx.companyId }, data: input });
  await audit(prisma, ctx, 'COMPANY_UPDATE', 'Company', ctx.companyId, { ...before, logoUrl: before?.logoUrl ? '[logo]' : '' }, { ...input, logoUrl: input.logoUrl ? '[logo]' : '' });
}

const sen = z.number().int();
export const fiscalYearInput = z.object({
  closingStock: sen.min(0),
  openStock: sen, openCapital: sen, openPL: sen, openCash: sen,
  openLongTermLoan: sen, openOtherLTLiab: sen, openAdvances: sen, openTradeDebtors: sen, openCreditors: sen,
});
export type FiscalYearInput = z.infer<typeof fiscalYearInput>;

export async function updateFiscalYear(prisma: PrismaClient, ctx: Ctx, year: number, raw: FiscalYearInput) {
  assertCan(ctx.role, 'settings:edit');
  const input = fiscalYearInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    await assertYearsUnlocked(tx, ctx.companyId, [year]);
    const fy = await getOrCreateFiscalYear(tx, ctx.companyId, year);
    const data = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, big(v)]));
    await tx.fiscalYear.update({ where: { id: fy.id }, data });
    await audit(tx, ctx, 'FISCAL_YEAR_UPDATE', 'FiscalYear', fy.id, null, { year, ...input });
  });
}

export const assetInput = z.object({
  category: z.string().refine((c) => FA_NAMES.includes(c), 'Not a fixed-asset category'),
  openingNBV: sen.min(0),
  cost: sen.min(0),
  ratePct: z.number().min(0).max(100),
});
export type AssetInput = z.infer<typeof assetInput>;

export async function saveAsset(prisma: PrismaClient, ctx: Ctx, year: number, raw: AssetInput) {
  assertCan(ctx.role, 'settings:edit');
  const input = assetInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    await assertYearsUnlocked(tx, ctx.companyId, [year]);
    const fy = await getOrCreateFiscalYear(tx, ctx.companyId, year);
    const row = await tx.fixedAsset.upsert({
      where: { fiscalYearId_category: { fiscalYearId: fy.id, category: input.category } },
      update: { openingNBV: big(input.openingNBV), cost: big(input.cost), depreciationRatePct: input.ratePct },
      create: {
        fiscalYearId: fy.id, category: input.category, openingNBV: big(input.openingNBV), cost: big(input.cost),
        depreciationRatePct: input.ratePct,
      },
    });
    await audit(tx, ctx, 'ASSET_UPSERT', 'FixedAsset', row.id, null, input);
  });
}

export const taxSettingsInput = z.object({
  zakatPct: z.number().min(0).max(100),
  zakatPaid: sen.min(0),
  reliefs: z.record(z.string(), sen.min(0)).default({}),
  childCounts: z.record(z.string(), z.number().int().min(0).max(50)).default({}),
});
export type TaxSettingsInput = z.infer<typeof taxSettingsInput>;

export async function saveTaxSettings(prisma: PrismaClient, ctx: Ctx, year: number, raw: TaxSettingsInput) {
  assertCan(ctx.role, 'settings:edit');
  const input = taxSettingsInput.parse(raw);
  const fy = await getOrCreateFiscalYear(prisma, ctx.companyId, year);
  await assertYearsUnlocked(prisma, ctx.companyId, [year]);
  await prisma.taxSetting.upsert({
    where: { fiscalYearId: fy.id },
    update: {
      zakatPct: input.zakatPct, zakatPaid: big(input.zakatPaid),
      reliefs: JSON.stringify(input.reliefs), childCounts: JSON.stringify(input.childCounts),
    },
    create: {
      fiscalYearId: fy.id, zakatPct: input.zakatPct, zakatPaid: big(input.zakatPaid),
      reliefs: JSON.stringify(input.reliefs), childCounts: JSON.stringify(input.childCounts),
    },
  });
  await audit(prisma, ctx, 'TAX_SETTINGS_UPDATE', 'TaxSetting', fy.id, null, input);
}

export interface TaxReport {
  result: TaxResult;
  zakatPct: number;
  claims: Record<number, number>;
  childCounts: Record<number, number>;
}

export async function loadTaxReport(db: Db, companyId: string, year: number): Promise<TaxReport> {
  const fy = await getOrCreateFiscalYear(db, companyId, year);
  const [setting, cfg, y] = await Promise.all([
    db.taxSetting.findUnique({ where: { fiscalYearId: fy.id } }),
    loadTaxConfig(db as PrismaClient, year),
    computeCompanyYear(db, companyId, year),
  ]);
  const claims = Object.fromEntries(
    Object.entries(JSON.parse(setting?.reliefs ?? '{}') as Record<string, number>).map(([k, v]) => [+k, v]),
  );
  const childCounts = Object.fromEntries(
    Object.entries(JSON.parse(setting?.childCounts ?? '{}') as Record<string, number>).map(([k, v]) => [+k, v]),
  );
  const zakatPct = setting?.zakatPct ?? 2.5;
  const result = computeTax({
    pbt: y.netProfit, zakatPct, zakatPaid: num(setting?.zakatPaid), reliefs: cfg.reliefs, claims, childCounts, bands: cfg.bands,
  });
  return { result, zakatPct, claims, childCounts };
}
