# Zentra Finance

A modern personal finance & banking management desktop app for Windows, built with Electron. Features a liquid glass UI, multi-bank CSV import, account image editor, and full offline data storage.

---

## Features

### Dashboard
- Live stats: Total Revenue, Saving, Expenses, Net Balance
- Time filter strip: All / Today / This Week / This Month / Last 3 Months / This Year / Last Year / Custom Range
- Category strip with mini bar charts for top 5 expense categories
- Budget Usage card with segmented progress bar
- Income Sources card — monthly waffle chart (X = month, Y = CHF 1,000/dot, max 60 months × 20 dots) with year-gap markers
- Smart Spending Insights panel
- Recent Transactions (last 6)

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

### Account Management
- **Logo picker**: 24 finance-related icons (landmark, credit-card, wallet, piggy-bank, coins, bitcoin, etc.)
- **Image upload & editor**: pick any PNG/JPG/SVG, drag to reposition, scroll or slider to zoom — live circular crop preview, auto-saved on account save
- **Color picker**: 12 preset swatches + custom color input
- **Account fields**: Bank Name, Account Name, Account Type, Currency, Balance, IBAN, Account Number, BIC/SWIFT, Notes
- **Account types**: Checking, Savings, Investment, Credit Card, Cash, Crypto, Other
- **Currencies**: CHF, EUR, USD, GBP, JPY, BTC
- **Edit & delete** from the same modal

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
- Categories page: expense breakdown by category with % of total
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
