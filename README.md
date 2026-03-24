# Zentra Finance

A modern personal finance & banking management desktop app for Windows, built with Electron. Features a liquid glass UI, multi-bank CSV import, account image editor, category management, and full offline data storage.

---

## Features

### Dashboard
- Live stats: **Total Income**, **Net Savings**, **Total Expenses**, Net Balance
  - **Total Income** and **Total Expenses** are clickable — clicking opens an inline transaction panel directly below the stats row
- **Time filter dropdown** (right-aligned, animated): All Time / Today / This Week / This Month / Last 3 Months / This Year / Last Year / Custom Range
- **Category Strip**: top 5 expense categories, each with a unified sparkline showing 12 monthly bars × up to 5 years with inline year separators (`|||||||||||| 2023 |||||||||||| 2024 |||||||||||||`)
- Budget Usage card with segmented progress bar
- **Income Sources** waffle chart — dynamically scaled (`DOT_VAL = ceil(maxMonthly / 20)`), year-gap markers with vertical year labels
- **Income Sources list** — grouped by year (descending), top 4 categories per year, yearly total shown in section header
- Smart Spending Insights panel
- Recent Transactions (last 6)

#### Inline Transaction Panel
Appears between the stats row and category strip when a clickable stat card is activated:
- **Account filter dropdown** — left of the search box; lists only accounts with transactions of the active type; hidden when only one account is involved
- **Live search** — filters by description or category; combined with account filter
- Transaction count + running total update as filters change
- Each row opens the transaction edit dialog on click
- Panel collapses when the same card is clicked again, or when the time filter changes

### Transactions Page
- Summary stats: total count, income, expenses, net balance
- Live search by description or category
- Filter by type (All / Income / Expenses) and category
- Sort by date or amount
- Transactions grouped by date (Today, Yesterday, This Week, This Month, Month/Year)
- Card grid layout — responsive, glass cards

### Wallet Page
- Net Worth hero banner: total calculated balance across all accounts + income/expense/net flow stats
- Account cards: per-account income, expense, and current balance (initial + linked tx)
- Balance formula: `Current Balance = Initial Balance + Income Transactions − Expense Transactions`
- Account type badge, BIC/SWIFT, account number, and notes shown on card
- Recent activity list (last 8 transactions)

### Accounts Page
- Summary stat cards: Total Accounts, Total Balance, Linked Transactions, Most Active Account
- Per-account rows with colored left accent stripe, icon/image, bank name, account type badge, IBAN, balance, relative spending bar, and transaction count
- **Account management modal**: create, edit, delete
  - **Logo picker**: 24 finance-related icons (landmark, credit-card, wallet, piggy-bank, coins, bitcoin, etc.)
  - **Image upload & editor**: pick any PNG/JPG/SVG, drag to reposition, scroll or slider to zoom — live circular crop preview, auto-saved on account save
  - **Color picker**: 12 preset swatches + custom color input
  - **Account fields**: Bank Name, Account Name, Account Type, Currency, Balance, IBAN, Account Number, BIC/SWIFT, Notes
  - **Account types**: Checking, Savings, Investment, Credit Card, Cash, Crypto, Other
  - **Currencies**: CHF, EUR, USD, GBP, JPY, BTC
  - **Edit & delete** from the same modal

### Categories Page
- Expense breakdown by category with % of total
- **Manage modal**: rename categories, change colors
  - Renaming a category auto-updates the label on **all matching transactions** on disk
  - Color overrides stored in `localStorage` — transaction data is not modified
  - Categories listed sorted by transaction count

### CSV Import
| Bank | Parser |
|------|--------|
| Migros Bank | Semi-colon separated |
| UBS | 22-column with BOM |
| PostFinance | Semi-colon separated |
| Any other | Generic auto-detection |

### Themes
Three themes cycled via the top-nav button:

| Theme | Base |
|-------|------|
| Dark | `#07070e` + neon yellow primary |
| Blue | `#060d1f` deep navy |
| Light | `#f0f2f8` frosted white |

### Other
- Profile page: name, email, clear all data

---

## Architecture

```
Zentra-Finance/
├── main.js              # Electron main process — IPC handlers, CSV parsers, JSON storage
├── package.json         # Dependencies & build scripts
├── setup.bat            # One-click Windows setup & launch
├── .gitignore
└── src/
    ├── index.html       # Entire UI — CSS, HTML, JS (single file)
    ├── logo.png
    └── Themes/
        └── blue.css     # Blue theme token reference
```

### Data Storage (local, offline)

All data is stored in JSON files on the user's machine — no cloud, no accounts required.

```
%APPDATA%\ZentraFinance\data\
├── transactions.json    # All transactions
├── bankAccounts.json    # Bank accounts (includes imageSrc as base64)
├── profile.json         # User profile
└── categories.json      # Category keywords for auto-categorisation
```

Category color overrides are stored separately in `localStorage` under the key `catColorOverrides` — they never touch transaction data.

### Type–Category Reconciliation (`main.js`)

`reconcileType(type, category)` is called after `autoCategorize()` at every CSV import site and inside `db:getTransactions`. It forces `type = 'income'` for categories that are inherently income (currently: `Einnahmen`), overriding the amount-sign detection when the two disagree.

```javascript
// Categories that always imply income regardless of amount sign
const INCOME_CATEGORIES = new Set(['Einnahmen']);

function reconcileType(type, category) {
  if (INCOME_CATEGORIES.has(category)) return 'income';
  return type;
}
```

`db:getTransactions` repairs existing misclassified transactions automatically on every app start and writes corrections back to disk.

### IPC Channels (main.js ↔ renderer)

| Channel | Description |
|---------|-------------|
| `db:getTransactions` | Load all transactions |
| `db:updateTransaction` | Add or update a transaction |
| `db:deleteTransaction` | Delete by ID |
| `db:importTransactions` | Bulk import with deduplication |
| `dialog:openCSV` | Open file picker, parse CSV, return `{success, transactions[], source, count}` |
| `db:getBankAccounts` | Load all accounts |
| `db:saveBankAccount` | Create a new account |
| `db:updateBankAccount` | Update existing account by ID |
| `db:deleteBankAccount` | Delete account, unlinks related transactions |
| `db:renameCategory` | Batch-rename `.category` on all matching transactions, returns `{success, count}` |
| `db:getProfile` | Load profile |
| `db:saveProfile` | Save profile |
| `db:clearAllData` | Wipe all JSON files |

### Transaction Object

```json
{
  "id": "tx_1711234567890_abc1",
  "description": "Migros Basel",
  "amount": 45.30,
  "type": "expense",
  "category": "Lebensmittel",
  "date": "2024-03-15",
  "bankAccountId": "acc_xyz",
  "source": "migros",
  "importedAt": "2024-03-15T10:00:00Z",
  "updatedAt": "2024-03-15T10:00:00Z"
}
```

### Bank Account Object

```json
{
  "id": "acc_1711234567890",
  "name": "Main Account",
  "bankName": "Migros Bank",
  "bank": "migros bank",
  "accountType": "checking",
  "iban": "CH56 0483 5012 3456 7800 9",
  "accountNumber": "0483-5012345-67",
  "bic": "MIGRCHZZXXX",
  "balance": 5000.00,
  "currency": "CHF",
  "color": "#4d8ef0",
  "icon": "landmark",
  "imageSrc": "data:image/png;base64,...",
  "notes": "Primary salary account",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-03-15T10:00:00Z"
}
```

> `icon` and `imageSrc` are mutually exclusive — whichever tab (Icon / Image) is active on save wins.
> `imageSrc` is a 200×200 base64 PNG, circular-cropped in the editor.

---

## Key Renderer Helpers (src/index.html)

### `getCatCfg(cat)`
Returns `{ color, icon }` for a category, merging hardcoded defaults with `localStorage.catColorOverrides`. All render functions use this instead of reading `CAT[cat]` directly.

```javascript
function getCatCfg(cat) {
    const base = CAT[cat] || { color: '#6b7280', icon: 'help-circle' };
    try {
        const overrides = JSON.parse(localStorage.getItem('catColorOverrides') || '{}');
        if (overrides[cat]) return { ...base, color: overrides[cat] };
    } catch {}
    return base;
}
```

### `openTxPanel(type)`
Opens the inline transaction panel for `'income'` or `'expense'`. Calling with the same type while open collapses the panel. Handles title, icon colour, amount sign, account dropdown, and search — all from a single entry point.

### `buildSparkline(mMap, years, color)`
Reusable monthly bar chart component. Returns an HTML string for a `.cat-bars` container.

| Parameter | Type | Description |
|-----------|------|-------------|
| `mMap` | `{ 'YYYY-MM': number }` | Monthly value map |
| `years` | `string[]` | Sorted array of years to render |
| `color` | `string` | CSS color for bar fill |

- Renders 12 bars per year with inline year-boundary separators
- Normalises bar heights relative to the max value across all years
- Empty months rendered at minimum height (6%) with 15% opacity

---

## Auto-Categorisation

The app ships with 600+ keywords across 16 categories. On CSV import, each transaction's description is matched case-insensitively — first match wins.

| Category | Examples |
|----------|---------|
| Lebensmittel | Migros, Coop, Aldi, Lidl, Denner |
| Restaurant | McDonald, Starbucks, Pizzeria |
| Transport | SBB, ZVV, Parking, Shell, BP |
| Einkaufen | Amazon, Zalando, Digitec, H&M |
| Gesundheit | Apotheke, Zahnarzt, CSS, Sanitas |
| Wohnen | Miete, Swisscom, IKEA, Jumbo |
| Unterhaltung | Netflix, Spotify, Kino, Ticketcorner |
| Bildung | ETH, Udemy, Adobe, Microsoft |
| Finanzen | Steuern, Bankgebühren, Hypothek |
| Versicherungen | AXA, Allianz, Zurich, Mobiliar |
| Dienstleistungen | Post, Coiffeur, Reinigung |
| Spenden | UNICEF, WWF, Caritas |
| Einnahmen | Lohn, Gehalt, Dividende, Gutschrift |
| Auszahlung | ATM, Bancomat, Bargeldbezug |
| Transfer | TWINT, PayPal, Wise, Revolut |
| Sonstiges | (default fallback) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | Electron v28 |
| Build | electron-packager v17 |
| UI | Vanilla HTML / CSS / JS |
| CSS framework | Tailwind CSS (CDN) |
| Icons | Lucide Icons (CDN) |
| Charts | Chart.js (CDN) |
| Font | Inter (Google Fonts) |
| Storage | File-based JSON (`fs`) |
| Category colors | `localStorage.catColorOverrides` |

---

## Installation

### Requirements
- Node.js 18+
- Windows 10 / 11

### Quick Start

```bash
# Install dependencies
npm install

# Run in development
npm start

# Or use the one-click launcher
setup.bat
```

### Build portable .exe

```bash
npm run build
# Output: dist/ZentraFinance-win32-x64/
```

---

## Responsive Breakpoints

| Breakpoint | Layout changes |
|-----------|---------------|
| `< 1100px` | Reduced padding, smaller fonts |
| `< 900px` | Nav icon-only, stats 2×2, single-column grid |
| `< 640px` | Stats single-column, 2-column wallet grid, minimal tx table |

---

## License

Proprietary — Qasemi IT Solutions
Developed by [Qasemi IT Solutions](https://qasemi.ch)
