# EVyap Accounts

Full-stack replacement for the **CmPro.xlsm** Malaysian bookkeeping template: drag-and-drop bank-statement import,
auto-categorisation, and a balanced set of management accounts (P&L, Balance Sheet, Trial Balance, Cash Flow, Notes,
Tax & Zakat) with multi-user login, audit log and Excel/PDF export.

Stack: Next.js 14 (App Router) · TypeScript · Tailwind · Prisma (SQLite for dev / PostgreSQL for production) ·
NextAuth (email + password) · SheetJS / PapaParse / pdf-parse · exceljs · @react-pdf/renderer · Chart.js · Vitest · Playwright.

## Quick start (local, SQLite)

```bash
cp .env.example .env            # then set NEXTAUTH_SECRET and SEED_OWNER_PASSWORD
npm install
SEED_DEMO=true npm run db:setup # generate client, create tables, seed categories/rules/tax config/owner (+ demo data)
npm run dev                     # http://localhost:3000
```

Sign in with `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` from your `.env`. `SEED_DEMO=true` loads the spec's
acceptance fixture (FY2026) so every report shows real numbers straight away.

## Docker Compose (PostgreSQL)

```bash
cp .env.example .env            # set NEXTAUTH_SECRET and SEED_OWNER_PASSWORD
docker compose up --build       # app on http://localhost:3000, Postgres volume `pgdata`
```

The container creates the tables (`prisma db push`), seeds reference data and the owner (idempotent), then starts the app.
> The Docker setup was written but not executed on the machine this was built on (no Docker available) — see `DECISIONS.md`.

`scripts/set-provider.mjs` rewrites the datasource provider in `prisma/schema.prisma` from `DATABASE_URL`
(`file:` → sqlite, `postgres://` → postgresql) whenever `npm run db:generate|db:push|build` runs.

## Tests

```bash
npm test            # Vitest: engine, parsers, categoriser, tax, services (SQLite), acceptance fixture
npm run test:e2e    # builds, then Playwright (uses the installed Google Chrome) on port 3100 with its own DB
npm run typecheck
```

The acceptance cases from the spec (§9) are asserted in both `tests/` (engine + DB services) and `e2e/` (through the UI):
cash 31,887.40 · Total Assets = Total Equity & Liabilities = 44,887.40 · TB Debit = Credit · PPE 4,400.00 ·
trade debtors 5,700.00 · advances 1,400.00 · creditors 500.00 · long-term loans 13,000.00 · net profit 10,887.40 ·
re-import adds 0 rows · undo restores totals · opening capital 15,000 → "Akaun Tidak Tally - Beza 2,000.00".

## Layout

| Path | What |
|---|---|
| `lib/engine.ts` | Pure accounting engine (sen integers) — P&L, balance sheet, cash flow, trial balance, year-end carry-forward |
| `lib/statements.ts` | Report models shared by web pages, Excel export and the PDF pack |
| `lib/import/*` | Date/amount parsing, header detection, column mapping, PDF text parsing, categorisation, AI hook |
| `lib/services/*` | Server-side business logic (zod-validated, audited, year-lock aware) |
| `lib/tax.ts`, `lib/tax-config.ts` | Tax/zakat maths; reliefs & bands stored per year of assessment in the DB |
| `app/(app)/*` | Pages · `app/api/*` route handlers |
| `prisma/` | Schema and seed |
| `i18n/en-ms.json` | Menu, Rujukan and tally strings |

## Roles

`OWNER` everything · `ACCOUNTANT` everything except clear-data / reopen-year / manage-users · `STAFF` data entry only
(no delete, no settings). Users are managed on *Company Profile & Last Year*.

## Using it

1. **Company Profile & Last Year** — company details, closing stock and the nine Last Year Figures. The page shows an
   opening-position tally so imbalances are fixed at the source. **Assets** — opening NBV, cost, rate per asset class.
2. **Import Data** — drop `.xlsx/.xls/.xlsm/.csv` or text bank-statement `.pdf` anywhere in the app. Check the detected
   columns (editable, remembered per bank format), fix categories (corrections become learned rules), **Add to ledger**.
   Duplicates are skipped; every import can be undone from *Recent imports*.
3. **Debtor & Creditor / Invoice | Receipt** — record credit sales/purchases; Invoice → debtor entry, Receipt → Cash In Sales.
4. Reports update live. **Cover Page & Print** produces the A4 management-accounts PDF; **Export to Excel** a styled workbook.
5. **Close year** locks it read-only and creates the next year with carried-forward opening balances.

## Configuration

See `.env.example`. `AI_CATEGORISE=true` + `ANTHROPIC_API_KEY` (and optional `ANTHROPIC_MODEL`) enables AI suggestions for
rows no rule matched; only those descriptions are sent.
