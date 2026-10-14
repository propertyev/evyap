// Default keyword rules for auto-categorising imported rows. First match wins.
// Patterns are case-insensitive regex sources; word boundaries avoid false hits (e.g. "tol" in "total").
import type { Direction } from './categories';

export interface RuleDef {
  pattern: string;
  category: string;
  direction: Direction;
}

const out = (pattern: string, category: string): RuleDef => ({ pattern, category, direction: 'OUT' });
const inn = (pattern: string, category: string): RuleDef => ({ pattern, category, direction: 'IN' });

export const DEFAULT_RULES: RuleDef[] = [
  // Specific before generic
  out('\\b(google workspace|g suite|aws|amazon web services|microsoft|adobe|canva|hosting|domain|software|openai|anthropic|claude|godaddy|namecheap)\\b', 'Perbelanjaan IT'),
  out('\\b(tnb|tenaga nasional|elektrik|electric(ity)?|syabas|air selangor|ranhill|saj|water bill)\\b', 'Bil Air & Elektrik'),
  out('\\b(maxis|celcom|digi|unifi|tm net|tm|time dotcom|telefon|telephone|broadband|internet)\\b', 'Bil Telefon'),
  out('\\b(petrol|shell|petronas|caltex|bhp|parking|toll|tol|tng|touch ?n ?go|plus)\\b', 'Petrol, Parking & Tol'),
  out('\\b(grab|taxi|lrt|mrt|airasia|flight|uber|ktm|bus ticket)\\b', 'Transportation / Pengangkutan'),
  out('\\b(salary|salaries|gaji|payroll)\\b', 'Gaji Staff'),
  out('\\b(kwsp|epf)\\b', 'KWSP / EPF'),
  out('\\b(socso|perkeso|eis)\\b', 'SOCSO / PERKESO'),
  out('\\b(rent|rental|sewa|sewaan)\\b', 'Rental / Sewaan'),
  out('\\b(bank|service|ibg|duitnow|transfer|handling)\\s+(fee|fees|charge|charges)\\b|\\bfee charged\\b|\\bbank charges?\\b', 'Bank Charges'),
  out('\\binterest\\b', 'Loan Interest'),
  out('\\b(hotel|agoda|booking\\.com)\\b', 'Hotel'),
  out('\\b(facebook|meta|google|tiktok)\\b.*\\bads?\\b|\\b(facebook|fb|meta) ads?\\b|\\bmarketing\\b|\\badvert(ising|isement)?\\b', 'Marketing'),
  out('\\b(stationery|stationary|printing|alat tulis|percetakan)\\b', 'Alat Tulis & Percetakan'),
  out('\\b(insurance|insurans|takaful)\\b', 'Insurance'),
  out('\\b(ssm|lhdn|majlis|cukai|kerajaan)\\b', 'Caj Kerajaan'),
  out('\\b(lesen|licen[cs]e)\\b', 'Lesen'),
  out('\\bsecretar', 'Secretarial Fee'),
  out('\\baudit', 'Audit'),
  out('\\baccount(ing)? fee', 'Accounting Fee'),
  out('\\b(clinic|klinik|pharmacy|farmasi|medical|hospital)\\b', 'Medical Fee'),
  out('\\b(restaurant|restoran|food|cafe|makan|kopitiam|starbucks|entertain)', 'Entertainment / Hiburan'),
  out('\\b(pos laju|poslaju|j&t|j & t|ninja ?van|dhl|gdex|courier|postage)\\b', 'Postage'),
  out('\\b(training|seminar|kursus|course|workshop)\\b', 'Training & Seminar'),
  out('\\bzakat\\b', 'Zakat Perniagaan'),
  out('\\brepair\\b', 'Repair & Maintenance Umum'),
  out('\\b(stock|stok|raw material|bahan)\\b', 'Stok / Bahan Mentah'),
  out('\\bfreelanc', 'Cost of Sales - Freelance'),
  out('\\b(contractor|subcon)', 'Cost of Sales - Contractor'),
  out('\\b(laptop|computer|komputer)\\b', 'Kelengkapan Komputer'),
  out('\\b(drawing|drawings|ambilan)\\b', 'Ambilan'),
  out('\\b(commission|komisyen)\\b', 'Komisyen'),

  inn('\\b(loan|pinjaman|financing)\\b', 'Loan'),
  inn('\\b(capital|modal)\\b', 'Modal'),
  inn('\\b(interest credit|hibah|dividend|refund)\\b', 'Other Income'),
];

export const FALLBACK: Record<Direction, string> = {
  IN: 'Sales',
  OUT: 'Lain-lain Perbelanjaan',
};
