// The acceptance-test fixture from the product spec (section 9). Amounts in sen.
import type { EngineInput } from '@/lib/engine';

export const fixtureInput = (): EngineInput => ({
  year: 2026,
  closingStock: 150000,
  opening: {
    stock: 100000,
    cash: 2000000,
    tradeDebtors: 300000,
    advances: 50000,
    capital: 1700000,
    pl: 450000,
    longTermLoan: 300000,
    otherLTLiab: 0,
    creditors: 200000,
  },
  fixedAssets: [{ category: 'Kelengkapan Komputer', openingNBV: 200000, cost: 0, ratePct: 20 }],
  transactions: [
    { date: '2026-01-02', direction: 'IN', category: 'Sales', amount: 850000 },
    { date: '2026-01-05', direction: 'OUT', category: 'Bil Air & Elektrik', amount: 41260 },
    { date: '2026-02-10', direction: 'OUT', category: 'Kelengkapan Komputer', amount: 300000 },
    { date: '2026-02-11', direction: 'IN', category: 'Debtor', amount: 250000 },
    { date: '2026-02-12', direction: 'OUT', category: 'Ambilan', amount: 100000 },
    { date: '2026-02-13', direction: 'OUT', category: 'Stok / Bahan Mentah', amount: 230000 },
    { date: '2026-03-14', direction: 'OUT', category: 'Creditor', amount: 150000 },
    { date: '2026-03-15', direction: 'IN', category: 'Loan', amount: 1000000 },
    { date: '2026-03-16', direction: 'OUT', category: 'Security Deposits', amount: 90000 },
  ],
  debtorCreditors: [
    { date: '2026-01-20', type: 'DEBTOR', amount: 400000 }, // ABC Sdn Bhd
    { date: '2026-03-01', type: 'DEBTOR', amount: 120000 }, // invoice to XYZ Bhd
  ],
});
