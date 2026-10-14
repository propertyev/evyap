// CmPro's fixed category list, groups and Trial Balance account codes.

export type Group =
  | 'SALES' | 'OTHER_INCOME' | 'MODAL' | 'LOAN' | 'DEBTOR'
  | 'COS' | 'ADMIN' | 'SELLING' | 'FINANCIAL'
  | 'AMBILAN' | 'FA' | 'PREP' | 'CREDITOR';

export type Direction = 'IN' | 'OUT';

export interface CategoryDef {
  name: string;
  direction: Direction;
  group: Group;
  code: number;
}

export const CASH_IN_NAMES = ['Sales', 'Other Income', 'Modal', 'Loan', 'Debtor'] as const;

export const COS_NAMES = [
  'Cost of Sales - Contractor',
  'Cost of Sales - Freelance',
  'Cost of Sales - Travelling Expenses',
  'Clearing & Forwarding',
  'Stok / Bahan Mentah',
];

export const EXP_NAMES = [
  'Accounting Fee', 'Alat Tulis & Percetakan', 'Audit', 'Bil Air & Elektrik', 'Bil Telefon', 'Bonus',
  'Caj Kerajaan', 'Consultancy Fee', 'Entertainment / Hiburan', 'Gaji Director', 'Gaji Staff', 'Insurance',
  'Komisyen', 'KWSP / EPF', 'Lain-lain Perbelanjaan', 'Legal Fee', 'Lesen', 'Medical Fee',
  'Perbelanjaan IT', 'Postage', 'Professional Service Taxation', 'Rental / Sewaan',
  'Repair & Maintenance Kenderaan', 'Repair & Maintenance Peralatan', 'Repair & Maintenance Umum',
  'Secretarial Fee', 'SOCSO / PERKESO', 'Staff Welfare', 'Training & Seminar',
  'Transportation / Pengangkutan', 'Zakat Perniagaan', 'Hotel', 'Marketing',
  'Petrol, Parking & Tol', 'Bank Charges', 'Loan Interest',
];

export const SELLING_NAMES = [
  'Marketing', 'Entertainment / Hiburan', 'Hotel', 'Petrol, Parking & Tol', 'Transportation / Pengangkutan',
];
export const FINANCIAL_NAMES = ['Bank Charges', 'Loan Interest'];
export const ADMIN_NAMES = EXP_NAMES.filter((n) => !SELLING_NAMES.includes(n) && !FINANCIAL_NAMES.includes(n));

export const FA_NAMES = [
  'Intangible Assets', 'Perabot & Kelengkapan', 'Peralatan Pejabat', 'Kelengkapan Komputer',
  'Kenderaan', 'Machine', 'Land & Building',
];
export const PREP_NAMES = [
  'Prepaid Insurance', 'Prepaid Office Rent', 'Prepaid Other Expenses', 'Prepaid Tax', 'Security Deposits',
];
export const AMBILAN = 'Ambilan';
export const CREDITOR = 'Creditor';
export const DEBTOR = 'Debtor';

function build(): CategoryDef[] {
  const defs: CategoryDef[] = [
    { name: 'Sales', direction: 'IN', group: 'SALES', code: 4101 },
    { name: 'Other Income', direction: 'IN', group: 'OTHER_INCOME', code: 4901 },
    { name: 'Modal', direction: 'IN', group: 'MODAL', code: 3500 },
    { name: 'Loan', direction: 'IN', group: 'LOAN', code: 3100 },
    { name: 'Debtor', direction: 'IN', group: 'DEBTOR', code: 1301 },
  ];
  COS_NAMES.forEach((name, i) => defs.push({ name, direction: 'OUT', group: 'COS', code: 5100 + i }));
  EXP_NAMES.forEach((name, i) => {
    const group: Group = SELLING_NAMES.includes(name) ? 'SELLING' : FINANCIAL_NAMES.includes(name) ? 'FINANCIAL' : 'ADMIN';
    defs.push({ name, direction: 'OUT', group, code: 5201 + i });
  });
  defs.push({ name: AMBILAN, direction: 'OUT', group: 'AMBILAN', code: 3551 });
  FA_NAMES.forEach((name, i) => defs.push({ name, direction: 'OUT', group: 'FA', code: 1101 + i }));
  PREP_NAMES.forEach((name, i) => defs.push({ name, direction: 'OUT', group: 'PREP', code: 1581 + i }));
  defs.push({ name: CREDITOR, direction: 'OUT', group: 'CREDITOR', code: 2201 });
  return defs;
}

export const DEFAULT_CATEGORIES: CategoryDef[] = build();

export const GROUP_BY_NAME: Record<string, Group> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.name, c.group]),
);

/** Fixed Trial Balance account codes that are not category-bound. */
export const TB_CODES = {
  cash: 1601,
  tradeDebtors: 1301,
  advances: 1350,
  accumulatedDepreciation: 1400,
  tradeCreditors: 2201,
  loan: 3100,
  otherLT: 3101,
  modal: 3500,
  ambilan: 3551,
  accumulatedPL: 3600,
  sales: 4101,
  salesReturn: 4301,
  salesDiscounts: 4302,
  otherIncome: 4901,
  exchangeGainLoss: 4902,
  profitOnSaleFA: 4903,
  openingStock: 5000,
  creditPurchases: 5199,
  depreciation: 5299,
} as const;

export const GROUP_LABELS: Record<Group, string> = {
  SALES: 'Sales', OTHER_INCOME: 'Other income', MODAL: 'Capital introduced', LOAN: 'Loan received',
  DEBTOR: 'Debtor receipts', COS: 'Cost of sales', ADMIN: 'Administrative', SELLING: 'Selling & forwarding',
  FINANCIAL: 'Financial charges', AMBILAN: 'Drawings', FA: 'Fixed assets', PREP: 'Prepayments & deposits',
  CREDITOR: 'Creditor payments',
};
