# AGENTS.md — Zentra Finance

This document provides essential context for AI coding agents working on the Zentra Finance codebase.

---

## Project Overview

**Zentra Finance** is a modern personal finance and banking management desktop application for Windows, built with Electron. It features a liquid glass UI design, multi-bank CSV import capabilities, account image editing, category management, and full offline JSON-based data storage.

- **Version**: 0.6.0
- **License**: Proprietary — Qasemi IT Solutions
- **Target Platform**: Windows 10/11
- **Language**: English (code), German (banking terms, category names)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop Runtime | Electron v28.3.3 |
| Production UI | Vanilla HTML/CSS/JS (single file) |
| WIP UI | Svelte v4.2.19 + Vite v5.4.2 |
| CSS Framework | Tailwind CSS (CDN) |
| Icons | Lucide Icons (CDN) |
| Charts | Chart.js (CDN) + Custom WaffleDotChart |
| Font | Inter (Google Fonts) |
| Build Tool | electron-builder v24.13.3 |
| Package Manager | npm |

---

## Project Structure

```
Zentra-Finance/
├── main.js              # Electron main process — IPC handlers, CSV parsers, JSON I/O
├── package.json         # Dependencies, scripts, and electron-builder config
├── vite.config.mjs      # Vite build configuration for Svelte
├── svelte.config.mjs    # Svelte preprocessor configuration
├── setup.bat            # One-click Windows setup and launch script
├── .gitignore           # Git exclusions
├── src/                 # PRODUCTION renderer code
│   ├── index.html       # Single-file SPA (~8000+ lines) — loaded by default
│   ├── preload.js       # IPC context bridge — exposes window.api
│   ├── logo.png         # App icon
│   ├── Themes/
│   │   └── blue.css     # Blue theme CSS variables reference
│   └── vendor/          # Bundled vendor libraries (fallback)
│       ├── chart.js
│       ├── lucide.js
│       └── tailwind.js
└── src-svelte/          # Svelte rewrite — WORK IN PROGRESS
    ├── index.html       # Vite entry HTML
    ├── main.js          # Svelte app bootstrap
    ├── App.svelte       # Root component with routing
    ├── app.css          # Design system and theme variables
    ├── components/      # Reusable UI components
    │   ├── Nav.svelte
    │   ├── TimeFilter.svelte
    │   ├── Toast.svelte
    │   └── WaffleDotChart.svelte
    ├── pages/           # Page components
    │   ├── Dashboard.svelte
    │   ├── Wallet.svelte
    │   ├── Transactions.svelte
    │   ├── Categories.svelte
    │   ├── Accounts.svelte
    │   └── Profile.svelte
    ├── modals/          # Modal dialogs
    │   ├── ImportModal.svelte
    │   ├── TransactionModal.svelte
    │   └── ConfirmDialog.svelte
    ├── stores/          # Svelte stores (state management)
    │   ├── app.js       # Core data, navigation, time filter, theme
    │   ├── toast.js     # Toast notification state
    │   └── modals.js    # Modal state management
    └── lib/
        └── format.js    # Formatting utilities (currency, dates)
```

---

## Build and Development Commands

```bash
# Install dependencies
npm install

# Run production version (always loads src/index.html)
npm start

# Run with Vite dev server + hot-reload (Svelte WIP)
npm run dev

# Run built Svelte renderer (requires build first)
ELECTRON_SVELTE=1 npm start

# Build Svelte renderer to dist-renderer/
npm run build:renderer

# Full build: renderer + package as Windows portable .exe
npm run build

# Alternative packaging with electron-packager
npm run build:legacy

# One-click Windows setup (installs deps if needed, then starts)
setup.bat
```

**Important**: `npm start` **always** loads `src/index.html` (production). The Svelte version in `src-svelte/` is work-in-progress and requires explicit environment variables to load.

---

## Runtime Architecture

### Two-Process Structure

1. **Main Process (`main.js`)**
   - Handles all file I/O operations
   - Manages JSON data storage in `%APPDATA%\ZentraFinance\data\`
   - Parses CSV files from various banks (Migros, UBS, PostFinance, generic)
   - Auto-categorizes transactions using 600+ keywords
   - Sets up IPC handlers for renderer communication

2. **Renderer Process**
   - **Production**: `src/index.html` — single-file vanilla JS SPA
   - **WIP**: `src-svelte/` → `dist-renderer/` — Svelte-based reactive UI

### Data Storage (Offline, Local)

All data is stored as JSON files on the user's machine — no cloud, no accounts required.

```
%APPDATA%\ZentraFinance\data\
├── transactions.json    # All transactions
├── bankAccounts.json    # Bank accounts (includes imageSrc as base64)
├── profile.json         # User profile (name, email, imageSrc)
├── users.json           # Users with roles (admin, editor, viewer)
└── categories.json      # Category keywords for auto-categorization
```

Company logo and info stored in `localStorage` (`companyLogo`, `companyName`, etc.). Category color overrides are stored separately in `localStorage` under `catColorOverrides`.

---

## IPC Communication

All data operations use `window.api.<method>()` which maps to IPC channels via `src/preload.js`.

### Available API Methods

| Method | IPC Channel | Description |
|--------|-------------|-------------|
| `getTransactions()` | `db:getTransactions` | Load all transactions (runs `reconcileType()` on load) |
| `updateTransaction(tx)` | `db:updateTransaction` | Add or update a transaction by ID |
| `deleteTransaction(id)` | `db:deleteTransaction` | Delete transaction by ID |
| `importTransactions(txs)` | `db:importTransactions` | Bulk import with deduplication |
| `getBankAccounts()` | `db:getBankAccounts` | Load all bank accounts |
| `saveBankAccount(acc)` | `db:saveBankAccount` | Create new account |
| `updateBankAccount(acc)` | `db:updateBankAccount` | Update existing account |
| `deleteBankAccount(id)` | `db:deleteBankAccount` | Delete account (unlinks related transactions) |
| `getProfile()` | `db:getProfile` | Load user profile |
| `saveProfile(p)` | `db:saveProfile` | Save user profile |
| `renameCategory(args)` | `db:renameCategory` | Batch-rename category across all transactions |
| `getUsers()` | `db:getUsers` | Load all users |
| `saveUser(u)` | `db:saveUser` | Create or update a user |
| `deleteUser(id)` | `db:deleteUser` | Delete a user by ID |
| `clearAllData()` | `db:clearAllData` | Wipe all JSON files |
| `openCSV()` | `dialog:openCSV` | Open file picker, auto-detect bank, parse CSV |
| `exportCSV(opts)` | `dialog:exportCSV` | Export transactions as CSV (save dialog) |
| `exportBackup()` | `dialog:exportBackup` | Export all data as JSON backup |
| `importBackup()` | `dialog:importBackup` | Import a JSON backup file |

### Data Models

**Transaction:**
```javascript
{
  id: "tx_1711234567890_abc123",     // Unique ID
  description: "Migros Basel",         // Cleaned description
  originalDescription: "Original...",  // Raw from CSV
  amount: 45.30,                       // Absolute amount
  type: "expense",                     // "income" | "expense" | "transfer"
  category: "Lebensmittel",            // Auto or manually assigned
  quelle: "Migros",                    // Source (Einnahmenquelle/Ausgabenquelle), auto-extracted
  date: "2024-03-15",                  // ISO date (YYYY-MM-DD)
  bankAccountId: "acc_xyz",            // Link to account (can be null)
  source: "migros",                    // "migros" | "ubs" | "postfinance" | "generic"
  importedAt: "2024-03-15T10:00:00Z",
  updatedAt: "2024-03-15T10:00:00Z"
}
```

**BankAccount:**
```javascript
{
  id: "acc_1711234567890",
  name: "Main Account",
  bankName: "Migros Bank",
  bank: "migros bank",                 // Normalized for display
  accountType: "checking",             // checking | savings | investment | credit card | cash | crypto | other
  iban: "CH56 0483 5012 3456 7800 9",
  accountNumber: "0483-5012345-67",
  bic: "MIGRCHZZXXX",
  balance: 5000.00,                    // Initial balance (not running)
  currency: "CHF",                     // CHF | EUR | USD | GBP | JPY | BTC
  color: "#4d8ef0",
  icon: "landmark",                    // Lucide icon name
  imageSrc: "data:image/png;base64,...", // Circular-cropped 200×200 base64 PNG
  notes: "Primary salary account",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-03-15T10:00:00Z"
}
```

> `icon` and `imageSrc` are mutually exclusive — whichever tab is active on save wins.

---

## Critical Conventions

### Field Naming
- Account link field on transactions is **`bankAccountId`**, NOT `accountId`.
- Always use `getCatCfg(cat)` to retrieve category config (merges defaults with localStorage overrides).

### Security
- **XSS Prevention**: All IDs embedded in inline `onclick` attributes **must** be escaped with `esc()` function:
  ```javascript
  esc(id) => id.replace(/[&<>"']/g, ...)
  ```
- File path validation is performed before CSV parsing.

### UI Updates
- After any DOM manipulation that adds new icons, call **`lucide.createIcons()`**.
- Chart.js instances must be `.destroy()`-ed before creating new ones to prevent canvas context leaks.
- Both charts use data-hash fingerprinting to skip unnecessary rebuilds.

### Type Reconciliation
The `Einnahmen` category always forces `type: 'income'` regardless of amount sign:
```javascript
const INCOME_CATEGORIES = new Set(['Einnahmen']);
function reconcileType(type, category) {
  if (INCOME_CATEGORIES.has(category)) return 'income';
  return type;
}
```

Self-transfers (containing `Übertrag`/`UEBERTRAG` in description) are forced to `type: 'transfer'`.

### Null Safety
Transactions with missing `date` field must be handled defensively:
```javascript
(t.date || '').slice(0, 7)
new Date(t.date || '1970-01-01')
```

---

## Auto-Categorization

Located in `main.js`, the `DEFAULT_CATEGORIES` object contains 16 categories with 600+ keywords. The system:

1. Pre-builds a lowercase keyword map (`_lowerCategoryMap`) at module load for O(1) matching
2. Matches case-insensitively — first match wins
3. Applied during CSV import AND on every `db:getTransactions` load
4. `autoCategorize()` must be called **once** per transaction, with result reused for both `type` and `category`

**Categories:**
- `Auszahlung` (ATM/Cash withdrawals)
- `Lebensmittel` (Groceries)
- `Einnahmen` (Income — forces type: income)
- `Restaurant`, `Transport`, `Einkaufen`, `Gesundheit`
- `Wohnen`, `Unterhaltung`, `Bildung`, `Finanzen`
- `Versicherungen`, `Dienstleistungen`, `Spenden`
- `Transfer`, `Sonstiges` (default fallback)

---

## CSV Parsers

Three parsers in `main.js`:

1. **Migros Bank**: Semi-colon separated, Swiss number format
2. **UBS**: 22-column format with UTF-8 BOM, debit/credit columns
3. **Generic**: PostFinance and unknown formats — auto-detects header

Bank detection is by filename pattern first, then content heuristics.

---

## Themes

Three themes available, cycled via nav button and persisted in `localStorage`:

| Theme | Base Background | Primary Accent |
|-------|-----------------|----------------|
| `dark` | `#07070e` | Neon yellow |
| `blue` | `#060d1f` Deep navy | Blue |
| `light` | `#f0f2f8` Frosted white | Blue |

Applied as `data-theme` attribute on `<body>`. CSS variables: `--bg`, `--fg`, `--primary`, `--glass-bg`, `--glass-border`, `--orb1..5`, `--nav-bg`.

---

## Testing

**No automated test suite exists.** All testing is manual:

```bash
npm start    # Verify changes by running the app
```

When modifying:
1. Test CSV import with sample files from each supported bank
2. Verify theme switching works
3. Test responsive breakpoints (resize window to <1100px, <900px, <640px)
4. Check that charts render correctly and don't leak canvas contexts

---

## Performance Guidelines

1. **Single-pass aggregation**: Compute income/expense/category totals in one `for...of` loop — never use multiple `filter().reduce()` passes
2. **Chart data hashing**: Charts skip rebuild when data fingerprint matches (`_monthlyChartHash`, `_catChartHash`)
3. **Keyword map**: `_lowerCategoryMap` eliminates repeated `toLowerCase()` calls
4. **AbortControllers**: Event listeners (tooltips, canvas drag) use `AbortController` to prevent accumulation

---

## Git Conventions

- Do **not** include `Co-Authored-By` or AI attribution in commit messages
- `node_modules/`, `dist/`, `dist-renderer/`, and `.claude/settings.local.json` are gitignored

---

## Common Issues

### GPU Memory Warning
The app increases GPU tile memory budget to prevent "tile memory limits exceeded" warnings caused by glass backdrop-filters and animated orbs:
```javascript
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '512');
```

### Import Lock
CSV import uses `_importLock` to prevent concurrent imports.

### Date Parsing
Swiss date format `DD.MM.YYYY` is converted to ISO `YYYY-MM-DD`. Invalid dates are logged and return `null`.

---

## File Locations Quick Reference

| What | Where |
|------|-------|
| Main process | `main.js` |
| Production UI | `src/index.html` |
| IPC bridge | `src/preload.js` |
| Svelte entry | `src-svelte/main.js` |
| Svelte root | `src-svelte/App.svelte` |
| Data stores | `src-svelte/stores/app.js` |
| Format helpers | `src-svelte/lib/format.js` |
| Theme CSS | `src-svelte/app.css`, `src/Themes/blue.css` |
| Build config | `vite.config.mjs`, `package.json` (build section) |
