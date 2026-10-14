export interface NavItem {
  key: string;
  href: string;
  label: string; // i18n key under menu.*
  icon: string;
}

// Order follows the CmPro sheet order (spec §2).
export const NAV: (NavItem | 'gap')[] = [
  { key: 'import', href: '/import', label: 'menu.import', icon: '⇪' },
  { key: 'ledger', href: '/ledger', label: 'menu.ledger', icon: '◉' },
  { key: 'dc', href: '/debtor-creditor', label: 'menu.dc', icon: '⇄' },
  { key: 'invoices', href: '/invoices', label: 'menu.invoices', icon: '▤' },
  'gap',
  { key: 'performance', href: '/performance', label: 'menu.performance', icon: '◔' },
  { key: 'plMonthly', href: '/pl-monthly', label: 'menu.plMonthly', icon: '⟋' },
  { key: 'plYearly', href: '/pl-yearly', label: 'menu.plYearly', icon: '⟋' },
  { key: 'plSummary', href: '/pl-summary', label: 'menu.plSummary', icon: '▥' },
  { key: 'cashSummary', href: '/cash-summary', label: 'menu.cashSummary', icon: '▤' },
  { key: 'balanceSheet', href: '/balance-sheet', label: 'menu.balanceSheet', icon: '⚖' },
  { key: 'trialBalance', href: '/trial-balance', label: 'menu.trialBalance', icon: '☰' },
  { key: 'assets', href: '/assets', label: 'menu.assets', icon: '▦' },
  { key: 'cashFlow', href: '/cash-flow', label: 'menu.cashFlow', icon: '≋' },
  { key: 'notes', href: '/notes', label: 'menu.notes', icon: '✎' },
  { key: 'tax', href: '/tax', label: 'menu.tax', icon: '%' },
  { key: 'cover', href: '/cover', label: 'menu.cover', icon: '▣' },
  'gap',
  { key: 'setup', href: '/setup', label: 'menu.setup', icon: '⚙' },
];
