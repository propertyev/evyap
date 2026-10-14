// Loads the acceptance-test fixture (spec §9) as demo data for FY2026.
import type { PrismaClient } from '@prisma/client';
import { txHash } from './hash';

export async function seedDemoData(prisma: PrismaClient, companyId: string) {
  const year = 2026;
  const fy = await prisma.fiscalYear.upsert({
    where: { companyId_year: { companyId, year } },
    update: {},
    create: { companyId, year },
  });
  await prisma.fiscalYear.update({
    where: { id: fy.id },
    data: {
      openStock: 100000n, openCash: 2000000n, openTradeDebtors: 300000n, openAdvances: 50000n,
      openCapital: 1700000n, openPL: 450000n, openLongTermLoan: 300000n, openCreditors: 200000n,
      closingStock: 150000n,
    },
  });
  await prisma.fixedAsset.upsert({
    where: { fiscalYearId_category: { fiscalYearId: fy.id, category: 'Kelengkapan Komputer' } },
    update: {},
    create: { fiscalYearId: fy.id, category: 'Kelengkapan Komputer', openingNBV: 200000n, depreciationRatePct: 20 },
  });

  const cats = await prisma.category.findMany({ where: { companyId } });
  const id = (n: string) => cats.find((c) => c.name === n)!.id;
  const rows: [string, 'IN' | 'OUT', string, string, number, string?][] = [
    ['2026-01-02', 'IN', 'Sales', 'Payment from customer', 850000],
    ['2026-01-05', 'OUT', 'Bil Air & Elektrik', 'TNB electricity', 41260],
    ['2026-02-10', 'OUT', 'Kelengkapan Komputer', 'Laptop purchase', 300000],
    ['2026-02-11', 'IN', 'Debtor', 'Payment from ABC Sdn Bhd', 250000, 'ABC Sdn Bhd'],
    ['2026-02-12', 'OUT', 'Ambilan', 'Owner drawing', 100000],
    ['2026-02-13', 'OUT', 'Stok / Bahan Mentah', 'Raw material', 230000],
    ['2026-03-14', 'OUT', 'Creditor', 'Pay supplier', 150000],
    ['2026-03-15', 'IN', 'Loan', 'Loan disbursement', 1000000],
    ['2026-03-16', 'OUT', 'Security Deposits', 'Rental deposit', 90000],
  ];
  for (const [date, direction, category, details, amount, party] of rows) {
    const hash = txHash(date, amount, direction, details);
    await prisma.transaction.upsert({
      where: { companyId_hash: { companyId, hash } },
      update: {},
      create: {
        companyId, date, year, direction, categoryId: id(category), details, amount: BigInt(amount),
        partyName: party ?? null, source: 'MANUAL', hash,
      },
    });
  }
  const n = await prisma.debtorCreditor.count({ where: { companyId, year } });
  if (n === 0) {
    await prisma.debtorCreditor.createMany({
      data: [
        { companyId, date: '2026-01-20', year, type: 'DEBTOR', partyName: 'ABC Sdn Bhd', details: 'Credit sale', amount: 400000n },
        { companyId, date: '2026-03-01', year, type: 'DEBTOR', partyName: 'XYZ Bhd', details: 'Invoice INV-2026-0001', amount: 120000n },
      ],
    });
  }
}
