# Changelog — Zentra Finance

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
