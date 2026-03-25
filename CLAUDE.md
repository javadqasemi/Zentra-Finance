# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run in development (Electron)
npm run build      # Package as Windows .exe into dist/
```

No test suite. Verify changes by running `npm start`.

## Architecture

**Electron desktop app** — main process (`main.js`) handles all I/O; renderer (`src/index.html`) is a single-file vanilla JS SPA. No build step — `index.html` is loaded directly.

### Two-process structure

- **`main.js`** — IPC handlers, JSON file I/O, CSV parsing, window setup. Data lives in `%APPDATA%\ZentraFinance\data\` as `transactions.json`, `bankAccounts.json`, `profile.json`, `categories.json`.
- **`src/index.html`** — All UI: CSS design tokens, HTML structure, and all app JavaScript in a single `<script>` block at the bottom (~4600 lines total). Dependencies loaded from CDN: Tailwind CSS, Lucide Icons, Chart.js.

### IPC pattern

All data operations use `ipcRenderer.invoke(channel, payload)`. Key channels:

| Channel | Notes |
|---|---|
| `db:getTransactions` | Runs `reconcileType()` on every load |
| `db:updateTransaction` | Upsert by ID |
| `db:importTransactions` | Deduplicates by date+amount+description |
| `db:getBankAccounts` / `db:saveBankAccount` / `db:updateBankAccount` / `db:deleteBankAccount` | Deleting unlinks transactions (sets `bankAccountId → null`) |
| `db:renameCategory` | Batch-updates all matching transactions |
| `dialog:openCSV` | Opens file picker, auto-detects bank format, returns parsed transactions |

### Data model

**Transaction:** `{ id, description, amount, type ("income"|"expense"), category, date (YYYY-MM-DD), bankAccountId, source, importedAt, updatedAt }`

**BankAccount:** `{ id, name, bankName, bank, accountType, iban, balance (initial, not running), currency, color, icon, imageSrc, ... }`

**Calculated balance** = `account.balance + Σincome − Σexpense` (computed at render time, never stored)

### Critical conventions

- Account link field on transactions is **`bankAccountId`**, not `accountId`.
- After any DOM manipulation that adds new icons, call **`lucide.createIcons()`**.
- The `Einnahmen` category always forces `type: 'income'` via `reconcileType()` — this is intentional.
- Category color overrides are stored in **`localStorage.catColorOverrides`** (JSON keyed by category name), not in the data files.

### Themes

Three themes: `dark` (default, neon yellow), `blue` (deep navy), `light` (frosted white). Applied as `data-theme` on `<body>`, toggled by nav button, persisted in `localStorage`. CSS variables: `--bg`, `--fg`, `--primary`, `--glass-bg`, `--glass-border`, `--orb1..5`, `--nav-bg`.

### Auto-categorization

`main.js` has `DEFAULT_CATEGORIES` with 16 categories and 600+ keywords. Matching is case-insensitive, first match wins. Applied during CSV import and on every `db:getTransactions` load.

### CSV parsers (in `main.js`)

Four parsers: Migros Bank, UBS (22-column UTF-8 BOM format), PostFinance, and Generic auto-detect. Bank is identified by filename pattern and column heuristics.

### Responsive breakpoints

`< 1100px` → compact layout · `< 900px` → icon-only nav, 2×2 stats grid · `< 640px` → single-column stats, minimal table

## Git commits

Do **not** include `Co-Authored-By` or any AI attribution in commit messages.
