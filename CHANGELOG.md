# Changelog — Zentra Finance

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
