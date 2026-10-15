# Changelog — Zentra Finance

## [1.0.0] — 2026-05-17

### Release pipeline — New
- **NSIS installer**: replaces the legacy `electron-packager` flow. Per-user install (no UAC), desktop + Start menu shortcuts, custom install dir, differential updates (`differentialPackage: true`).
- **Portable .exe**: still produced as an alternative single-file build (does not support auto-update).
- `npm run build` now produces `dist/Zentra Finance-Setup-1.0.0.exe`, the portable variant, `latest.yml`, and `.blockmap` files.
- `npm run release` / `release:draft` / `pack` scripts added. `build:legacy` removed.
- `postinstall` switched to `electron-builder install-app-deps` (rebuilds `better-sqlite3` against Electron's NAPI ABI).

### Auto-update — New
- **`electron-updater`** wired with full lifecycle: checking → available → progress → downloaded → install. Retry-on-transient (3× / 60 s backoff) for `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`, `net::*`.
- First check 5 s after launch; periodic every 4 hours. `autoDownload: false` — user opts in via in-app banner.
- New IPC channels: `updater:check`, `updater:download`, `updater:install`, `updater:status`, `updater:getVersion`, and the `updater:event` push channel.
- New `window.api.updater` namespace exposed via preload (with `onEvent(handler) → unsubscribe`).
- In-app update banner (top-right glass card) wired to lifecycle events — Download / Restart-&-install actions, progress bar.
- Auto-update is automatically disabled when running from source — dev mode is detected via `!app.isPackaged`.

### Logging & crash handling — New
- **`electron-log`** v5. Main log: `%APPDATA%\ZentraFinance\logs\main.log`.
- Uncaught exceptions are captured via `log.errorHandler.startCatching` and surfaced to the user with a non-fatal dialog instead of a silent crash.

### Security — Hardening
- **Content-Security-Policy** meta tag added to `src/index.html`. `eval` / remote scripts blocked. Only Google Fonts whitelisted on `style-src` / `font-src`. `connect-src 'self'` — renderer makes no outbound XHR.
- `setWindowOpenHandler` deflects `target="_blank"` / `window.open()` to `shell.openExternal` and denies new Electron windows.
- `will-navigate` blocks navigation away from `file://` (and `localhost:5173` in dev).
- `will-attach-webview` refused. `webPreferences` explicitly sets `webSecurity: true`, `allowRunningInsecureContent: false`.

### CI/CD — New
- **`.github/workflows/release.yml`**: tag-driven (`v*.*.*`) release pipeline. Verifies tag matches `package.json`, runs `npm run release`, publishes installer + `latest.yml` to GitHub Releases.
- **`.github/workflows/build.yml`**: replaces the legacy `electron-packager` smoke build — now produces an unsigned NSIS installer artifact on every push/PR.
- `permissions: contents: write` set explicitly so the workflow can create releases.

### Version
- Bumped `package.json` from `0.1.0` → `1.0.0`. (CHANGELOG entries prior to 1.0 are retained verbatim — they reflect feature work, not formal releases.)

### Notes
- **Code signing** is scaffolded but inactive: `rfc3161TimeStampServer` configured, `CSC_LINK` / `CSC_KEY_PASSWORD` env vars commented in CI. Until a cert is added, Windows SmartScreen will warn on first install; auto-updates still work because both old and new builds are equally unsigned.
- `electron` moved from `dependencies` → `devDependencies` (electron-builder convention; prevents Electron itself from being packed into the asar).
- `electron-packager` dependency removed.

---

## [0.6.1] — 2026-04-05

### Export System — Improvements
- **PDF export fix**: replaced iframe `print()` with Electron's native `printToPDF` — PDF now saves directly as a `.pdf` file via save dialog instead of opening a print program
- **Date filtering**: added From/To date inputs in the export modal to filter transactions by custom date range (independent of the analytics period selector)
- **Company logo size**: logo in export preview and HTML/PDF reports now renders at 200×200px minimum (was 64px/72px)
- **Company info spacing**: info fields use `flex-direction:column; gap:2px` for tighter, consistent vertical spacing
- **Month format**: Monthly Breakdown tables now show "April 22" instead of "2022-04" — applied in PDF preview, HTML report, XLSX export, and analytics page table

### IPC Additions
- `dialog:exportPDF` — generates PDF via `printToPDF` with save dialog, returns `{ success, filePath }`

---

## [0.6.0] — 2026-04-04

### Analytics Page — New
- Full-featured **Analytics** page with KPI row (total income, expenses, net, transaction count)
- Period selector: 3 months, 6 months, 1 year, all time
- **5 Chart.js charts**: Expense Trend (line), Savings Rate (bar), Category Breakdown (doughnut), Daily Spending (bar), Account Distribution (doughnut)
- Monthly Breakdown table with income/expense/net per month
- Category Details table with transaction counts and percentages
- Top Quellen (sources) list with ranked bars

### Export System — New
- Export from Analytics page in **5 formats**: PDF, CSV, JSON, XLSX, HTML
- **Live preview** panel shows formatted output before downloading
- **10 selectable sections** with checkboxes: Company Info, User Info, Summary, Monthly Data, Categories, Quellen, Accounts, Transactions, Daily Spending, Charts
- Select All / None toggle buttons
- Company & user information included in all export formats
- Charts captured as PNG images and embedded in PDF/HTML exports
- PDF export via hidden iframe print (reliable in Electron)
- XLSX uses Excel XML Spreadsheet format (no external library needed)
- CSV with BOM prefix for Excel compatibility
- Warning shown when company info is missing

### Einnahmenquelle / Ausgabenquelle — New Field
- New **`quelle`** (source) field on transactions: Einnahmenquelle for income, Ausgabenquelle for expenses
- **Automatic extraction** during CSV import using keyword matching from 600+ category keywords (longest match first)
- Backfill on `db:getTransactions` — existing transactions get quelle populated from description
- Visible in transaction cards, editable in Add/Edit modal
- Label dynamically switches based on transaction type
- Included in CSV export as dedicated column

### Navigation Redesign
- Nav tabs (Dashboard, Wallet, Transfer, Categories, Accounts, Analytics) now show **always-visible text labels** (removed hover-reveal animation)
- Added **Analytics** nav tab with `bar-chart-3` icon
- Removed **Refresh** button from top navigation (Ctrl+R shortcut still works)

### Export Layout Improvements
- Company info block redesigned: bordered card layout with proper spacing, larger logo (64px preview / 72px PDF), structured contact line
- XLSX preview now shows full company block, user info, and period metadata (was a single plain-text line)
- Chart images no longer stretch the company logo (`img.chart` class isolates max-width)

### Settings — Tabs & User Management
- Settings page split into 3 tabs: **Company**, **Admin**, **Themes**
- Company tab: logo upload + company info form (stored in localStorage)
- Admin tab: user management (admin-only) — CRUD users with roles
- Themes tab: theme gallery, color editor, nav size customizer
- **User roles system**: admin (full access), editor (CRUD), viewer (read-only)
- **User switcher** dropdown next to nav avatar
- Profile image editor with circular crop, drag, zoom
- `users.json` data file added; seeded from profile.json on first run

### IPC Additions
- `db:getUsers` / `db:saveUser` / `db:deleteUser` — user management channels
- `dialog:exportCSV` — save dialog for CSV export with options
- `dialog:exportBackup` / `dialog:importBackup` — full JSON backup envelope

---

## [0.5.0] — 2026-03-27

### WaffleDotChart — New Global Component
- **Replaced** the Income Sources doughnut chart with a new **WaffleDotChart** dot-grid visualization
- 1 dot = 1 income transaction, min 10 dots Y-axis, auto-grows to match busiest month
- 5 years × 12 months grid with year separators and month labels (Jan, Jul)
- Created as reusable global component: `WaffleDotChart(containerEl, dataByMonth, options?)` in `src/index.html`
- Also available as Svelte component: `src-svelte/components/WaffleDotChart.svelte`
- Configurable: `minDots`, `maxYears`, `color`, `emptyText`, `labelL/R`

### Svelte Build Pipeline
- Added `src-svelte/` scaffolding: 6 pages, 3 modals, 3 components, stores, lib
- Vite + Svelte build pipeline outputs to `dist-renderer/`
- `npm start` **always** loads `src/index.html` (no more accidental Svelte loading)
- New env var: `ELECTRON_SVELTE=1 npm start` to explicitly load Svelte renderer

### Security Fixes
- **XSS prevention**: All 8 inline `onclick` handlers with IDs now use `esc()` to sanitize values
- Escaped: transaction IDs, account IDs, filter function params

### Performance Improvements
- **Deduplicated `autoCategorize()`**: CSV parsers now call it once per transaction (was 2×)
- **Pre-built keyword map**: `_lowerCategoryMap` computed at module load — eliminates 600× `toLowerCase()` per transaction
- **Single-pass aggregation**: `renderDashboard`, `renderAllTx`, `renderCatStrip` compute totals in one loop (was 2–3 separate `filter().reduce()` passes)
- **Chart.js data-hash skip**: `_monthlyChart` and `_catChart` skip destroy/recreate when data fingerprint is unchanged
- **Tooltip AbortController**: Tooltip event listeners wrapped in `initTooltips()` with `_tooltipAbort` to prevent listener accumulation

### Robustness Fixes
- 11 null-date guards added: sort fallbacks (`|| '1970-01-01'`), filter guards, slice safety (`(t.date || '').slice()`)
- UBS parser: fixed optional chaining bug — `(parts[18]?.trim() || '').replace()` prevents crash on short rows
- Untracked `settings.local.json` from git (was causing CRLF conflicts)
- Removed `node_modules/` and `dist/` from git history (exceeded GitHub 100 MB file limit)

---

## [0.4.0] — 2026-03-25

### Dashboard — Clickable Stat Cards with Inline Transaction Panel

- **Total Income** and **Total Expenses** stat cards are now clickable (cursor, chevron-down hint)
- Clicking either card opens an **inline transaction panel** that slides in directly below the stats row — no popup, no navigation
- Clicking the same card again collapses the panel
- The panel adapts to the selected type:
  - Income: green total, `trending-up` icon, `+` prefix
  - Expenses: red total, `trending-down` icon, `-` prefix
- **Account filter dropdown** (left of search) — lists only accounts that have transactions of that type; hidden when all transactions belong to a single account
- **Live search** — filters by description or category simultaneously with the account filter
- Transaction count and running total update live as filters change
- Clicking any row opens the transaction's edit dialog
- Panel resets and closes automatically when the time filter changes
- Implemented as a single generic component: `openTxPanel('income' | 'expense')`

### Bug Fix — Einnahmen category always treated as income

- **Problem:** During CSV import, `type` (income/expense) was derived from the amount sign, while `category` was assigned separately by keyword matching. A transaction could be stored as `type: expense` even when auto-categorised as `Einnahmen`.
- **Fix (`main.js`):** Added `reconcileType(type, category)` — forces `type = 'income'` whenever the resolved category is `Einnahmen`. Applied to all three CSV parsers (Migros, UBS, Generic) at import time.
- **Data repair:** `db:getTransactions` now runs `reconcileType` over all loaded transactions on every app start and persists any corrections back to disk — existing misclassified transactions are fixed automatically on next launch.

---

## [0.3.0] — 2026-03-24

### Accounts Page — Full Analytics Redesign
- Renamed "Payment" nav button → **Accounts** with landmark icon
- Replaced plain account list with a full analytics layout:
  - 4 summary stat cards: Total Accounts, Total Balance, Linked Transactions, Most Active Account
  - `.accp-row` account cards: colored left accent stripe, icon, bank name, account type badge, IBAN, balance, spending bar, transaction count
- Spending bar shows each account's expense share relative to the highest-spending account

### Dashboard — Filter & Stat Card Improvements
- **Filter bar**: replaced chip strip with a right-aligned animated dropdown
  - Trigger button shows the currently active filter label
  - Dropdown opens/closes with fade + scale-in animation, closes on outside click
  - All 8 time filters remain: All Time, Today, This Week, This Month, Last 3 Months, This Year, Last Year, Custom Range
- **Stat card renames** for clarity:
  - "Total Revenue" → **Total Income**
  - "Total Saving" → **Net Savings**
  - "Monthly Expense" → **Total Expenses**

### Category Management
- **Manage modal** added to the Categories page header
  - Lists all categories sorted by transaction count
  - Per-row: color swatch (click to pick), icon preview, editable name, transaction count
  - Saving renames a category across **all matching transactions** on disk via new `db:renameCategory` IPC channel
  - Color changes stored in `localStorage.catColorOverrides` — no transaction data modified
- **`getCatCfg(cat)`** helper merges hardcoded CAT defaults with localStorage color overrides; all render functions use this instead of `CAT[cat]` directly

### Dashboard Charts — Fixes & Improvements
- **Income Sources list** rewritten to show real transaction data grouped by year:
  - Previously showed fabricated salary/freelance/invest fallback amounts
  - Now groups actual income transactions by year (desc) then category — top 4 per year
  - Year separator with year label left and yearly total right
- **Waffle chart dynamic scaling**: `DOT_VAL` is now `ceil(maxMonthly / MAX_DOTS)` so the tallest month always fills the chart; previously all columns were the same height
- **Chart bottom padding**: extra bottom padding added to Income Sources and Category Strip cards
- **20% year gap spacing** in Income Sources list between year sections

### Category Strip — Reusable Sparkline Component
- One unified strip (was incorrectly split per year in an intermediate version)
- Each category sparkline now shows **12 monthly bars × up to 5 years** in a single row
- Year boundary separators rendered inline: `|||||||||||| 2023 |||||||||||| 2024 |||||||||||||`
- **`buildSparkline(mMap, years, color)`** extracted as a reusable component:
  - Parameters: `mMap` = `{ 'YYYY-MM': number }`, `years` = sorted year array, `color` = CSS color string
  - Returns HTML string for any `.cat-bars` container
  - Handles empty data gracefully (all bars at minimum height)

### New IPC Channel
- `db:renameCategory` — batch-renames `.category` on all matching transactions, returns `{ success, count }`

### CSS Additions
- Filter dropdown: `.tfd-wrap`, `.tfd-trigger`, `.tfd-menu`, `.tfd-item`, `.tfd-chevron`, `.tfd-divider`
- Accounts page: `.accp-row`, `.accp-accent`, `.accp-icon`, `.accp-info`, `.accp-name`, `.accp-meta`, `.accp-type-badge`, `.accp-right`, `.accp-balance`, `.accp-bar-wrap`, `.accp-bar`, `.accp-tx-label`
- Category management: `.cat-edit-list`, `.cat-edit-row`, `.cat-edit-color`, `.cat-edit-icon`, `.cat-edit-name`, `.cat-edit-count`
- Sparkline year separators: `.cat-bar-year-gap`, `.cat-bar-year-lbl`
- Income list: `.income-year-section`, `.income-year-section--gap`, `.income-year-label`, `.income-year-total`

---

## [0.2.0] — 2026-03-24

### Account Management — Full Redesign

#### Logo & Branding
- **Icon picker**: 24 finance-related Lucide icons in a scrollable grid, color-matched to the account's card color
- **Image upload & editor**: upload any PNG/JPG/SVG and crop it to a circular logo
  - 280×280 canvas editor with 110px crop circle (220px visible, 30px drag margin)
  - Drag to reposition, scroll-wheel to zoom (cursor-aware pivot), zoom slider
  - Initial scale auto-fits image to fill the crop circle, slider range is dynamic per image
  - Live 44px preview updates in real-time as you drag/zoom
  - 200×200 base64 PNG stored in `bankAccounts.json`, auto-applied on Save
- Tab switcher: **Icon** / **Image** — mutually exclusive, last active tab wins on save

#### New Account Fields
- **Account Type**: Checking, Savings, Investment, Credit Card, Cash, Crypto, Other
- **Account Number**: free-text, optional
- **BIC / SWIFT**: monospace, auto-uppercased on save
- **Notes**: free-text note line shown at bottom of card
- **Currencies expanded**: CHF, EUR, USD, GBP, JPY, BTC
- **Color picker**: 12 preset swatches + native OS custom color input

#### Edit & Delete
- Opening an account card now pre-fills all fields including icon/image/color
- **Delete** button in edit modal with confirmation — unlinks related transactions
- Modal title changes between "Add Bank Account" and "Edit Account"

#### Card Display
- Shows account type badge in card color
- Shows BIC/SWIFT and account number when set
- Shows notes in italics at card bottom
- Image accounts render `<img>` instead of Lucide icon

### Project Cleanup
- Added `.gitignore` (was missing): excludes `node_modules/`, `dist/`, `Zentr-Finance/`, `.DS_Store`, logs, editor configs
- Fixed `setup.bat` title from "ZENTRA PRO" to "Zentra Finance"
- Updated `README.md` with full account schema, all IPC channels including new `db:updateBankAccount` and `db:deleteBankAccount`

---

## [0.1.0] — 2026-03-23

### UI Redesign
- Full Liquid Glass effect across all surfaces (backdrop-filter, ambient orbs, shimmer on hover)
- Duoflow-inspired dashboard layout: two-column grid, stats row, category strip, budget card, income sources, smart insights, recent transactions
- Three themes: Dark, Blue (from `src/Themes/blue.css`), Light — cycled via nav button, persisted in localStorage
- Persistent time filter sub-nav bar (under top nav, visible on all pages)

### Dashboard
- Category strip bar charts thinned to 2px segments (48 bars per category)
- Income Sources waffle chart: X = months (up to 60), Y = 1 dot per CHF 1,000 (max 20), year-gap markers with vertical year labels
- Income Sources card: transaction count badge in header, per-source tx count displayed
- Smart Spending Insights panel

### Transactions Page (full redesign)
- Summary stats strip: total count, income, expenses, net balance
- Toolbar: live search, type tabs (All / Income / Expense), category filter, sort
- Grouped by date: Today, Yesterday, This Week, This Month, Month/Year
- Card grid layout — responsive auto-fill grid with glass cards
- Per-card: category icon, type pill, bold amount, description, category badge, date, optional account tag

### Wallet Page (full redesign)
- Net Worth hero banner with income / expenses / net cash flow stats
- Account card grid: colored stripe, bank icon, name, masked IBAN, tx count
- Per-account income and expense breakdown (green/red mini boxes)
- Current Balance = Initial Balance + linked income tx − linked expense tx
- Recent Activity list (last 8 transactions)
- Responsive: 2-column grid on small screens, fluid `clamp()` font sizes, `word-break: break-all`

### Bug Fixes
- Fixed `t.accountId` → `t.bankAccountId` mismatch causing CHF 0.00 on all wallet cards
- Fixed waffle chart dot scaling to use relative-to-max rather than fixed CHF/dot threshold

### Responsive
- Full breakpoint system: 1100px, 900px, 640px
- Income Sources card: side-by-side waffle + income list on small screens
- Transaction table columns hidden progressively on smaller widths

---

## [pre-0.1.0] — earlier

- Initial Electron app with Migros / UBS / PostFinance CSV import
- Basic dashboard, transactions list, wallet, categories, profile pages
- File-based JSON storage in `%APPDATA%\ZentraFinance\data\`
- 600+ keyword auto-categorisation across 16 categories
