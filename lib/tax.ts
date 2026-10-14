// Tax & Zakat estimation — pure functions, amounts in sen.
import { pct } from './money';

export type ReliefKind = 'FIXED' | 'CAPPED' | 'PER';

export interface ReliefConfig {
  idx: number;
  label: string;
  limit: number; // sen (per child when kind = PER)
  kind: ReliefKind;
}

export interface BandConfig {
  upTo: number | null; // sen; null = no upper bound
  ratePct: number;
}

const rm = (n: number) => n * 100;

const RELIEFS: Omit<ReliefConfig, 'idx'>[] = [
  { label: 'Individu / diri sendiri', limit: rm(9000), kind: 'FIXED' },
  { label: 'Perbelanjaan rawatan perubatan / penjagaan ibu bapa', limit: rm(8000), kind: 'CAPPED' },
  { label: 'Peralatan sokongan asas (OKU)', limit: rm(6000), kind: 'CAPPED' },
  { label: 'Individu yang kurang upaya', limit: rm(7000), kind: 'CAPPED' },
  { label: 'Yuran pengajian (Sendiri)', limit: rm(7000), kind: 'CAPPED' },
  { label: 'Perbelanjaan perubatan penyakit serius / kesuburan / vaksin / pemeriksaan', limit: rm(10000), kind: 'CAPPED' },
  { label: 'Gaya hidup – buku, komputer, telefon, internet, yuran pembelajaran kendiri', limit: rm(2500), kind: 'CAPPED' },
  { label: 'Gaya hidup tambahan – aktiviti sukan', limit: rm(1000), kind: 'CAPPED' },
  { label: 'Peralatan penyusuan ibu', limit: rm(1000), kind: 'CAPPED' },
  { label: 'Yuran taska / tadika (anak ≤6 tahun)', limit: rm(3000), kind: 'CAPPED' },
  { label: 'Tabungan bersih SSPN', limit: rm(8000), kind: 'CAPPED' },
  { label: 'Suami / Isteri / Bayaran alimoni', limit: rm(4000), kind: 'CAPPED' },
  { label: 'Suami / Isteri kurang upaya', limit: rm(6000), kind: 'CAPPED' },
  { label: 'Anak bawah 18 tahun (RM2,000 seorang)', limit: rm(2000), kind: 'PER' },
  { label: 'Anak 18+ belajar – Matrikulasi / Pra-U', limit: rm(2000), kind: 'PER' },
  { label: 'Anak 18+ belajar – Diploma & ke atas', limit: rm(8000), kind: 'PER' },
  { label: 'Anak kurang upaya', limit: rm(8000), kind: 'PER' },
  { label: 'Insurans nyawa dan KWSP', limit: rm(7000), kind: 'CAPPED' },
  { label: 'Skim persaraan swasta (PRS)', limit: rm(3000), kind: 'CAPPED' },
  { label: 'Insurans pendidikan dan perubatan', limit: rm(4000), kind: 'CAPPED' },
  { label: 'Caruman PERKESO', limit: rm(350), kind: 'CAPPED' },
  { label: 'Kenderaan elektrik – caj EV / kompos', limit: rm(2500), kind: 'CAPPED' },
];

export const DEFAULT_RELIEFS: ReliefConfig[] = RELIEFS.map((r, idx) => ({ idx, ...r }));

export const DEFAULT_BANDS: BandConfig[] = [
  { upTo: rm(5000), ratePct: 0 },
  { upTo: rm(20000), ratePct: 1 },
  { upTo: rm(35000), ratePct: 3 },
  { upTo: rm(50000), ratePct: 6 },
  { upTo: rm(70000), ratePct: 11 },
  { upTo: rm(100000), ratePct: 19 },
  { upTo: rm(400000), ratePct: 25 },
  { upTo: rm(600000), ratePct: 26 },
  { upTo: rm(2000000), ratePct: 28 },
  { upTo: null, ratePct: 30 },
];

export interface TaxInput {
  pbt: number; // profit before tax & zakat (sen)
  zakatPct: number;
  zakatPaid: number; // sen
  reliefs: ReliefConfig[];
  claims: Record<number, number>; // idx -> claimed sen (CAPPED)
  childCounts: Record<number, number>; // idx -> number of children (PER)
  bands: BandConfig[];
}

export interface TaxResult {
  pbt: number;
  zakat: number;
  afterZakat: number;
  reliefLines: { idx: number; label: string; kind: ReliefKind; limit: number; claimed: number; allowed: number }[];
  totalRelief: number;
  chargeable: number;
  bandRows: { from: number; to: number; ratePct: number; tax: number }[];
  tax: number;
  zakatPaid: number;
  taxPayable: number;
}

export function relief(r: ReliefConfig, claim: number, count: number): number {
  if (r.kind === 'FIXED') return r.limit;
  if (r.kind === 'PER') return Math.max(0, Math.floor(count)) * r.limit;
  return Math.min(Math.max(0, claim), r.limit);
}

export function computeTax(input: TaxInput): TaxResult {
  const { pbt } = input;
  const zakat = pbt > 0 ? pct(pbt, input.zakatPct) : 0;
  const reliefLines = input.reliefs.map((r) => {
    const claimed = r.kind === 'PER' ? input.childCounts[r.idx] ?? 0 : r.kind === 'FIXED' ? r.limit : input.claims[r.idx] ?? 0;
    return {
      idx: r.idx, label: r.label, kind: r.kind, limit: r.limit, claimed,
      allowed: relief(r, input.claims[r.idx] ?? 0, input.childCounts[r.idx] ?? 0),
    };
  });
  const totalRelief = reliefLines.reduce((a, r) => a + r.allowed, 0);
  const chargeable = Math.max(0, pbt - totalRelief);

  const bandRows: TaxResult['bandRows'] = [];
  let prev = 0;
  let tax = 0;
  for (const b of input.bands) {
    if (chargeable <= prev) break;
    const cap = b.upTo ?? Number.POSITIVE_INFINITY;
    const top = Math.min(chargeable, cap);
    const t = pct(top - prev, b.ratePct);
    bandRows.push({ from: prev, to: top, ratePct: b.ratePct, tax: t });
    tax += t;
    prev = cap;
  }
  return {
    pbt, zakat, afterZakat: pbt - zakat, reliefLines, totalRelief, chargeable, bandRows, tax,
    zakatPaid: input.zakatPaid,
    taxPayable: Math.max(0, tax - input.zakatPaid),
  };
}
