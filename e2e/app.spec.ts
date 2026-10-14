import * as XLSX from 'xlsx';
import { expect, test, type Page } from '@playwright/test';
import { E2E_ENV } from '../playwright.config';

function fixtureXlsx(): Buffer {
  const rows = [
    ['Date', 'Description', 'Debit', 'Credit', 'Category'],
    ['02/01/2026', 'Payment from customer', null, 8500, null],
    ['05/01/2026', 'TNB electricity', 412.6, null, null],
    ['10/02/2026', 'Laptop purchase', 3000, null, 'Kelengkapan Komputer'],
    ['11/02/2026', 'Payment from ABC Sdn Bhd', null, 2500, 'Debtor'],
    ['12/02/2026', 'Owner drawing', 1000, null, 'Ambilan'],
    ['13/02/2026', 'Raw material', 2300, null, null],
    ['14/03/2026', 'Pay supplier', 1500, null, 'Creditor'],
    ['15/03/2026', 'Loan disbursement', null, 10000, null],
    ['16/03/2026', 'Rental deposit', 900, null, 'Security Deposits'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Statement');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function login(page: Page, email = E2E_ENV.SEED_OWNER_EMAIL, password = E2E_ENV.SEED_OWNER_PASSWORD, expectOk = true) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  if (expectOk) await page.waitForURL(/\/dashboard/);
}

test.describe.configure({ mode: 'serial' });

test('wrong password is rejected, owner can sign in', async ({ page }) => {
  await login(page, E2E_ENV.SEED_OWNER_EMAIL, 'definitely-wrong-password', false);
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('Monthly Profit')).toBeVisible();
});

test('setup year, import the spec fixture, books balance, duplicates skipped, undo restores', async ({ page }) => {
  await login(page);
  await page.goto('/setup');
  const fill = async (label: string, v: string) => page.getByLabel(label).fill(v);
  await fill('Stok Akhir / Closing Stock (RM)', '1500');
  await fill('Stok Awal (Opening Stock)', '1000');
  await fill('Modal Awal (Opening Capital)', '17000');
  await fill('Untung/Rugi Mula (Opening P&L)', '4500');
  await fill('Baki Mula (Opening Cash & Bank)', '20000');
  await fill('Long Term Loan', '3000');
  await fill('Advances, Deposits & Prepayment', '500');
  await fill('Trade Debtor', '3000');
  await fill('Creditor, accruals & other liabilities', '2000');
  await page.getByRole('button', { name: 'Save figures' }).click();
  await expect(page.getByText('Figures saved.')).toBeVisible();

  // fixed asset: Kelengkapan Komputer opening NBV 2,000 @ 20%
  await page.goto('/assets');
  await page.getByLabel('Kelengkapan Komputer opening NBV').fill('2000');
  await page.getByLabel('Kelengkapan Komputer opening NBV').blur();
  await page.getByLabel('Kelengkapan Komputer rate').fill('20');
  await page.getByLabel('Kelengkapan Komputer rate').blur();
  await expect(page.getByLabel('Kelengkapan Komputer rate')).toHaveValue('20');

  // debtor entries: ABC Sdn Bhd 4,000 and XYZ Bhd 1,200
  await page.goto('/debtor-creditor');
  for (const [name, amt] of [['ABC Sdn Bhd', '4000'], ['XYZ Bhd', '1200']]) {
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Amount').fill(amt);
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Entry added.')).toBeVisible();
  }

  // import
  await page.goto('/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'statement.xlsx', mimeType: 'application/octet-stream', buffer: fixtureXlsx() });
  await expect(page.getByText('9 transactions detected')).toBeVisible();
  const tnb = page.getByRole('row', { name: /TNB electricity/ });
  await expect(tnb.getByLabel('Category')).toHaveValue('Bil Air & Elektrik');
  await expect(page.getByRole('row', { name: /Raw material/ }).getByLabel('Category')).toHaveValue('Stok / Bahan Mentah');
  await expect(page.getByRole('row', { name: /Loan disbursement/ }).getByLabel('Category')).toHaveValue('Loan');
  // debtor / creditor receipts need a party name
  await page.getByRole('row', { name: /Payment from ABC/ }).getByLabel('Debtor or creditor name').fill('ABC Sdn Bhd');
  await page.getByRole('row', { name: /Pay supplier/ }).getByLabel('Debtor or creditor name').fill('Supplier A');
  await page.getByRole('button', { name: 'Add to ledger' }).click();
  await expect(page.getByText('9 transactions added')).toBeVisible();

  await page.goto('/balance-sheet');
  await expect(page.getByText('Akaun Tepat')).toBeVisible();
  await expect(page.getByRole('row', { name: /Total Assets/ })).toContainText('44,887.40');
  await expect(page.getByRole('row', { name: /Total Equity & Liabilities/ })).toContainText('44,887.40');
  await page.goto('/cash-flow');
  await expect(page.getByRole('row', { name: /at the end of the period/ })).toContainText('31,887.40');
  await page.goto('/trial-balance');
  await expect(page.getByText('Akaun Tepat')).toBeVisible();
  await page.goto('/pl-yearly');
  await expect(page.getByRole('row', { name: /Net profit \/ \(Loss\) before tax/ })).toContainText('10,887.40');

  // re-import adds nothing
  await page.goto('/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'statement.xlsx', mimeType: 'application/octet-stream', buffer: fixtureXlsx() });
  await expect(page.getByText('already in the books')).toBeVisible();
  await page.getByRole('button', { name: 'Add to ledger' }).click();
  await expect(page.getByText('Nothing new to add')).toBeVisible();

  // undo the import -> cash back to opening 20,000
  await page.reload();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await expect(page.getByText('9 transactions removed.')).toBeVisible();
  await page.goto('/dashboard');
  await expect(page.getByText('20,000.00').first()).toBeVisible();
});

test('opening capital 15,000 shows the tally difference', async ({ page }) => {
  await login(page);
  await page.goto('/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'statement.xlsx', mimeType: 'application/octet-stream', buffer: fixtureXlsx() });
  await expect(page.getByText('9 transactions detected')).toBeVisible();
  await page.getByRole('row', { name: /Payment from ABC/ }).getByLabel('Debtor or creditor name').fill('ABC Sdn Bhd');
  await page.getByRole('row', { name: /Pay supplier/ }).getByLabel('Debtor or creditor name').fill('Supplier A');
  await page.getByRole('button', { name: 'Add to ledger' }).click();
  await expect(page.getByText('9 transactions added')).toBeVisible();
  await page.goto('/setup');
  await page.getByLabel('Modal Awal (Opening Capital)').fill('15000');
  await page.getByRole('button', { name: 'Save figures' }).click();
  await expect(page.getByText('Figures saved.')).toBeVisible();
  await page.goto('/balance-sheet');
  await expect(page.getByText('Akaun Tidak Tally - Beza 2,000.00')).toBeVisible();
});

test('invoice records once as a debtor; STAFF cannot delete', async ({ page }) => {
  await login(page);
  await page.goto('/invoices');
  await page.getByLabel('Company', { exact: true }).fill('Acme Trading');
  await page.getByLabel('Description 1').fill('Consulting');
  await page.getByLabel('Price 1').fill('500');
  await page.getByLabel('Quantity 1').fill('2');
  await expect(page.locator('.paper tr.tot')).toContainText('1,000.00');
  await page.getByRole('button', { name: '✓ Record' }).click();
  await expect(page.getByText('Recorded as Debtor (credit sale).')).toBeVisible();
  await expect(page.getByRole('button', { name: '✓ Record' })).toBeDisabled();
  await page.goto('/debtor-creditor');
  await expect(page.getByRole('cell', { name: 'Acme Trading' }).first()).toBeVisible();

  // create a STAFF user and check restrictions
  await page.goto('/setup');
  await page.getByLabel('New user name').fill('Clerk');
  await page.getByLabel('New user email').fill('clerk@evyap.local');
  await page.getByLabel('New user password').fill('Clerk-Password-123');
  await page.getByRole('button', { name: 'Add user' }).click();
  await expect(page.getByText('User added.')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await login(page, 'clerk@evyap.local', 'Clerk-Password-123');
  await page.goto('/ledger');
  await expect(page.getByRole('button', { name: 'Delete entry' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear All' })).toHaveCount(0);
  await page.goto('/setup');
  await expect(page.getByRole('button', { name: 'Save figures' })).toBeDisabled();
});

test('exports download', async ({ page }) => {
  await login(page);
  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => { location.href = '/api/export/excel?year=' + new Date().getFullYear(); })]);
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
  const pdf = await page.request.get('/api/pdf/pack?year=2026');
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
});
