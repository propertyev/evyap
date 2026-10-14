// EVyap accounting engine — pure functions, no I/O. All amounts are integer SEN.
// Mirrors the CmPro.xlsm formulas (see the product spec, section 5).
import { DEFAULT_CATEGORIES, FA_NAMES, GROUP_BY_NAME, TB_CODES, type Group } from './categories';
import { pct, spread } from './money';

export type Dir = 'IN' | 'OUT';

export interface EngineTx {
  date: string; // YYYY-MM-DD
  direction: Dir;
  category: string;
  amount: number; // sen, positive
}

export interface EngineDC {
  date: string;
  type: 'DEBTOR' | 'CREDITOR';
  amount: number;
}

export interface EngineAsset {
  category: string;
  openingNBV: number;
  cost: number;
  ratePct: number;
}

export interface Opening {
  stock: number;
  capital: number;
  pl: number;
  cash: number;
  longTermLoan: number;
  otherLTLiab: number;
  advances: number;
  tradeDebtors: number;
  creditors: number;
}

export interface CategoryInfo {
  name: string;
  group: Group;
  code: number;
}

export interface EngineInput {
  year: number;
  transactions: EngineTx[];
  debtorCreditors: EngineDC[];
  opening: Opening;
  fixedAssets: EngineAsset[];
  closingStock: number;
  /** Optional category table (custom categories). Defaults to CmPro's built-in list. */
  categories?: CategoryInfo[];
}

export interface AssetRow {
  category: string;
  openingNBV: number;
  cost: number;
  additions: number;
  ratePct: number;
  depreciation: number;
  closingNBV: number;
}

export interface TBRow {
  code: number;
  name: string;
  debit: number;
  credit: number;
}
export interface TBSection {
  title: string;
  rows: TBRow[];
}

export interface YearResult {
  year: number;
  txCount: number;
  /** category -> 12 monthly sums (sen) */
  byCategory: Record<string, number[]>;
  cashInM: number[];
  cashOutM: number[];
  cashInTotal: number;
  cashOutTotal: number;

  debtorEntriesM: number[];
  creditorEntriesM: number[];
  debtorEntries: number;
  creditorEntries: number;

  assets: AssetRow[];
  depreciation: number;
  depreciationM: number[];
  faAdditions: number;

  // Monthly P&L lines
  salesCashM: number[];
  salesM: number[];
  otherIncomeM: number[];
  cosM: number[];
  purchaseM: number[];
  adminM: number[];
  sellingM: number[];
  financialM: number[];
  expensesM: number[];
  netProfitM: number[]; // before stock adjustment (stock is a year-end adjustment)

  // Yearly P&L
  sales: number;
  purchase: number;
  openingStock: number;
  closingStock: number;
  costOfSales: number; // opening stock + purchase
  cogs: number;
  grossProfit: number;
  admin: number;
  selling: number;
  financial: number;
  operatingExpenses: number;
  operatingProfit: number;
  miscIncome: number;
  netProfit: number;
  openingPL: number;
  netProfitAfterOpening: number;

  // Balance sheet
  cash: number;
  tradeDebtors: number;
  creditors: number;
  advances: number;
  ppe: number;
  currentAssets: number;
  totalAssets: number;
  capitalIntroduced: number;
  capital: number;
  drawings: number;
  equity: number;
  longTermLoans: number;
  otherLTLiab: number;
  liabilities: number;
  totalEquityLiabilities: number;
  tally: number; // total assets - (equity + liabilities); 0 = balanced

  // Cash flow
  cashFlow: {
    profitBeforeTax: number;
    depreciation: number;
    operatingBeforeWC: number;
    dTradeDebtors: number;
    dAdvances: number;
    dStock: number;
    dCreditors: number;
    workingCapital: number;
    operating: number;
    investing: number;
    capitalIntroduced: number;
    loanReceived: number;
    drawings: number;
    financing: number;
    netChange: number;
    opening: number;
    closing: number;
    reconciles: boolean;
  };

  // Trial balance
  trialBalance: {
    sections: TBSection[];
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
  };

  // Opening position (for the "Last Year Figure" tally)
  openingTally: {
    assets: number;
    equityAndLiabilities: number;
    difference: number;
  };
}

const z12 = () => Array<number>(12).fill(0);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const addInto = (target: number[], src: number[]) => {
  for (let i = 0; i < 12; i++) target[i] += src[i];
};

function monthIndex(date: string): number {
  return parseInt(date.slice(5, 7), 10) - 1;
}

export function emptyOpening(): Opening {
  return {
    stock: 0, capital: 0, pl: 0, cash: 0, longTermLoan: 0, otherLTLiab: 0,
    advances: 0, tradeDebtors: 0, creditors: 0,
  };
}

export function computeYear(input: EngineInput): YearResult {
  const { year, opening, closingStock } = input;
  const yearStr = String(year);

  const catInfo = new Map<string, CategoryInfo>();
  for (const c of DEFAULT_CATEGORIES) catInfo.set(c.name, { name: c.name, group: c.group, code: c.code });
  for (const c of input.categories ?? []) catInfo.set(c.name, c);
  const groupOf = (name: string, dir: Dir): Group =>
    catInfo.get(name)?.group ?? GROUP_BY_NAME[name] ?? (dir === 'IN' ? 'SALES' : 'ADMIN');

  // ---- aggregate transactions: category x month
  const byCategory: Record<string, number[]> = {};
  const byGroup: Record<string, number[]> = {};
  const cashInM = z12();
  const cashOutM = z12();
  let txCount = 0;
  for (const t of input.transactions) {
    if (t.date.slice(0, 4) !== yearStr) continue;
    txCount++;
    const m = monthIndex(t.date);
    (byCategory[t.category] ??= z12())[m] += t.amount;
    (byGroup[groupOf(t.category, t.direction)] ??= z12())[m] += t.amount;
    if (t.direction === 'IN') cashInM[m] += t.amount;
    else cashOutM[m] += t.amount;
  }
  const G = (g: Group) => byGroup[g] ?? z12();
  const T = (g: Group) => sum(G(g));

  // ---- debtor / creditor entries
  const debtorEntriesM = z12();
  const creditorEntriesM = z12();
  for (const d of input.debtorCreditors) {
    if (d.date.slice(0, 4) !== yearStr) continue;
    (d.type === 'DEBTOR' ? debtorEntriesM : creditorEntriesM)[monthIndex(d.date)] += d.amount;
  }
  const debtorEntries = sum(debtorEntriesM);
  const creditorEntries = sum(creditorEntriesM);

  // ---- fixed assets
  const assetInput = new Map(input.fixedAssets.map((a) => [a.category, a]));
  const faCategories = [
    ...FA_NAMES,
    ...[...catInfo.values()].filter((c) => c.group === 'FA' && !FA_NAMES.includes(c.name)).map((c) => c.name),
  ];
  const assets: AssetRow[] = faCategories.map((category) => {
    const a = assetInput.get(category);
    const openingNBV = a?.openingNBV ?? 0;
    const cost = a?.cost ?? 0;
    const ratePct = a?.ratePct ?? 0;
    const additions = sum(byCategory[category] ?? z12());
    const depreciation = pct(cost + additions, ratePct);
    return { category, openingNBV, cost, additions, ratePct, depreciation, closingNBV: openingNBV + additions - depreciation };
  });
  const depreciation = assets.reduce((a, r) => a + r.depreciation, 0);
  const depreciationM = spread(depreciation, 12);
  const faAdditions = assets.reduce((a, r) => a + r.additions, 0);
  const ppe = assets.reduce((a, r) => a + r.closingNBV, 0);

  // ---- P&L
  const salesCashM = G('SALES');
  const salesM = salesCashM.map((v, i) => v + debtorEntriesM[i]);
  const otherIncomeM = G('OTHER_INCOME');
  const cosM = G('COS');
  const purchaseM = cosM.map((v, i) => v + creditorEntriesM[i]);
  const adminM = G('ADMIN').map((v, i) => v + depreciationM[i]);
  const sellingM = G('SELLING');
  const financialM = G('FINANCIAL');
  const expensesM = adminM.map((v, i) => v + sellingM[i] + financialM[i]);
  const netProfitM = salesM.map((v, i) => v - purchaseM[i] - expensesM[i] + otherIncomeM[i]);

  const sales = sum(salesM);
  const purchase = sum(purchaseM);
  const openingStock = opening.stock;
  const costOfSales = openingStock + purchase;
  const cogs = costOfSales - closingStock;
  const grossProfit = sales - cogs;
  const admin = sum(adminM);
  const selling = sum(sellingM);
  const financial = sum(financialM);
  const operatingExpenses = admin + selling + financial;
  const operatingProfit = grossProfit - operatingExpenses;
  const miscIncome = sum(otherIncomeM);
  const netProfit = operatingProfit + miscIncome;

  // ---- balance sheet
  const cashInTotal = sum(cashInM);
  const cashOutTotal = sum(cashOutM);
  const cash = opening.cash + cashInTotal - cashOutTotal;
  const tradeDebtors = opening.tradeDebtors + debtorEntries - T('DEBTOR');
  const creditors = opening.creditors + creditorEntries - T('CREDITOR');
  const prepYear = T('PREP');
  const advances = opening.advances + prepYear;
  const currentAssets = cash + tradeDebtors + advances + closingStock;
  const totalAssets = ppe + currentAssets;

  const capitalIntroduced = T('MODAL');
  const capital = opening.capital + capitalIntroduced;
  const drawings = T('AMBILAN');
  const equity = capital - drawings + netProfit + opening.pl;
  const loanIn = T('LOAN');
  const longTermLoans = opening.longTermLoan + loanIn;
  const liabilities = longTermLoans + opening.otherLTLiab + creditors;
  const totalEquityLiabilities = equity + liabilities;
  const tally = totalAssets - totalEquityLiabilities;

  // ---- cash flow
  const dTradeDebtors = opening.tradeDebtors - tradeDebtors;
  const dAdvances = opening.advances - advances;
  const dStock = openingStock - closingStock;
  const dCreditors = creditors - opening.creditors;
  const operatingBeforeWC = netProfit + depreciation;
  const workingCapital = dTradeDebtors + dAdvances + dStock + dCreditors;
  const operating = operatingBeforeWC + workingCapital;
  const investing = -faAdditions;
  const financing = capitalIntroduced + loanIn - drawings;
  const netChange = operating + investing + financing;
  const closingCash = opening.cash + netChange;

  // ---- trial balance
  const dr = (n: number) => (n >= 0 ? { debit: n, credit: 0 } : { debit: 0, credit: -n });
  const cr = (n: number) => (n >= 0 ? { debit: 0, credit: n } : { debit: -n, credit: 0 });
  const D = (code: number, name: string, n: number): TBRow => ({ code, name, ...dr(n) });
  const C = (code: number, name: string, n: number): TBRow => ({ code, name, ...cr(n) });
  const codeOf = (name: string, fallback: number) => catInfo.get(name)?.code || fallback;
  const namesIn = (g: Group) => [...catInfo.values()].filter((c) => c.group === g).map((c) => c.name);
  const catTotal = (name: string) => sum(byCategory[name] ?? z12());

  // Expense accounts in code order (CmPro list order for built-ins, then custom categories)
  const expByCode = [...new Set([...namesIn('ADMIN'), ...namesIn('SELLING'), ...namesIn('FINANCIAL')])].sort(
    (a, b) => codeOf(a, 5900) - codeOf(b, 5900),
  );

  const sections: TBSection[] = [
    { title: 'CASH & BANK', rows: [D(TB_CODES.cash, 'Cash in Hand & Cash at Bank', cash)] },
    { title: 'TRADE DEBTORS', rows: [D(TB_CODES.tradeDebtors, 'Trade Debtors', tradeDebtors)] },
    {
      title: 'ADVANCES, DEPOSITS & PREPAID',
      rows: [
        D(TB_CODES.advances, 'Advances & deposits brought forward', opening.advances),
        ...namesIn('PREP').map((n) => D(codeOf(n, 1580), n, catTotal(n))),
      ],
    },
    {
      title: 'NON CURRENT ASSET',
      rows: assets.map((a) => D(codeOf(a.category, 1100), `${a.category} (NBV b/f + additions)`, a.openingNBV + a.additions)),
    },
    { title: 'ACCUMULATED DEPRECIATION', rows: [C(TB_CODES.accumulatedDepreciation, 'Depreciation charge for the year', depreciation)] },
    { title: 'CREDITORS', rows: [C(TB_CODES.tradeCreditors, 'Trade Creditors', creditors)] },
    {
      title: 'NON CURRENT LIABILITIES',
      rows: [C(TB_CODES.loan, 'Loan', longTermLoans), C(TB_CODES.otherLT, 'Other long-term liabilities', opening.otherLTLiab)],
    },
    {
      title: "PARTNER'S CAPITAL",
      rows: [
        C(TB_CODES.modal, 'Modal', capital),
        D(TB_CODES.ambilan, 'Ambilan', drawings),
        C(TB_CODES.accumulatedPL, 'Accumulated Profit (Loss) A/C. b/f', opening.pl),
      ],
    },
    {
      title: 'REVENUE',
      rows: [C(TB_CODES.sales, 'Sales', sales), C(TB_CODES.otherIncome, 'Other Income', miscIncome)],
    },
    {
      title: 'COST OF SALES',
      rows: [
        D(TB_CODES.openingStock, 'Opening Stock', openingStock),
        ...namesIn('COS').map((n) => D(codeOf(n, 5100), n, catTotal(n))),
        D(TB_CODES.creditPurchases, 'Credit Purchases (Creditor)', creditorEntries),
      ],
    },
    {
      title: 'EXPENSES',
      rows: [
        ...expByCode.map((n) => D(codeOf(n, 5200), n, catTotal(n))),
        D(TB_CODES.depreciation, 'Depreciation', depreciation),
      ],
    },
  ];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const s of sections) for (const r of s.rows) {
    totalDebit += r.debit;
    totalCredit += r.credit;
  }

  // ---- opening tally (Last Year Figure sanity check)
  const openAssets =
    opening.stock + opening.cash + opening.tradeDebtors + opening.advances + assets.reduce((a, r) => a + r.openingNBV, 0);
  const openEL = opening.capital + opening.pl + opening.longTermLoan + opening.otherLTLiab + opening.creditors;

  return {
    year, txCount, byCategory, cashInM, cashOutM, cashInTotal, cashOutTotal,
    debtorEntriesM, creditorEntriesM, debtorEntries, creditorEntries,
    assets, depreciation, depreciationM, faAdditions,
    salesCashM, salesM, otherIncomeM, cosM, purchaseM, adminM, sellingM, financialM, expensesM, netProfitM,
    sales, purchase, openingStock, closingStock, costOfSales, cogs, grossProfit,
    admin, selling, financial, operatingExpenses, operatingProfit, miscIncome, netProfit,
    openingPL: opening.pl, netProfitAfterOpening: netProfit + opening.pl,
    cash, tradeDebtors, creditors, advances, ppe, currentAssets, totalAssets,
    capitalIntroduced, capital, drawings, equity, longTermLoans, otherLTLiab: opening.otherLTLiab,
    liabilities, totalEquityLiabilities, tally,
    cashFlow: {
      profitBeforeTax: netProfit, depreciation, operatingBeforeWC,
      dTradeDebtors, dAdvances, dStock, dCreditors, workingCapital, operating, investing,
      capitalIntroduced, loanReceived: loanIn, drawings, financing, netChange,
      opening: opening.cash, closing: closingCash, reconciles: closingCash === cash,
    },
    trialBalance: { sections, totalDebit, totalCredit, balanced: totalDebit === totalCredit },
    openingTally: { assets: openAssets, equityAndLiabilities: openEL, difference: openAssets - openEL },
  };
}

/** Next year's opening balances, carried forward from this year's closing position. */
export interface CarryForward {
  opening: Opening;
  closingStock: number;
  assets: { category: string; openingNBV: number; cost: number; ratePct: number }[];
}

export function carryForward(r: YearResult, opening: Opening): CarryForward {
  return {
    opening: {
      cash: r.cash,
      tradeDebtors: r.tradeDebtors,
      advances: r.advances,
      stock: r.closingStock,
      creditors: r.creditors,
      capital: r.capital - r.drawings,
      pl: opening.pl + r.netProfit,
      longTermLoan: r.longTermLoans,
      otherLTLiab: opening.otherLTLiab,
    },
    closingStock: 0,
    assets: r.assets.map((a) => ({
      category: a.category,
      openingNBV: a.closingNBV,
      cost: a.cost + a.additions,
      ratePct: a.ratePct,
    })),
  };
}
