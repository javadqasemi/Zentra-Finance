# Changelog — Zentra Finance

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
