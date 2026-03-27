# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run in development (Electron) — loads src/index.html directly
npm run dev        # Vite dev server + Electron with hot-reload (src-svelte/)
npm run build      # Package as Windows .exe into dist/
```

No test suite. Verify changes by running `npm start`.

## Architecture

**Electron desktop app** — main process (`main.js`) handles all I/O; renderer (`src/index.html`) is a single-file vanilla JS SPA. No build step for the primary renderer — `index.html` is loaded directly via `npm start`.

A parallel Svelte build pipeline lives in `src-svelte/` (built with Vite, output to `dist-renderer/`). It is a work-in-progress and not the production path. `npm start` always falls back to `src/index.html`.

### Two-process structure

- **`main.js`** — IPC handlers, JSON file I/O, CSV parsing, window setup. Data lives in `%APPDATA%\ZentraFinance\data\` as `transactions.json`, `bankAccounts.json`, `profile.json`, `categories.json`.
- **`src/index.html`** — All UI: CSS design tokens, HTML structure, and all app JavaScript in a single `<script>` block (~5000+ lines total). Dependencies loaded from CDN: Tailwind CSS, Lucide Icons, Chart.js.

### IPC pattern

All data operations use `ipcRenderer.invoke(channel, payload)`. Key channels:

| Channel | Notes |
|---|---|
| `db:getTransactions` | Runs `reconcileType()` on every load; writes back only when dirty |
| `db:updateTransaction` | Upsert by ID |
| `db:importTransactions` | Deduplicates by date+amount+description |
| `db:getBankAccounts` / `db:saveBankAccount` / `db:updateBankAccount` / `db:deleteBankAccount` | Deleting unlinks transactions (sets `bankAccountId → null`) |
| `db:renameCategory` | Batch-updates all matching transactions |
| `dialog:openCSV` | Opens file picker, auto-detects bank format, returns parsed transactions |

### Data model

**Transaction:** `{ id, description, amount, type ("income"|"expense"|"transfer"), category, date (YYYY-MM-DD), bankAccountId, source, importedAt, updatedAt }`

**BankAccount:** `{ id, name, bankName, bank, accountType, iban, balance (initial, not running), currency, color, icon, imageSrc, ... }`

**Calculated balance** = `account.balance + Σincome − Σexpense` (computed at render time, never stored)

### Critical conventions

- Account link field on transactions is **`bankAccountId`**, not `accountId`.
- After any DOM manipulation that adds new icons, call **`lucide.createIcons()`**.
- The `Einnahmen` category always forces `type: 'income'` via `reconcileType()` — this is intentional.
- Category color overrides are stored in **`localStorage.catColorOverrides`** (JSON keyed by category name), not in the data files.
- Self-transfers (`Übertrag`/`UEBERTRAG` in description) are forced to `type: 'transfer'` on import and on every `db:getTransactions` load.

### Chart.js charts

Three active Chart.js instances — each stored in a global variable and destroyed before re-creation:

| Variable | Canvas ID | Location | Type | Data source |
|---|---|---|---|---|
| `_incomeChart` | `#income-chart` | Dashboard — Income Sources card | Doughnut | Filtered `tx`, income by category (≤7 slices) |
| `_monthlyChart` | `#monthly-chart` | Dashboard — Monthly Overview card | Grouped bar | **Unfiltered** `transactions`, last 12 months |
| `_catChart` | `#cat-chart` | Categories page — left panel | Doughnut | Filtered `tx`, top 8 categories for the active type toggle |

All three charts use `responsive: true, maintainAspectRatio: false` and require their container to have an explicit CSS `height`. Theme-aware tick/grid colors are applied on each render. **Always call `.destroy()` on the existing instance before creating a new one** — Chart.js does not do this automatically and will leak canvas contexts otherwise.

### Canvas image editor (account photos)

`attachAccCanvasDrag()` uses an `AbortController` stored in `_accDragAbort`. It must be called each time the account modal opens (it cleans up the previous controller first). Call `detachAccCanvasDrag()` when the modal closes — this is already wired into `closeModal('account-overlay')` and the ESC key handler. Never call `attachAccCanvasDrag()` without a matching cleanup path.

### Themes

Three themes: `dark` (default, neon yellow), `blue` (deep navy), `light` (frosted white). Applied as `data-theme` on `<body>`, toggled by nav button, persisted in `localStorage`. CSS variables: `--bg`, `--fg`, `--primary`, `--glass-bg`, `--glass-border`, `--orb1..5`, `--nav-bg`.

Chart.js charts do **not** automatically re-theme — they are recreated on the next `renderDashboard()` or `renderCatPage()` call, which happens when navigating or refreshing data.

### Auto-categorization

`main.js` has `DEFAULT_CATEGORIES` with 16 categories and 600+ keywords. Matching is case-insensitive, first match wins. Applied during CSV import and on every `db:getTransactions` load.

### CSV parsers (in `main.js`)

Three parsers: **Migros Bank**, **UBS** (22-column UTF-8 BOM format), **Generic** (PostFinance and unknown formats). Bank is identified by filename pattern and column heuristics. The Generic parser treats the very first non-empty line as a header (skipped) if it does not contain the keywords `datum`/`buchungstext`.

### Responsive breakpoints

`< 1100px` → compact layout · `< 900px` → icon-only nav, 2×2 stats grid, cat-chart stacks above grid · `< 640px` → single-column stats, minimal table

## Git commits

Do **not** include `Co-Authored-By` or any AI attribution in commit messages.
