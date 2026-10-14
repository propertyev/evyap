// Report models (pure). The same models feed the web pages, the Excel export and the PDF pack.
import { DEFAULT_CATEGORIES, type Group } from './categories';
import type { YearResult } from './engine';
import { MONTHS, MONTHS_LONG } from './money';

export type LineStyle = 'n' | 'h' | 'st' | 'gt' | 'i' | 'sp';

export interface StmtLine {
  label: string;
  note?: number | null;
  value?: number | null;
  style?: LineStyle;
}

export interface Statement {
  key: string;
  title: string;
  columnLabel: string; // e.g. "RM 2026"
  lines: StmtLine[];
}

export interface GridRow {
  label: string;
  values: number[];
  total?: number;
  style?: 'n' | 'sec' | 'tot';
}

export interface Grid {
  key: string;
  title: string;
  header: string[];
  rows: GridRow[];
  note?: string;
}

export interface CatInfo {
  name: string;
  group: Group;
}

const L = (label: string, value?: number | null, note?: number | null, style: LineStyle = 'n'): StmtLine => ({
  label, value: value ?? null, note: note ?? null, style,
});
const SP: StmtLine = { label: '', style: 'sp' };
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

function namesOf(cats: CatInfo[] | undefined, g: Group): string[] {
  const list = cats ?? DEFAULT_CATEGORIES.map((c) => ({ name: c.name, group: c.group }));
  return list.filter((c) => c.group === g).map((c) => c.name);
}

export const fyeLine = (year: number) => `For The Year Ended 31 December ${year}`;
export const monthHeaders = (year: number) => MONTHS.map((m) => `${m}-${String(year).slice(2)}`);

// ---------------------------------------------------------------- P&L
export function plYearly(r: YearResult): Statement {
  return {
    key: 'pl-yearly',
    title: 'Statement of Profit & Loss Account',
    columnLabel: `RM ${r.year}`,
    lines: [
      L('SALES', r.sales, 8, 'h'),
      L('(-) Direct Cost', null, null, 'h'),
      L('Opening Stock', r.openingStock),
      L('Purchase', r.purchase, 9),
      L('Cost of Sales', r.costOfSales, null, 'st'),
      L('Closing Stock', r.closingStock),
      L('COST OF GOODS SOLD (COGS)', r.cogs, null, 'st'),
      L('GROSS PROFIT', r.grossProfit, null, 'h'),
      L('OPERATING EXPENSES', null, null, 'h'),
      L('Administrative Expenses', r.admin, 10),
      L('Selling and Forwarding Expenses', r.selling, 11),
      L('Financial charges', r.financial, 12),
      L('', r.operatingExpenses, null, 'st'),
      L('OPERATING PROFIT', r.operatingProfit, null, 'h'),
      L('MISCELLANEOUS INCOME', r.miscIncome, 13, 'h'),
      L('', r.operatingProfit + r.miscIncome, null, 'st'),
      SP,
      L('Net profit / (Loss) before tax & zakat', r.netProfit),
      L('Profit / loss at the beginning of period', r.openingPL),
      L('NET PROFIT / (LOSS)', r.netProfitAfterOpening, null, 'gt'),
    ],
  };
}

export function plMonthly(r: YearResult, month: number): Statement {
  const sales = r.salesM[month];
  const pur = r.purchaseM[month];
  const ad = r.adminM[month];
  const se = r.sellingM[month];
  const fi = r.financialM[month];
  const oi = r.otherIncomeM[month];
  const gp = sales - pur;
  const op = gp - ad - se - fi;
  return {
    key: 'pl-monthly',
    title: 'Statement of Profit & Loss Account',
    columnLabel: `RM`,
    lines: [
      L(`${MONTHS_LONG[month]} ${r.year}`, null, null, 'h'),
      L('SALES', sales, null, 'h'),
      L('(-) Direct Cost', null, null, 'h'),
      L('Purchase', pur),
      L('COST OF SALES', pur, null, 'st'),
      L('GROSS PROFIT', gp, null, 'h'),
      L('OPERATING EXPENSES', null, null, 'h'),
      L('Administrative Expenses', ad),
      L('Selling and Forwarding Expenses', se),
      L('Financial charges', fi),
      L('', ad + se + fi, null, 'st'),
      L('OPERATING PROFIT', op, null, 'h'),
      L('MISCELLANEOUS INCOME', oi, null, 'h'),
      L('NET PROFIT / (LOSS)', op + oi, null, 'gt'),
    ],
  };
}

// ---------------------------------------------------------------- Balance sheet
export function balanceSheet(r: YearResult): Statement {
  return {
    key: 'balance-sheet',
    title: 'Statement of Financial Position',
    columnLabel: `RM ${r.year}`,
    lines: [
      L('Assets', null, null, 'h'),
      L('Operating Fixed Assets:', null, null, 'i'),
      L('Property, Plant & Equipments', r.ppe, 1),
      L('Current Assets:', null, null, 'i'),
      L('Cash and bank balances', r.cash, 5),
      L('Trade debtors', r.tradeDebtors, 3),
      L('Advances, deposits and prepayments', r.advances, 4),
      L('Inventory', r.closingStock, 2),
      L('Total current assets', r.currentAssets, null, 'st'),
      SP,
      L('Total Assets', r.totalAssets, null, 'gt'),
      SP,
      L('Equity and Liabilities', null, null, 'h'),
      L("Shareholder's Equity", null, null, 'i'),
      L("Partner's Capital", r.capital, 7),
      L('(-) Withdrawal', r.drawings),
      L('Accumulated Profit & Loss', r.netProfit),
      L('(+) Last profit / loss', r.openingPL),
      L('Total Equity', r.equity, null, 'st'),
      L('Liabilities', null, null, 'h'),
      L('Non-Current liabilities:', null, null, 'i'),
      L('Long-term loans', r.longTermLoans),
      L('Other long-term liabilities', r.otherLTLiab),
      L('Current liabilities:', null, null, 'i'),
      L('Creditors, accruals and other liabilities', r.creditors, 6),
      L('Total current liabilities', r.creditors, null, 'st'),
      L('Total Liabilities', r.liabilities, null, 'st'),
      SP,
      L('Total Equity & Liabilities', r.totalEquityLiabilities, null, 'gt'),
    ],
  };
}

// ---------------------------------------------------------------- Cash flow
export function cashFlow(r: YearResult): Statement {
  const c = r.cashFlow;
  return {
    key: 'cash-flow',
    title: 'Cash Flow Statement',
    columnLabel: `RM ${r.year}`,
    lines: [
      L('CASH FLOW FROM OPERATING ACTIVITIES', null, null, 'h'),
      L('Profit before taxation', c.profitBeforeTax),
      L('Refund / Accounts receivable collected', 0),
      L('', c.profitBeforeTax, null, 'st'),
      L('Adjustment for non cash and other items', null, null, 'i'),
      L('Depreciation', c.depreciation),
      L('Operating profit before working capital changes', c.operatingBeforeWC, null, 'st'),
      L('Changes in working capital:', null, null, 'i'),
      L('(Increase) / decrease in trade debtors', c.dTradeDebtors),
      L('(Increase) / decrease in advances, deposits and prepayments', c.dAdvances),
      L('(Increase) / decrease in stocks', c.dStock),
      L('Increase / (decrease) in current liabilities', c.dCreditors),
      L('', c.workingCapital, null, 'st'),
      L('Cash generation from operations', c.operating),
      L('Net cash flow from operating activities', c.operating, null, 'st'),
      L('CASH FLOW FROM INVESTING ACTIVITIES', null, null, 'h'),
      L('Capital expenditures', c.investing),
      L('Sales proceeds of fixed assets', 0),
      L('Net cash flow from Investing Activities', c.investing, null, 'st'),
      L('CASH FLOW FROM FINANCING ACTIVITIES', null, null, 'h'),
      L('Share Capital', c.capitalIntroduced),
      L('Loan', c.loanReceived),
      L('Withdrawal', -c.drawings),
      L('Net cash flow from Financing Activities', c.financing, null, 'st'),
      SP,
      L('Net increase / (decrease) in cash and cash equivalent', c.netChange),
      L('Cash and cash equivalents at the beginning of the period', c.opening),
      L('Cash and cash equivalents at the end of the period', c.closing, null, 'gt'),
    ],
  };
}

// ---------------------------------------------------------------- Notes
export function notes(r: YearResult, cats?: CatInfo[]): Statement {
  const T = (n: string) => sum(r.byCategory[n] ?? []);
  const lines: StmtLine[] = [];
  const block = (no: number, title: string, rows: [string, number][], total?: number) => {
    lines.push({ label: `Note ${no}`, style: 'h' }, { label: title, style: 'h' });
    for (const [n, v] of rows) lines.push(L(n, v));
    lines.push(L('', total ?? rows.reduce((a, x) => a + x[1], 0), null, 'gt'));
  };
  const withValue = (names: string[]) => names.map((n): [string, number] => [n, T(n)]).filter((x) => x[1] !== 0);

  block(1, 'Operating fixed assets', r.assets.map((a): [string, number] => [a.category, a.closingNBV]));
  block(2, 'Stocks', [['Stocks', r.closingStock]]);
  block(3, 'Trade Debtors', [['Trade debtors-Local (Unsecured - considered good by the management)', r.tradeDebtors]]);
  block(4, 'Advances, Deposits and Prepayments', [
    ['Brought forward', r.advances - sum(namesOf(cats, 'PREP').map(T))],
    ...namesOf(cats, 'PREP').map((n): [string, number] => [n, T(n)]),
  ]);
  block(5, 'Cash and Bank Balances', [['Cash in hand & at bank', r.cash]]);
  block(6, 'Creditors, Accruals and Other Liabilities', [['Trade creditors', r.creditors]]);
  block(7, "Partner's Capital", [
    ['Opening capital', r.capital - r.capitalIntroduced],
    ['Capital introduced', r.capitalIntroduced],
  ]);
  block(8, 'Sales', [['Cash sales', sum(r.salesCashM)], ['Credit sales', r.debtorEntries]]);
  block(9, 'Purchase', [...withValue(namesOf(cats, 'COS')), ['Credit purchases', r.creditorEntries]]);
  block(10, 'Administrative Expenses', [...withValue(namesOf(cats, 'ADMIN')), ['Depreciation', r.depreciation]]);
  block(11, 'Selling and Forwarding Expenses', withValue(namesOf(cats, 'SELLING')));
  block(12, 'Financial Charges', withValue(namesOf(cats, 'FINANCIAL')));
  block(13, 'Miscellaneous Income', [['Other Income', r.miscIncome]]);
  return { key: 'notes', title: 'Notes to the Financial Statements', columnLabel: `RM ${r.year}`, lines };
}

// ---------------------------------------------------------------- Grids (monthly)
function categoryRows(r: YearResult, names: string[]): GridRow[] {
  return names
    .filter((n) => r.byCategory[n])
    .map((n) => ({ label: n, values: r.byCategory[n], total: sum(r.byCategory[n]) }));
}

const gridTot = (label: string, values: number[]): GridRow => ({ label, values, total: sum(values), style: 'tot' });
const gridSec = (label: string): GridRow => ({ label, values: [], style: 'sec' });
const gridRow = (label: string, values: number[]): GridRow => ({ label, values, total: sum(values) });

export function plSummary(r: YearResult, cats?: CatInfo[]): Grid {
  const exp = [...namesOf(cats, 'ADMIN'), ...namesOf(cats, 'SELLING'), ...namesOf(cats, 'FINANCIAL')];
  const gp = r.salesM.map((v, i) => v - r.purchaseM[i]);
  return {
    key: 'pl-summary',
    title: 'Summary Statement of Profit & Loss Account',
    header: ['Description (RM)', ...monthHeaders(r.year), 'Total'],
    rows: [
      gridSec('SALES'),
      gridRow('Cash Sales', r.salesCashM),
      gridRow('Credit Sales (Debtor)', r.debtorEntriesM),
      gridTot('Total Sales', r.salesM),
      gridSec('(-) DIRECT COST'),
      ...categoryRows(r, namesOf(cats, 'COS')),
      gridRow('Credit Purchases (Creditor)', r.creditorEntriesM),
      gridTot('Total Direct Cost', r.purchaseM),
      gridTot('GROSS PROFIT', gp),
      gridSec('(+) MISCELLANEOUS INCOME'),
      gridRow('Other Income', r.otherIncomeM),
      gridSec('(-) OPERATING EXPENSES'),
      ...categoryRows(r, exp),
      gridRow('Depreciation', r.depreciationM),
      gridTot('Total Expenses', r.expensesM),
      gridTot('NET PROFIT / (LOSS)', r.netProfitM),
    ],
    note: `Opening stock and closing stock are applied in the yearly statement.`,
  };
}

export function cashSummary(r: YearResult, opening: number, cats?: CatInfo[]): Grid {
  const inNames = [...namesOf(cats, 'SALES'), ...namesOf(cats, 'OTHER_INCOME'), ...namesOf(cats, 'MODAL'), ...namesOf(cats, 'LOAN'), ...namesOf(cats, 'DEBTOR')];
  const outNames = [
    ...namesOf(cats, 'COS'), ...namesOf(cats, 'ADMIN'), ...namesOf(cats, 'SELLING'), ...namesOf(cats, 'FINANCIAL'),
    ...namesOf(cats, 'AMBILAN'), ...namesOf(cats, 'FA'), ...namesOf(cats, 'PREP'), ...namesOf(cats, 'CREDITOR'),
  ];
  const net = r.cashInM.map((v, i) => v - r.cashOutM[i]);
  let bal = opening;
  const closing = net.map((v) => (bal += v));
  return {
    key: 'cash-summary',
    title: 'Cash In & Cash Out Summary',
    header: ['Description (RM)', ...monthHeaders(r.year), 'Total'],
    rows: [
      gridSec('CASH IN'),
      ...categoryRows(r, inNames),
      gridTot('Total Cash In', r.cashInM),
      gridSec('CASH OUT'),
      ...categoryRows(r, outNames),
      gridTot('Total Cash Out', r.cashOutM),
      gridTot('Net Cash Flow', net),
      { label: 'Closing Balance', values: closing, total: closing[11], style: 'tot' },
    ],
  };
}

export function performance(r: YearResult): Grid {
  const exps = r.purchaseM.map((v, i) => v + r.expensesM[i]);
  return {
    key: 'performance',
    title: 'Performance Review',
    header: ['Month', 'Sales', 'Expenses', 'Net Profit'],
    rows: [
      ...monthHeaders(r.year).map((m, i) => ({ label: m, values: [r.salesM[i], exps[i], r.netProfitM[i]] })),
      { label: 'Total', values: [sum(r.salesM), sum(exps), sum(r.netProfitM)], style: 'tot' as const },
    ],
  };
}

export interface TallyBadge {
  ok: boolean;
  difference: number;
}
export const tally = (diff: number): TallyBadge => ({ ok: diff === 0, difference: diff });

/** INDEX / PAGE table on the management-accounts cover. */
export const COVER_INDEX: readonly (readonly [string, number])[] = [
  ['BALANCE SHEET', 1],
  ['PROFIT & LOSS STATEMENT', 2],
  ['CASH FLOW STATEMENT', 3],
  ['NOTES TO THE FINANCIAL STATEMENTS', 4],
];

/** P&L statement lines across the 12 months (the "Profit & Loss - Monthly" sheet in Excel). */
export function plMonthlyGrid(r: YearResult): Grid {
  const gp = r.salesM.map((v, i) => v - r.purchaseM[i]);
  const opex = r.expensesM;
  const op = gp.map((v, i) => v - opex[i]);
  return {
    key: 'pl-monthly',
    title: 'Statement of Profit & Loss Account — Monthly',
    header: ['Description (RM)', ...monthHeaders(r.year), 'Total'],
    rows: [
      gridRow('SALES', r.salesM),
      gridRow('Purchase', r.purchaseM),
      gridTot('GROSS PROFIT', gp),
      gridRow('Administrative Expenses', r.adminM),
      gridRow('Selling and Forwarding Expenses', r.sellingM),
      gridRow('Financial charges', r.financialM),
      gridTot('OPERATING PROFIT', op),
      gridRow('MISCELLANEOUS INCOME', r.otherIncomeM),
      gridTot('NET PROFIT / (LOSS)', r.netProfitM),
    ],
  };
}
