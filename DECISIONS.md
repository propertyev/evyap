# Decisions & deviations

Where the spec or prototype was ambiguous, this is what was built and why.

## Environment
- **Node.js** was not installed on the build machine; Node 20.20.2 (official tarball, SHA-256 verified) was unpacked into `.tools/` (git-ignored). Nothing was installed system-wide.
- **Docker / PostgreSQL were not available** on the build machine. All automated tests (Vitest and Playwright) ran on **SQLite**. The Prisma schema avoids SQLite-only and Postgres-only features (enums are `String`, JSON is `String`, money is `BigInt`), and `scripts/set-provider.mjs` switches the datasource provider from `DATABASE_URL`. `docker-compose.yml` / `Dockerfile` are written but **have not been executed**.
- Playwright drives the locally installed **Google Chrome** (`channel: 'chrome'`) so no browser download is needed.

## Money
- All amounts are integer **sen**. DB columns are `BigInt` (an `Int` caps at RM 21.4 m, too small for opening balances/land); services convert to JS `number` (safe to RM 90 trillion).
- Percent-based figures (depreciation, zakat, tax bands) are rounded **half away from zero to the nearest sen** once per computed line.
- Depreciation per asset = `round((cost + additions) × rate%)`; the yearly charge is spread over 12 months so the monthly figures sum **exactly** to the annual charge (remainder placed in the last months).

## Categories
- "Petrol, Parking & Tol" is **one** category (as in the prototype/CmPro), not three.
- Categories are per company (rows in `Category`) so custom categories can be added later; the engine takes an optional category→group map and falls back to CmPro's built-ins. Unknown OUT categories count as Administrative, unknown IN as Sales so cash always tallies.
- Account codes: Sales 4101, Other Income 4901, FA 1101–1107, PREP 1581–1585, COS 5100–5104, EXP 5201+ in list order, Depreciation 5299, Credit Purchases 5199.

## Engine
- The formulas in the spec are implemented literally. `Cost` on the Assets sheet is only the depreciation base for assets already held; it does not change NBV.
- **Monthly** net profit (dashboard chart, Performance, P&L Monthly/Summary) excludes the opening/closing stock adjustment, which is a year-end figure — so the sum of the 12 months can differ from the yearly net profit by the stock movement. This is what the prototype/CmPro do.
- Trial Balance: a normally-debit account with a negative balance (e.g. overdrawn bank) is shown on the credit side (and vice-versa), so Debit = Credit holds whenever the Balance Sheet tallies. Closing stock stays outside the TB.
- Year-end close: `openCapital = Capital − Ambilan`, `openPL = openPL + NetProfit`, stock/cash/debtors/advances/creditors/loan carry as specified; `openOtherLTLiab` also carries forward; fixed assets carry `openingNBV = closingNBV` and `cost = cost + additions` (so next year's depreciation base includes this year's additions); closing stock for the new year starts at 0. Closing is **blocked when the Balance Sheet does not tally** unless the user confirms "close anyway" (`force`).

## Import
- Bank-format memory is stored in an extra table `BankFormat` (fingerprint of the normalised header row → column map).
- Dedup `hash` = sha1(`date|amount|direction|normalised details`); genuinely repeated identical rows in one file get an occurrence suffix (`#1`, `#2`…) so two identical RM 5.00 coffees on one day are both imported, while re-importing the same file still adds 0 rows. Manual/receipt entries get random hashes.
- A "Dr/Cr" `Type` column is detected by its **values** (all DR/CR/Debit/Credit/In/Out); otherwise a `Type` column is the category column.
- Learned rules (priority 10, `learned = true`) are created from corrections made in the preview: the keyword is the first 1–2 distinctive tokens of the description (digits, months and bank noise words removed). They take precedence over the seeded rules.
- PDF statements are parsed heuristically from text (date at line start, trailing amounts, direction from the running balance, else Dr/Cr suffix, else keywords — guessed rows are flagged). Scanned/image PDFs are not supported.
- Rows whose Debtor/Creditor category has no party name are allowed on import (shown as "(unassigned payments)"); manual entries require the party.
- AI categorisation (`AI_CATEGORISE=true` + `ANTHROPIC_API_KEY`) only sends descriptions of rows that no rule matched and only accepts answers that are in the category list for that direction.

## Debtor / Creditor
- Payments are linked by an explicit `partyName` on the transaction (no fuzzy matching). Outstanding by name is computed for the selected year; opening balances (b/f) are shown as a single "all names" line because the Last Year Figure is one number.

## Permissions
- **OWNER**: everything. **ACCOUNTANT**: everything except *clear data*, *reopen year* and *manage users*. **STAFF**: add/edit data only — no delete, no import-undo, no settings (company profile, last-year figures, assets, tax settings), no year close.
- Editing/deleting rows in a **locked** year is rejected server-side for every role.

## UI
- Statement labels are English in code; the menu, Rujukan instructions and tally messages come from `i18n/en-ms.json`.
- Dates are stored as ISO strings (`YYYY-MM-DD`) rather than timestamps to avoid time-zone shifts in accounting dates.
- Invoice/receipt PDFs and the management pack use the built-in Helvetica font (no network font fetch). react-pdf has no "double" border, so grand totals use two rules.

## Not done / limits
- No login rate-limiting or password reset flow (OWNER can create users and set passwords).
- `npm audit` reports advisories against Next.js 14.2.x (the spec pins 14); upgrade within 14.2 as patches ship.
- Multi-company is supported in the schema/services (`companyId` everywhere) but there is no UI to create a second company.
