import { describe, expect, it } from 'vitest';
import { parseAmount } from '@/lib/import/amounts';
import { categorise, compileRules, learnKeyword, type CategoryLite, type RuleLite } from '@/lib/import/categorise';
import { detectColumns, findHeaderRow } from '@/lib/import/columns';
import { parseDate } from '@/lib/import/dates';
import { parseUpload } from '@/lib/import/parse';
import { parseStatementText } from '@/lib/import/pdf';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import { DEFAULT_RULES } from '@/lib/rules';
import { computeTax, DEFAULT_BANDS, DEFAULT_RELIEFS } from '@/lib/tax';

describe('dates', () => {
  it.each([
    ['05/01/2026', '2026-01-05'], ['5-1-26', '2026-01-05'], ['05 Jan 2026', '2026-01-05'], ['5-Jan-26', '2026-01-05'],
    ['2026-01-05', '2026-01-05'], ['2026/01/05', '2026-01-05'], ['31/12/2025', '2025-12-31'],
  ])('%s', (input, out) => expect(parseDate(input)).toBe(out));
  it('Excel serials', () => expect(parseDate(46027)).toBe('2026-01-05'));
  it('rejects invalid', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('Total')).toBeNull();
  });
  it('day/month with year hint', () => expect(parseDate('05/01', 2026)).toBe('2026-01-05'));
});

describe('amounts', () => {
  it.each([
    ['RM 1,234.56', 123456], ['(500.00)', -50000], ['500.00-', -50000], ['500.00 DR', -50000],
    ['500.00 CR', 50000], ['-12', -1200], [1234.5, 123450], ['+7.10', 710],
  ])('%s', (input, out) => expect(parseAmount(input)).toBe(out));
  it('non-numeric', () => expect(parseAmount('n/a')).toBeNull());
});

const cats: CategoryLite[] = DEFAULT_CATEGORIES.map((c) => ({ name: c.name, direction: c.direction }));
const rules = compileRules(
  DEFAULT_RULES.map((r, i): RuleLite => ({ pattern: r.pattern, isRegex: true, category: r.category, direction: r.direction, priority: 100 + i })),
);
const cat = (d: string, dir: 'IN' | 'OUT' = 'OUT', hint: string | null = null) => categorise(d, dir, hint, cats, rules).category;

describe('categorisation rules', () => {
  it.each([
    ['TNB electricity', 'Bil Air & Elektrik'], ['Unifi broadband', 'Bil Telefon'], ['Shell petrol JB', 'Petrol, Parking & Tol'],
    ['Grab ride', 'Transportation / Pengangkutan'], ['Staff salary Jan', 'Gaji Staff'], ['KWSP employer', 'KWSP / EPF'],
    ['PERKESO Jan', 'SOCSO / PERKESO'], ['Office rent Feb', 'Rental / Sewaan'], ['Bank service charge', 'Bank Charges'],
    ['Loan interest', 'Loan Interest'], ['Agoda booking', 'Hotel'], ['Facebook ads', 'Marketing'],
    ['Google Workspace', 'Perbelanjaan IT'], ['J&T courier', 'Postage'], ['Raw material', 'Stok / Bahan Mentah'],
    ['Laptop Dell', 'Kelengkapan Komputer'], ['Owner drawing', 'Ambilan'], ['Random vendor', 'Lain-lain Perbelanjaan'],
    ['Total order', 'Lain-lain Perbelanjaan'], // "tol" must not match inside "total"
  ])('OUT %s -> %s', (d, c) => expect(cat(d)).toBe(c));

  it.each([
    ['Loan disbursement', 'Loan'], ['Modal injection', 'Modal'], ['Hibah credit', 'Other Income'], ['Customer payment', 'Sales'],
  ])('IN %s -> %s', (d, c) => expect(cat(d, 'IN')).toBe(c));

  it('category column wins and fixes direction', () => {
    const r = categorise('whatever', 'OUT', 'debtor', cats, rules);
    expect(r).toMatchObject({ category: 'Debtor', direction: 'IN', source: 'column' });
  });
  it('learnKeyword picks distinctive tokens', () => {
    expect(learnKeyword('PAYMENT TO ZXQ TRADING 88123 INV')).toBe('zxq trading');
    expect(learnKeyword('12345')).toBeNull();
  });
});

describe('header detection and mapping', () => {
  const rows = [['Bank X'], [], ['Tarikh', 'Butiran', 'Debit', 'Kredit', 'Baki'], ['01/01/2026', 'Foo', '10.00', '', '90.00']];
  it('finds the header within the first 30 rows', () => expect(findHeaderRow(rows)).toBe(2));
  it('maps Malay headers', () => {
    expect(detectColumns(rows[2])).toMatchObject({ date: 0, details: 1, out: 2, in: 3 });
  });
  it('treats a Dr/Cr "Type" column as a flag', () => {
    const m = detectColumns(['Date', 'Description', 'Type', 'Amount'], [['1/1/26', 'a', 'DR', '5'], ['2/1/26', 'b', 'CR', '7']]);
    expect(m).toMatchObject({ date: 0, details: 1, flag: 2, amount: 3 });
    expect(m.category).toBeUndefined();
  });
});

describe('file parsing', () => {
  it('single signed amount column: negative is Cash Out; Dr/Cr flag respected', async () => {
    const csv = 'Date,Particulars,Amount,Dr/Cr\n01/02/2026,Pay A,100.00,DR\n02/02/2026,From B,250.00,CR\n03/02/2026,C,-30.00,\n';
    const [s] = await parseUpload(Buffer.from(csv), 'x.csv');
    expect(s.rows.map((r) => [r.direction, r.amount])).toEqual([['OUT', 10000], ['IN', 25000], ['OUT', 3000]]);
  });
  it('remembers saved column maps by header signature', async () => {
    const csv = 'Date,Details,Amount\n01/02/2026,x,5\n';
    const [first] = await parseUpload(Buffer.from(csv), 'x.csv');
    const saved = new Map([[first.signature, { date: 0, details: 1, amount: 2 }]]);
    const [second] = await parseUpload(Buffer.from(csv), 'y.csv', { savedFormats: saved });
    expect(second.mapSource).toBe('saved');
  });
});

describe('pdf statement text', () => {
  const text = [
    'MAYBANK STATEMENT 31 JAN 2026',
    '01/01/26 BALANCE B/F 10,000.00',
    '02/01/26 TRANSFER FROM CUSTOMER A 2,000.00 12,000.00',
    'REF 12345',
    '05/01/26 TNB ELECTRICITY 412.60 11,587.40',
    '10/01/26 SALARY 1,000.00- 10,587.40',
  ].join('\n');
  it('reads rows and infers direction from the running balance', () => {
    const { rows } = parseStatementText(text);
    expect(rows.map((r) => [r.date, r.direction, r.amount])).toEqual([
      ['2026-01-02', 'IN', 200000], ['2026-01-05', 'OUT', 41260], ['2026-01-10', 'OUT', 100000],
    ]);
    expect(rows[0].details).toContain('REF 12345');
  });
});

describe('tax & zakat', () => {
  const base = { zakatPct: 2.5, zakatPaid: 0, reliefs: DEFAULT_RELIEFS, claims: {}, childCounts: {}, bands: DEFAULT_BANDS };
  it('applies fixed relief, bands and zakat rebate', () => {
    const r = computeTax({ ...base, pbt: 10_000_000 }); // RM100,000
    expect(r.zakat).toBe(250000);
    expect(r.totalRelief).toBe(900000);
    expect(r.chargeable).toBe(9_100_000); // RM91,000
    // 0 + 150 + 450 + 900 + 2200 + 19%*21,000=3990 = RM7,690
    expect(r.tax).toBe(769000);
    expect(computeTax({ ...base, pbt: 10_000_000, zakatPaid: 250000 }).taxPayable).toBe(519000);
  });
  it('caps claims at the limit and multiplies per-child reliefs', () => {
    const r = computeTax({ ...base, pbt: 20_000_000, claims: { 6: 999_999_999 }, childCounts: { 13: 3 } });
    expect(r.reliefLines.find((l) => l.idx === 6)!.allowed).toBe(250000);
    expect(r.reliefLines.find((l) => l.idx === 13)!.allowed).toBe(600000);
  });
  it('no tax or zakat on a loss', () => {
    const r = computeTax({ ...base, pbt: -500000 });
    expect(r.zakat).toBe(0);
    expect(r.tax).toBe(0);
  });
});

describe('AI categorisation (flagged)', () => {
  it('only accepts categories from the allowed list', async () => {
    const { suggestCategories } = await import('@/lib/import/ai');
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const fake = (async () =>
      new Response(JSON.stringify({ content: [{ type: 'text', text: '{"0":"Hotel","1":"Made Up Category","2":"Sales"}' }] }))) as unknown as typeof fetch;
    const res = await suggestCategories(
      [
        { id: 0, details: 'Some inn', direction: 'OUT' },
        { id: 1, details: 'x', direction: 'OUT' },
        { id: 2, details: 'y', direction: 'OUT' }, // "Sales" is a Cash In category -> rejected for OUT
      ],
      cats,
      fake,
    );
    expect(res.get(0)).toBe('Hotel');
    expect(res.has(1)).toBe(false);
    expect(res.has(2)).toBe(false);
  });
});
