import { describe, expect, it } from 'vitest';
import { carryForward, computeYear, emptyOpening } from '@/lib/engine';
import { fmt, spread, toSen } from '@/lib/money';
import { fixtureInput } from './fixtures';

describe('acceptance fixture (spec §9)', () => {
  const r = computeYear(fixtureInput());

  it('cash = 31,887.40', () => expect(r.cash).toBe(3188740));
  it('cash flow closing cash equals balance-sheet cash', () => {
    expect(r.cashFlow.closing).toBe(3188740);
    expect(r.cashFlow.reconciles).toBe(true);
  });
  it('balance sheet balances at 44,887.40', () => {
    expect(r.totalAssets).toBe(4488740);
    expect(r.totalEquityLiabilities).toBe(4488740);
    expect(r.tally).toBe(0);
  });
  it('trial balance debit = credit', () => {
    expect(r.trialBalance.balanced).toBe(true);
    expect(r.trialBalance.totalDebit).toBe(4930000);
  });
  it('component balances', () => {
    expect(r.ppe).toBe(440000);
    expect(r.tradeDebtors).toBe(570000);
    expect(r.advances).toBe(140000);
    expect(r.creditors).toBe(50000);
    expect(r.longTermLoans).toBe(1300000);
    expect(r.netProfit).toBe(1088740);
  });
  it('P&L lines', () => {
    expect(r.sales).toBe(1370000);
    expect(r.purchase).toBe(230000);
    expect(r.cogs).toBe(180000);
    expect(r.grossProfit).toBe(1190000);
    expect(r.depreciation).toBe(60000);
    expect(r.admin).toBe(101260);
  });
  it('shows a tally difference when opening capital is 15,000', () => {
    const inp = fixtureInput();
    inp.opening.capital = 1500000;
    const x = computeYear(inp);
    expect(x.tally).toBe(200000);
    expect(fmt(x.tally)).toBe('2,000.00');
    expect(x.trialBalance.balanced).toBe(false);
  });
  it('opening tally of the fixture balances', () => {
    expect(r.openingTally.difference).toBe(0);
  });
});

describe('engine edge cases', () => {
  it('ignores transactions from other years', () => {
    const inp = fixtureInput();
    inp.transactions.push({ date: '2025-12-31', direction: 'IN', category: 'Sales', amount: 999999 });
    expect(computeYear(inp).cash).toBe(3188740);
  });

  it('monthly depreciation spread sums exactly to the annual charge', () => {
    const r = computeYear(fixtureInput());
    expect(r.depreciationM.reduce((a, b) => a + b, 0)).toBe(r.depreciation);
    expect(spread(1001, 12).reduce((a, b) => a + b, 0)).toBe(1001);
  });

  it('negative cash lands on the credit side of the trial balance', () => {
    const r = computeYear({
      year: 2026, closingStock: 0, opening: emptyOpening(), fixedAssets: [], debtorCreditors: [],
      transactions: [{ date: '2026-01-01', direction: 'OUT', category: 'Audit', amount: 5000 }],
    });
    expect(r.cash).toBe(-5000);
    expect(r.trialBalance.balanced).toBe(true);
    expect(r.tally).toBe(0);
  });

  it('closing stock raises profit and still balances', () => {
    const inp = fixtureInput();
    inp.closingStock = 500000;
    const r = computeYear(inp);
    expect(r.tally).toBe(0);
    expect(r.cashFlow.reconciles).toBe(true);
  });

  it('carry-forward produces a balanced opening position', () => {
    const inp = fixtureInput();
    const r = computeYear(inp);
    const cf = carryForward(r, inp.opening);
    const next = computeYear({
      year: 2027, transactions: [], debtorCreditors: [], opening: cf.opening, closingStock: cf.closingStock,
      fixedAssets: cf.assets.map((a) => ({ category: a.category, openingNBV: a.openingNBV, cost: a.cost, ratePct: a.ratePct })),
    });
    expect(next.openingTally.difference).toBe(0);
    expect(cf.opening.cash).toBe(3188740);
    expect(cf.opening.capital).toBe(1700000 - 100000);
    expect(cf.opening.pl).toBe(450000 + 1088740);
    expect(cf.opening.stock).toBe(150000);
    expect(cf.assets.find((a) => a.category === 'Kelengkapan Komputer')!.openingNBV).toBe(440000);
  });

  it('handles 50,000 transactions in under 300 ms', () => {
    const cats = ['Sales', 'Audit', 'Bil Telefon', 'Stok / Bahan Mentah', 'Marketing', 'Loan', 'Debtor', 'Creditor'];
    const base = fixtureInput();
    const txs = Array.from({ length: 50000 }, (_, i) => ({
      date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      direction: (i % 3 === 0 ? 'IN' : 'OUT') as 'IN' | 'OUT',
      category: cats[i % cats.length],
      amount: 100 + (i % 977),
    }));
    computeYear({ ...base, transactions: txs }); // warm-up
    const t0 = performance.now();
    computeYear({ ...base, transactions: txs });
    expect(performance.now() - t0).toBeLessThan(300);
  });
});

describe('money', () => {
  it('parses and formats', () => {
    expect(toSen('RM 1,234.56')).toBe(123456);
    expect(toSen('(412.60)')).toBe(-41260);
    expect(toSen('1,000.00-')).toBe(-100000);
    expect(toSen(412.6)).toBe(41260);
    expect(toSen('abc')).toBeNull();
    expect(fmt(123456)).toBe('1,234.56');
    expect(fmt(-123456)).toBe('(1,234.56)');
    expect(fmt(5)).toBe('0.05');
  });
});
