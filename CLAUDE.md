# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                      # Run Electron — always loads src/index.html
npm run dev                    # Vite dev server + Electron with hot-reload (src-svelte/)
ELECTRON_SVELTE=1 npm start    # Load built Svelte renderer (dist-renderer/)
npm run build:renderer         # Build Svelte app to dist-renderer/
npm run build                  # Build renderer + package as Windows .exe into dist/
npm run build:legacy           # Package with electron-packager (alternative)
npm run lint                   # ESLint (main.js, preload.js, index.html)
setup.bat                      # One-click Windows setup (installs deps + starts)
```

No test suite. Verify changes by running `npm start`. CI runs lint + build on push/PR to dev and main.

## Architecture

**Electron desktop app** — main process (`main.js`) handles all I/O; renderer (`src/index.html`) is a single-file vanilla JS SPA. No build step for the primary renderer — `index.html` is loaded directly via `npm start`.

A parallel Svelte build pipeline lives in `src-svelte/` (built with Vite, output to `dist-renderer/`). It is a work-in-progress and not the production path. `npm start` **always** loads `src/index.html`. To test the Svelte version, use `npm run dev` or `ELECTRON_SVELTE=1 npm start`.

### Two-process structure

- **`main.js`** — IPC handlers, JSON file I/O, CSV parsing, window setup. Data lives in `%APPDATA%\ZentraFinance\data\` as `transactions.json`, `bankAccounts.json`, `profile.json`, `categories.json`, `users.json`.
- **`src/index.html`** — All UI: CSS design tokens, HTML structure, and all app JavaScript in a single `<script>` block (~6000+ lines total). Dependencies loaded from CDN (with offline fallbacks in `src/vendor/`): Tailwind CSS, Lucide Icons, Chart.js.
- **`src/preload.js`** — Context bridge exposing `window.api.*` methods to the renderer. The renderer calls e.g. `window.api.getTransactions()`, never `ipcRenderer` directly.

### IPC pattern

All data operations use `ipcRenderer.invoke(channel, payload)`. Key channels:

| Channel | Notes |
|---|---|
| `db:getTransactions` | Runs `reconcileType()` on every load; writes back only when dirty |
| `db:updateTransaction` | Upsert by ID |
| `db:importTransactions` | Deduplicates by date+amount+description |
| `db:getBankAccounts` / `db:saveBankAccount` / `db:updateBankAccount` / `db:deleteBankAccount` | Deleting unlinks transactions (sets `bankAccountId → null`) |
| `db:deleteTransaction` | Delete by ID |
| `db:renameCategory` | Batch-updates all matching transactions |
| `db:getProfile` / `db:saveProfile` | User profile (name, email, imageSrc) |
| `db:getUsers` / `db:saveUser` / `db:deleteUser` | User management (roles system) |
| `db:clearAllData` | Wipes all JSON files |
| `dialog:openCSV` | Opens file picker, auto-detects bank format, returns `{success, transactions[], source, count}` |
| `dialog:exportCSV` | Save dialog, semicolon-separated CSV with BOM prefix for Excel |
| `dialog:exportBackup` | Bundles all JSON data files into a single backup envelope |
| `dialog:importBackup` | Reads backup envelope, validates, writes each file, invalidates caches |

### Data model

**Transaction:** `{ id, description, amount, type ("income"|"expense"|"transfer"), category, date (YYYY-MM-DD), bankAccountId, source, importedAt, updatedAt }`

**BankAccount:** `{ id, name, bankName, bank, accountType, iban, balance (initial, not running), currency, color, icon, imageSrc, ... }` — `icon` and `imageSrc` are mutually exclusive (whichever tab is active on save wins). `imageSrc` is a 200×200 base64 PNG, circular-cropped.

**Profile:** `{ firstName, lastName, email, imageSrc }` — `imageSrc` is a 200×200 base64 PNG, circular-cropped. Displayed in the nav avatar and profile page. Falls back to initials when no image is set.

**User:** `{ id, firstName, lastName, email, role ("admin"|"editor"|"viewer"), imageSrc, createdAt }` — Stored in `users.json`. On first run, seeded from existing `profile.json` as admin.

**Calculated balance** = `account.balance + Σincome − Σexpense` (computed at render time, never stored)

### Critical conventions

- Account link field on transactions is **`bankAccountId`**, not `accountId`.
- After any DOM manipulation that adds new icons, call **`lucide.createIcons()`**.
- The `Einnahmen` category always forces `type: 'income'` via `reconcileType()` — this is intentional.
- Category color overrides are stored in **`localStorage.catColorOverrides`** (JSON keyed by category name), not in the data files.
- Self-transfers (`Übertrag`/`UEBERTRAG` in description) are forced to `type: 'transfer'` on import and on every `db:getTransactions` load.
- All IDs embedded in inline `onclick` attributes **must** be escaped with `esc()` to prevent XSS.
- Transactions with missing `date` field must be handled defensively — use `(t.date || '').slice()` and `new Date(t.date || '1970-01-01')` patterns.
- CSV import uses `_importLock` to prevent concurrent imports — always check/set this flag.
- Swiss date format `DD.MM.YYYY` is converted to ISO `YYYY-MM-DD` during CSV parsing; invalid dates return `null`.
- When updating the nav avatar (e.g. after profile image change), `#nav-initials` may not exist — always null-check before accessing.

### Navigation & UI structure

**Settings page** uses a tabbed layout with three tabs: **Company** (logo upload + company info form), **Admin** (user management, admin-only), **Themes** (theme gallery, color editor, nav size customizer). Tab switching is handled by `switchSettingsTab(tab)`.

**Settings & theme buttons** are icon-only in the `nav-right` area (no text labels). Settings button gets an `.active` class when on the settings page.

**Global view toggle** (list/card) is in the top filter bar, next to the "+" add dropdown. It applies to Wallet, Transactions, Categories, and Accounts pages. Hidden on Dashboard, Settings, and Profile. Persisted as `globalView` in localStorage. Controlled by `setGlobalView(mode)`.

**"+" add dropdown** in the filter bar consolidates all add actions: Add Transaction, Add Account, Import CSV. Opens a dropdown menu with icons and descriptions for each action.

**User switcher** dropdown next to the nav avatar allows switching between users. Current user's role controls UI-level access restrictions.

### Chart.js charts

Three active Chart.js instances — each stored in a global variable and destroyed before re-creation:

| Variable | Canvas ID | Location | Type | Data source |
|---|---|---|---|---|
| `_monthlyChart` | `#monthly-chart` | Dashboard — Monthly Overview card | Grouped bar | **Unfiltered** `transactions`, last 12 months |
| `_catChart` | `#cat-chart` | Categories page — left panel | Doughnut | Filtered `tx`, top 8 categories for the active type toggle |
| `_trendChart` | `#trend-chart` | Dashboard — Expense Trend card | Line | **Unfiltered** `transactions`, last 90 days daily + 7-day rolling avg |

All charts use `responsive: true, maintainAspectRatio: false` and require their container to have an explicit CSS `height`. Theme-aware tick/grid colors are applied on each render.

**Data-hash skip:** All charts compute a fingerprint of their data before rebuilding. If the fingerprint matches the previous render (`_monthlyChartHash` / `_catChartHash` / `_trendChartHash`), the rebuild is skipped entirely. This prevents unnecessary destroy/recreate cycles on filter changes that don't affect chart data.

**Always call `.destroy()` on the existing instance before creating a new one** — Chart.js does not do this automatically and will leak canvas contexts otherwise.

### WaffleDotChart (global component)

Reusable dot-grid visualization. Defined as `WaffleDotChart(containerEl, dataByMonth, options?)` in `src/index.html` and as `<WaffleDotChart>` Svelte component in `src-svelte/components/WaffleDotChart.svelte`.

| Parameter | Type | Description |
|---|---|---|
| `containerEl` | DOM element | Target container |
| `dataByMonth` | `{ 'YYYY-MM': count }` | Values per month |
| `options.minDots` | number | Minimum dots on Y-axis (default: 10) |
| `options.maxYears` | number | Years to display (default: 5) |
| `options.color` | string | CSS color for active dots (default: `var(--primary)`) |
| `options.emptyText` | string | Text when no data |
| `options.labelL/R` | DOM element | Optional label elements |

Used in the Income Sources card via `renderWaffle()` wrapper. The income doughnut chart was removed and replaced with this component.

### Key renderer helpers

- **`getCatCfg(cat)`** — Returns `{ color, icon }` merging hardcoded defaults with `localStorage.catColorOverrides`. All render functions use this instead of `CAT[cat]` directly.
- **`openTxPanel(type)`** — Opens/collapses inline transaction panel for `'income'` or `'expense'` below the stats row. Handles account dropdown, search, and filtering.
- **`buildSparkline(mMap, years, color)`** — Returns HTML string for a monthly bar chart (12 bars/year with year separators, heights normalized to max value).

### Canvas image editor (account & profile photos)

**Account photos:** `attachAccCanvasDrag()` uses an `AbortController` stored in `_accDragAbort`. It must be called each time the account modal opens (it cleans up the previous controller first). Call `detachAccCanvasDrag()` when the modal closes — this is already wired into `closeModal('account-overlay')` and the ESC key handler. Never call `attachAccCanvasDrag()` without a matching cleanup path.

**Profile photos:** Same pattern as account photos but with `profileImgEditor` state and `_pfDragAbort` controller. Functions prefixed with `pf` or `profile` (e.g. `handleProfileImageUpload()`, `drawProfileImgCanvas()`, `attachProfileCanvasDrag()`). Image stored as `imageSrc` in `profile.json`. Displayed in nav avatar and profile page large avatar.

### Company logo

Uploaded via the Company tab in Settings. Stored as base64 PNG in `localStorage.companyLogo`. Resized to max 200×200 on upload. Functions: `handleCompanyLogoUpload()`, `removeCompanyLogo()`, `loadCompanyLogo()`, `displayCompanyLogo()`.

### User roles system

UI-level organizational roles (no real authentication). Three roles: `admin` (full access + user management), `editor` (CRUD operations, no user management), `viewer` (read-only — action buttons hidden). Stored in `users.json`. On first run, seeded from `profile.json` as admin user.

- **`applyRoleRestrictions()`** — Hides/shows UI elements based on `_currentUserRole`. Elements with `data-role-min="editor"` are hidden for viewers. The Admin tab in Settings is hidden for non-admins.
- **User switcher** — Dropdown next to nav avatar. `switchUser(userId)` updates `_currentUserId` in localStorage and re-applies restrictions.
- **User management** — Admin-only section in Settings Admin tab. CRUD via `openUserModal()`, `saveUserFromModal()`, `deleteUserConfirm()`.

### Tooltip system

Tooltip event listeners (mouseover/mouseout/mousemove) are wrapped in an `AbortController` (`_tooltipAbort`) via `initTooltips()`. This prevents listener accumulation on re-initialization.

### Themes

Three built-in themes: `dark` (default, neon yellow), `blue` (deep navy), `light` (frosted white). Custom themes can be created. Applied as `data-theme` on `<body>`, toggled by icon-only nav button, persisted in `localStorage`. CSS variables: `--bg`, `--fg`, `--primary`, `--glass-bg`, `--glass-border`, `--orb1..5`, `--nav-bg`.

Chart.js charts do **not** automatically re-theme — they are recreated on the next `renderDashboard()` or `renderCatPage()` call, which happens when navigating or refreshing data.

### Auto-categorization

`main.js` has `DEFAULT_CATEGORIES` with 16 categories and 600+ keywords. A pre-built lowercase keyword lookup (`_lowerCategoryMap`) is computed once at module load — this eliminates repeated `toLowerCase()` calls during matching. Matching is case-insensitive, first match wins. Applied during CSV import and on every `db:getTransactions` load.

**Important:** `autoCategorize()` must be called **once** per transaction, with the result reused for both `type` (via `reconcileType`) and `category` fields.

### CSV parsers (in `main.js`)

Three parsers: **Migros Bank**, **UBS** (22-column UTF-8 BOM format), **Generic** (PostFinance and unknown formats). Bank is identified by filename pattern and column heuristics. The Generic parser treats the very first non-empty line as a header (skipped) if it does not contain the keywords `datum`/`buchungstext`.

### Performance conventions

- **Single-pass aggregation:** `renderDashboard`, `renderAllTx`, and `renderCatStrip` compute income/expense/category totals in a single `for...of` loop — never use separate `filter().reduce()` passes.
- **Chart data hashing:** Charts skip rebuild when data fingerprint matches previous render.
- **Keyword map:** `_lowerCategoryMap` pre-builds lowercase keywords at module load for O(1)-style matching.
- **Debounced search:** Transaction search inputs use `debounce(fn, 200)` — never call `renderAllTx()` directly from `oninput`.
- **Dirty-flag rendering:** `_pageDirty` object tracks which pages need re-rendering. `switchPage()` checks the flag before calling render functions. Call `_markAllDirty()` after data mutations.
- **In-memory caching (main.js):** `_transactionCache` and `_bankAccountCache` avoid redundant disk reads. Update caches in-place after writes; invalidate on `clearAllData`.

### Responsive breakpoints

`< 1100px` → compact layout · `< 900px` → icon-only nav, 2×2 stats grid, cat-chart stacks above grid · `< 640px` → single-column stats, minimal table

## Git commits

Do **not** include `Co-Authored-By` or any AI attribution in commit messages.
