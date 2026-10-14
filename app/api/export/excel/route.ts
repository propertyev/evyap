import { api } from '@/lib/session';
import { prisma } from '@/lib/db';
import { buildWorkbook } from '@/lib/excel-export';
import { computeYear } from '@/lib/engine';
import { listInvoices } from '@/lib/services/invoices';
import { listTransactions } from '@/lib/services/ledger';
import { loadTaxReport } from '@/lib/services/setup';
import { loadYearInput } from '@/lib/services/years';
import { AppError } from '@/lib/errors';

export const runtime = 'nodejs';

export const GET = api(async ({ ctx }, req) => {
  const year = Number(new URL(req.url).searchParams.get('year'));
  if (!year) throw new AppError('BAD_YEAR', 'year is required', 400);
  const [company, input, txs, tax, invoices, dcs] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } }),
    loadYearInput(prisma, ctx.companyId, year),
    listTransactions(prisma, ctx.companyId, year),
    loadTaxReport(prisma, ctx.companyId, year),
    listInvoices(prisma, ctx.companyId),
    prisma.debtorCreditor.findMany({ where: { companyId: ctx.companyId, year }, orderBy: { date: 'asc' } }),
  ]);
  const result = computeYear(input);
  const buf = await buildWorkbook({
    companyName: company.name, ssmNo: company.ssmNo, year, result,
    cats: (input.categories ?? []).map((c) => ({ name: c.name, group: c.group })),
    transactions: txs.map((t) => ({
      date: t.date, category: t.category, details: t.details, direction: t.direction, amount: t.amount, partyName: t.partyName,
    })),
    debtorCreditors: dcs.map((d) => ({ date: d.date, type: d.type, partyName: d.partyName, details: d.details, amount: Number(d.amount) })),
    invoices: invoices.filter((i) => i.date.startsWith(String(year))).map((i) => ({
      date: i.date, type: i.type, refNo: i.refNo, company: i.company || i.attention, total: i.total,
    })),
    tax: tax.result,
    figures: {
      closingStock: input.closingStock, openStock: input.opening.stock, openCapital: input.opening.capital,
      openPL: input.opening.pl, openCash: input.opening.cash, openLongTermLoan: input.opening.longTermLoan,
      openOtherLTLiab: input.opening.otherLTLiab, openAdvances: input.opening.advances,
      openTradeDebtors: input.opening.tradeDebtors, openCreditors: input.opening.creditors,
    },
  });
  const name = `${company.name.replace(/\W+/g, '_')}_Accounts_${year}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });
});
