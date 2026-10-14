import * as XLSX from 'xlsx';
import { afterAll, describe, expect, it } from 'vitest';
import { commitImport, previewImport, undoImport, type PreviewRow } from '@/lib/services/import';
import { closeYear, computeCompanyYear } from '@/lib/services/years';
import { saveAsset, updateFiscalYear } from '@/lib/services/setup';
import { createTransaction, deleteTransaction } from '@/lib/services/ledger';
import { createEntry } from '@/lib/services/dc';
import { asRole, newCompany, prisma } from './helpers';

afterAll(() => prisma.$disconnect());

/** The §9 fixture as a bank-statement workbook. Category left blank unless the spec states one. */
function fixtureWorkbook(): Buffer {
  const rows = [
    ['EVyap Bank Statement', null, null, null, null],
    ['Account 1234', null, null, null, null],
    ['Date', 'Description', 'Debit', 'Credit', 'Category'],
    ['02/01/2026', 'Payment from customer', null, 8500, null],
    ['05/01/2026', 'TNB electricity', 412.6, null, null],
    ['10/02/2026', 'Laptop purchase', 3000, null, 'Kelengkapan Komputer'],
    ['11/02/2026', 'Payment from ABC Sdn Bhd', null, 2500, 'Debtor'],
    ['12/02/2026', 'Owner drawing', 1000, null, 'Ambilan'],
    ['13/02/2026', 'Raw material', 2300, null, null],
    ['14/03/2026', 'Pay supplier', 1500, null, 'Creditor'],
    ['15/03/2026', 'Loan disbursement', null, 10000, null],
    ['16/03/2026', 'Rental deposit', 900, null, 'Security Deposits'],
    ['Total', null, 9112.6, 21000, null],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Statement');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const toCommit = (rows: PreviewRow[]) =>
  rows.map((r) => ({
    date: r.date, details: r.details, direction: r.direction, amount: r.amount, category: r.category, suggested: r.suggested,
    partyName: r.category === 'Debtor' ? 'ABC Sdn Bhd' : r.category === 'Creditor' ? 'Supplier Sdn Bhd' : undefined,
  }));

async function setupFixtureCompany() {
  const ctx = await newCompany();
  await updateFiscalYear(prisma, ctx, 2026, {
    closingStock: 150000, openStock: 100000, openCapital: 1700000, openPL: 450000, openCash: 2000000,
    openLongTermLoan: 300000, openOtherLTLiab: 0, openAdvances: 50000, openTradeDebtors: 300000, openCreditors: 200000,
  });
  await saveAsset(prisma, ctx, 2026, { category: 'Kelengkapan Komputer', openingNBV: 200000, cost: 0, ratePct: 20 });
  await createEntry(prisma, ctx, { date: '2026-01-20', type: 'DEBTOR', partyName: 'ABC Sdn Bhd', details: '', amount: 400000 });
  await createEntry(prisma, ctx, { date: '2026-03-01', type: 'DEBTOR', partyName: 'XYZ Bhd', details: 'Invoice', amount: 120000 });
  return ctx;
}

describe('import pipeline end-to-end (spec §9)', () => {
  it('detects header after junk rows, skips the total row, and auto-categorises', async () => {
    const ctx = await newCompany();
    const [sheet] = await previewImport(prisma, ctx.companyId, [{ name: 'stmt.xlsx', buffer: fixtureWorkbook() }]);
    expect(sheet.rows).toHaveLength(9);
    const by = (d: string) => sheet.rows.find((r) => r.details.startsWith(d))!;
    expect(by('TNB').category).toBe('Bil Air & Elektrik');
    expect(by('Raw material').category).toBe('Stok / Bahan Mentah');
    expect(by('Loan disbursement').category).toBe('Loan');
    expect(by('Payment from customer').category).toBe('Sales');
    expect(by('Laptop').category).toBe('Kelengkapan Komputer');
    expect(by('Owner drawing').direction).toBe('OUT');
    expect(by('Payment from ABC').direction).toBe('IN');
    expect(sheet.columnMap).toMatchObject({ date: 0, details: 1, out: 2, in: 3, category: 4 });
  });

  it('commits, balances, skips duplicates on re-import and restores totals on undo', async () => {
    const ctx = await setupFixtureCompany();
    const file = { name: 'stmt.xlsx', buffer: fixtureWorkbook() };

    const before = await computeCompanyYear(prisma, ctx.companyId, 2026);
    const [sheet] = await previewImport(prisma, ctx.companyId, [file]);
    const res = await commitImport(prisma, ctx, { fileName: file.name, fileType: 'xlsx', columnMap: sheet.columnMap as Record<string, number>, rows: toCommit(sheet.rows) });
    expect(res.added).toBe(9);

    const after = await computeCompanyYear(prisma, ctx.companyId, 2026);
    expect(after.cash).toBe(3188740);
    expect(after.totalAssets).toBe(4488740);
    expect(after.tally).toBe(0);
    expect(after.cashFlow.closing).toBe(after.cash);
    expect(after.trialBalance.balanced).toBe(true);
    expect(after.netProfit).toBe(1088740);
    expect(after.ppe).toBe(440000);
    expect(after.tradeDebtors).toBe(570000);
    expect(after.advances).toBe(140000);
    expect(after.creditors).toBe(50000);
    expect(after.longTermLoans).toBe(1300000);

    // re-import: every row is flagged duplicate, commit adds nothing
    const [again] = await previewImport(prisma, ctx.companyId, [file]);
    expect(again.rows.every((r) => r.duplicate)).toBe(true);
    const res2 = await commitImport(prisma, ctx, { fileName: file.name, fileType: 'xlsx', columnMap: {}, rows: toCommit(again.rows) });
    expect(res2.added).toBe(0);
    expect(res2.skipped).toBe(9);
    expect((await computeCompanyYear(prisma, ctx.companyId, 2026)).cash).toBe(3188740);

    // undo the first batch -> back to the previous totals
    await undoImport(prisma, ctx, res.batchId);
    const undone = await computeCompanyYear(prisma, ctx.companyId, 2026);
    expect(undone.cash).toBe(before.cash);
    expect(undone.txCount).toBe(0);
    await expect(undoImport(prisma, ctx, res.batchId)).rejects.toThrow(/already undone/i);
  });

  it('opening capital 15,000 produces "Beza 2,000.00"', async () => {
    const ctx = await setupFixtureCompany();
    const [sheet] = await previewImport(prisma, ctx.companyId, [{ name: 's.xlsx', buffer: fixtureWorkbook() }]);
    await commitImport(prisma, ctx, { fileName: 's.xlsx', fileType: 'xlsx', columnMap: {}, rows: toCommit(sheet.rows) });
    await updateFiscalYear(prisma, ctx, 2026, {
      closingStock: 150000, openStock: 100000, openCapital: 1500000, openPL: 450000, openCash: 2000000,
      openLongTermLoan: 300000, openOtherLTLiab: 0, openAdvances: 50000, openTradeDebtors: 300000, openCreditors: 200000,
    });
    expect(Math.abs((await computeCompanyYear(prisma, ctx.companyId, 2026)).tally)).toBe(200000);
  });

  it('learns from a correction and creates a missing fiscal year', async () => {
    const ctx = await newCompany();
    const csv = 'Tarikh,Keterangan,Amaun\n05/06/2031,ZXQ TRADING ORDER 1234,"RM 45.00-"\n';
    const [sheet] = await previewImport(prisma, ctx.companyId, [{ name: 'a.csv', buffer: Buffer.from(csv) }]);
    expect(sheet.rows[0]).toMatchObject({ direction: 'OUT', amount: 4500, category: 'Lain-lain Perbelanjaan' });
    const rows = [{ ...toCommit(sheet.rows)[0], category: 'Entertainment / Hiburan' }];
    const res = await commitImport(prisma, ctx, { fileName: 'a.csv', fileType: 'csv', columnMap: {}, rows }, 2026);
    expect(res.learned).toBe(1);
    expect(res.createdYears).toEqual([2031]);
    expect(res.switchToYear).toBe(2031);
    const [next] = await previewImport(prisma, ctx.companyId, [{ name: 'b.csv', buffer: Buffer.from('Date,Details,Amount\n01/07/2031,ZXQ TRADING ORDER 99,-20\n') }]);
    expect(next.rows[0]).toMatchObject({ category: 'Entertainment / Hiburan', source: 'learned' });
  });
});

describe('roles, locking and year-end close', () => {
  it('STAFF can add but not delete; locked years are read-only', async () => {
    const owner = await newCompany();
    const staff = asRole(owner, 'STAFF');
    const id = await createTransaction(prisma, staff, { date: '2026-04-01', direction: 'IN', category: 'Sales', details: 'x', amount: 10000 });
    await expect(deleteTransaction(prisma, staff, id)).rejects.toThrow(/cannot perform/i);
    await updateFiscalYear(prisma, owner, 2026, {
      closingStock: 0, openStock: 0, openCapital: 0, openPL: 0, openCash: 0, openLongTermLoan: 0, openOtherLTLiab: 0,
      openAdvances: 0, openTradeDebtors: 0, openCreditors: 0,
    });
    await closeYear(prisma, owner, 2026, { force: true });
    await expect(
      createTransaction(prisma, owner, { date: '2026-05-01', direction: 'IN', category: 'Sales', details: 'late', amount: 100 }),
    ).rejects.toThrow(/locked/i);
    await expect(closeYear(prisma, asRole(owner, 'STAFF'), 2027)).rejects.toThrow(/cannot perform/i);
  });

  it('closing the year carries balances forward and the opening tally balances', async () => {
    const ctx = await setupFixtureCompany();
    const [sheet] = await previewImport(prisma, ctx.companyId, [{ name: 's.xlsx', buffer: fixtureWorkbook() }]);
    await commitImport(prisma, ctx, { fileName: 's.xlsx', fileType: 'xlsx', columnMap: {}, rows: toCommit(sheet.rows) });
    const out = await closeYear(prisma, ctx, 2026);
    expect(out.nextYear).toBe(2027);
    const fy27 = await prisma.fiscalYear.findUnique({ where: { companyId_year: { companyId: ctx.companyId, year: 2027 } } });
    expect(Number(fy27!.openCash)).toBe(3188740);
    expect(Number(fy27!.openCapital)).toBe(1600000);
    expect(Number(fy27!.openPL)).toBe(450000 + 1088740);
    expect(Number(fy27!.openStock)).toBe(150000);
    const y27 = await computeCompanyYear(prisma, ctx.companyId, 2027);
    expect(y27.openingTally.difference).toBe(0);
    expect(y27.tally).toBe(0);
    expect(y27.assets.find((a) => a.category === 'Kelengkapan Komputer')!.openingNBV).toBe(440000);
    expect(y27.ppe).toBe(380000); // 440,000 less a full year at 20% of 300,000 cost
    await expect(closeYear(prisma, ctx, 2026)).rejects.toThrow(/already closed/i);
  });
});
