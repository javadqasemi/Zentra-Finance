# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                      # Run Electron — always loads src/index.html (auto-update disabled in dev)
npm run dev                    # Vite dev server + Electron with hot-reload (src-svelte/)
ELECTRON_SVELTE=1 npm start    # Load built Svelte renderer (dist-renderer/)
npm run build:renderer         # Build Svelte app to dist-renderer/
npm run build                  # Build renderer + NSIS installer + portable .exe into dist/ (unsigned)
npm run pack                   # Unpacked app dir under dist/win-unpacked/ — fast iteration, no installer
npm run release                # Build + publish to GitHub Releases (requires GH_TOKEN; for CI use)
npm run release:draft          # Same but only publishes on tag pushes (--publish onTagOrDraft)
npm run lint                   # ESLint flat config (main.js, src/preload.js, src/index.html)
npm run rebuild                # Rebuild better-sqlite3 against Electron's NAPI ABI
setup.bat                      # One-click Windows setup (installs deps + starts)
```

`postinstall` runs `electron-builder install-app-deps` — rebuilds `better-sqlite3` for Electron's NAPI ABI. Always re-run `npm install` (or `npm run rebuild`) after pulling changes that touch native deps. If `better-sqlite3` throws `NODE_MODULE_VERSION` errors at startup, the rebuild step was skipped.

ESLint uses the **flat config** in `eslint.config.js` (CommonJS, `@eslint/js` v10). HTML files are linted via `eslint-plugin-html`, which extracts `<script>` blocks from `src/index.html`. `src/vendor/` and `.claude/` are ignored.

No test suite. Verify changes by running `npm start`. CI: `lint.yml` runs ESLint on push/PR; `build.yml` runs an unsigned NSIS smoke build on push/PR; `release.yml` triggers on `v*.*.*` tag pushes and publishes to GitHub Releases.

## Architecture

**Electron desktop app** — main process (`main.js`) handles all I/O; renderer (`src/index.html`) is a single-file vanilla JS SPA. No build step for the primary renderer — `index.html` is loaded directly via `npm start`.

A parallel Svelte build pipeline lives in `src-svelte/` (built with Vite, output to `dist-renderer/`). It is a work-in-progress and not the production path. `npm start` **always** loads `src/index.html`. To test the Svelte version, use `npm run dev` or `ELECTRON_SVELTE=1 npm start`.

### Two-process structure

- **`main.js`** — IPC handlers, JSON file I/O, CSV parsing, window setup, window security hardening, crash handler, auto-updater bootstrap. Data lives in `%APPDATA%\ZentraFinance\data\` (PascalCase — hardcoded as `path.join(os.homedir(), 'AppData', 'Roaming', 'ZentraFinance', 'data')`) as `transactions.json`, `bankAccounts.json`, `profile.json`, `categories.json`, `users.json`, and `budget.db`. **Logs land in `%APPDATA%\zentra-finance\logs\main.log`** (lowercase-hyphenated — electron-log uses `app.getName()` from `package.json`, not `productName`). The updater cache is at `%LOCALAPPDATA%\zentra-finance-updater\` per `updaterCacheDirName` in the build config.
- **`src/index.html`** — All UI: CSS design tokens, HTML structure, and all app JavaScript in a single `<script>` block (~6000+ lines total). Dependencies bundled in `src/vendor/`: Tailwind CSS, Lucide Icons, Chart.js. Has a Content-Security-Policy `<meta>` tag — see [CSP](#content-security-policy).
- **`src/preload.js`** — Context bridge exposing `window.api.*` methods to the renderer. The renderer calls e.g. `window.api.getTransactions()`, never `ipcRenderer` directly. Includes `window.api.updater.*` namespace.
- **`src/updater.js`** — Auto-update module (main process). Encapsulates `electron-updater` lifecycle, retry on transient network errors, and IPC channels. `init(mainWindow)` is called from `did-finish-load`.

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
| `dialog:exportPDF` | Generates PDF via `printToPDF` with save dialog, returns `{ success, filePath }` |
| `dialog:exportBackup` | Bundles all JSON data files into a single backup envelope |
| `dialog:importBackup` | Reads backup envelope, validates, writes each file, invalidates caches |
| `updater:check` / `updater:download` / `updater:install` | Renderer-driven update lifecycle. All resolve `{ ok: false, reason: 'dev-mode' }` when `!app.isPackaged` |
| `updater:status` / `updater:getVersion` | Snapshot of last lifecycle event / current `app.getVersion()` |
| `updater:event` (push) | Main → renderer. Payload: `{ type: 'checking'\|'available'\|'not-available'\|'progress'\|'downloaded'\|'error'\|'disabled', ... }` |
| `budget:list` / `budget:get` / `budget:create` / `budget:update` / `budget:delete` | Manual budget entries (Fixkosten / Variabel / Einnahmen) — backed by SQLite, see [Budget SQLite module](#budget-sqlite-module) |
| `contacts:list` / `contacts:get` / `contacts:create` / `contacts:update` / `contacts:delete` | CRM contacts (persons + companies) — SQLite |
| `offers:list` / `offers:byCategory` / `offers:create` / `offers:update` / `offers:delete` | Comparable offers (e.g. insurance quotes) — SQLite |

### Budget SQLite module

The Budget / CRM / Offers feature lives in **`db/budget-db.js`** and uses **`better-sqlite3`** — entirely separate from the legacy JSON files. The renderer accesses it via `window.api.budget.*`, `window.api.contacts.*`, and `window.api.offers.*` namespaces. Do **not** migrate transactions/accounts/profile into this DB; they remain JSON.

- **DB file:** `%APPDATA%\ZentraFinance\data\budget.db` (WAL mode, foreign keys ON)
- **Tables:** `contacts` (kind: `person`\|`company`), `budgets` (label, amount, kind), `offers` (comparable quotes), `tx_links` (manual links between JSON transaction IDs and contacts).
- All IPC handlers are wrapped in `safeHandle()` — exceptions are caught and surfaced as `{ ok: false, error }` to the renderer rather than crashing main.
- Because `tx_links.txId` is a string referencing a JSON transaction ID (no FK across stores), it can become stale if the underlying transaction is deleted. There is no cascade — handle missing IDs defensively in the renderer.

### Data model

**Transaction:** `{ id, description, amount, type ("income"|"expense"|"transfer"), category, quelle, date (YYYY-MM-DD), bankAccountId, source, importedAt, updatedAt }` — `quelle` is the income/expense source (Einnahmenquelle/Ausgabenquelle), auto-extracted from description during CSV import via `extractQuelle()`. Backfilled on every `db:getTransactions` load.

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

**Settings & theme buttons** are icon-only in the `nav-right` area (no text labels, no refresh button). Settings button gets an `.active` class when on the settings page.

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

### Analytics page charts

Five additional Chart.js instances on the Analytics page, stored in globals:

| Variable | Canvas ID | Type | Description |
|---|---|---|---|
| `_anTrendChart` | `#an-trend` | Line | Expense trend over selected period |
| `_anSavingsChart` | `#an-savings` | Bar | Monthly savings rate |
| `_anCatChart` | `#an-cat` | Doughnut | Category breakdown |
| `_anDailyChart` | `#an-daily` | Bar | Daily spending pattern |
| `_anAccountChart` | `#an-account` | Doughnut | Account distribution |

All created/destroyed in `renderAnalytics()`. Period selector (3m, 6m, 1y, all) filters data before rendering.

### Export system

Export from Analytics page supports 5 formats: **PDF** (native `printToPDF` via save dialog), **CSV** (BOM-prefixed), **JSON**, **XLSX** (Excel XML Spreadsheet), **HTML** (standalone). Export modal includes **date range filter** (From/To inputs) that narrows transactions independently of the analytics period selector. Monthly dates displayed as "April 22" format via `_fmtMonth()`. Company logo renders at 200×200px minimum in exports.

Key functions:
- **`getExpSel()`** — Reads 10 checkbox states (company, user, summary, monthly, categories, quellen, accounts, transactions, dailyspend, charts)
- **`getExportData()`** — Builds data object respecting selections
- **`_captureCharts(sel)`** — Captures chart canvases as base64 PNG via `toDataURL()`
- **`renderExportPreview()`** — Live preview in modal
- **`buildHtmlReport(data)`** — Standalone HTML with embedded chart images
- **`buildCsvExport(data)`** / **`buildJsonExport(data)`** / **`buildXlsxXml(data)`** — Format builders
- **`downloadExport()`** — Triggers download via Blob URL or iframe print (PDF)

Company info read from DOM first, then `localStorage` fallback. Warning shown when no company info detected. Company block in exports uses a bordered card layout with 64px (preview) / 72px (PDF/HTML) logo, structured contact info, and `align-items:flex-start`. Chart images use `class="chart"` to isolate `max-width:100%` from the company logo.

### Quelle (source) extraction

`extractQuelle(description)` in `main.js` extracts income/expense sources from transaction descriptions:
1. Matches against 600+ category keywords (sorted longest-first for best match)
2. Falls back to stripping common prefixes (Einkauf, Zahlung, TWINT, etc.) and taking first segment
3. Called during CSV import and backfilled on every `db:getTransactions` load

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

## Release & auto-update

### Tooling
- **electron-builder** (devDep) — builds the NSIS installer + portable. Config lives in `package.json` → `build`. Output goes to `dist/`.
- **electron-updater** (runtime dep) — must stay in `dependencies`, not `devDependencies`. The packaged app needs it.
- **electron-log** v5 — logger used by both `main.js` and `src/updater.js`. **Use `log.errorHandler.startCatching({...})`** for crash capture; the old `log.catchErrors` API is deprecated and emits a warning.

### Build targets (Windows)
- **NSIS installer** — `oneClick: false`, `perMachine: false` (per-user, no UAC), shortcuts on desktop + Start menu, `differentialPackage: true` (delta updates).
- **Portable .exe** — single-file, no installer. Cannot auto-update; produced for users who don't want to install.

### Releasing a new version
1. Commit changes.
2. `npm version <patch|minor|major>` — bumps `package.json` and creates a `vX.Y.Z` tag.
3. `git push origin <branch> --follow-tags` — pushing the tag triggers `.github/workflows/release.yml`.
4. The workflow verifies tag matches `package.json`, runs `npm run release`, publishes installer + `latest.yml` to GitHub Releases.

If `package.json` version and tag disagree, the workflow fails fast — fix the mismatch before retrying.

### Auto-update flow
- `src/updater.js` is initialised from `did-finish-load` so the renderer is ready to receive `updater:event` payloads.
- First check: 5 s after startup. Periodic: every 4 hours.
- `autoDownload: false` — user must click **Download** in the in-app banner. `autoInstallOnAppQuit: true` — if downloaded and the user quits, install runs on next launch.
- Transient errors (`ENOTFOUND` / `ETIMEDOUT` / `ECONNRESET` / `net::*`) are retried up to 3× with 60 s backoff. Other errors emit `updater:event { type: 'error' }` and stop until the next periodic check.
- In dev mode (`!app.isPackaged` or `ELECTRON_IS_DEV=1`), all IPC calls resolve `{ ok: false, reason: 'dev-mode' }` and a `disabled` event is emitted. The banner does nothing.

### Code signing
Scaffolded but not active. Set `CSC_LINK` and `CSC_KEY_PASSWORD` as repo secrets, then uncomment the matching env vars in `.github/workflows/release.yml`. `rfc3161TimeStampServer` is already configured in `package.json`.

### Release pipeline pitfalls

These all bit us during the first public release cycle — read before touching the release flow.

- **`build.win.publisherName` MUST stay unset while builds are unsigned.** When set (we had `"Javad Qasemi"`), electron-updater bakes it into `app-update.yml` and rejects every downloaded installer with `New version X is not signed by the application owner` — download goes to 100 %, signature check fails, the file is discarded, and the renderer never gets `update-downloaded`. Re-add `publisherName` only when CSC code-signing is also wired up; without that, the field promises a guarantee the installer can't meet.
- **`build.files` is an allowlist, not a denylist.** Any top-level directory that ships code (e.g. `db/`) must be added explicitly or it's silently dropped from `app.asar`. `main.js` will then throw `Cannot find module './foo'` on launch with the asar's main.js path in the require stack — the symptom is "the installer succeeds, the app refuses to open." When you add a new top-level folder that main.js / preload.js require, add `"folder/**/*"` to `build.files` in the same commit.
- **`package-lock.json` must match `package.json`'s `version` field at the tagged commit.** The release workflow uses `npm ci`, which hard-fails if the lockfile is out of sync. Either bump both together (manual edit) or use `npm version <patch|minor|major>`. Same applies when you add/remove dependencies — `npm install` regenerates the lockfile; don't ship one without the other.
- **IPC handlers that the renderer reads during initial render must register at module load.** Handlers registered inside `registerIpc()` (called from `did-finish-load`) are unavailable while the renderer's `<script>` blocks first execute. `updater:getVersion` was hit by this — the footer IIFE invoked the handler before it existed, `ipcRenderer.invoke` rejected, the silent `catch{}` ate it, and the placeholder text stayed visible. Register such handlers at the top of `src/updater.js` (or any module main.js requires) so they exist before the BrowserWindow is even constructed.
- **`releaseType: release` doesn't always finalize.** Retagging an existing version (`git tag -d v1.0.0 && git push --delete origin v1.0.0 && git tag v1.0.0 && git push origin v1.0.0`) can leave the GitHub Release in a Draft state or delete it entirely depending on the order of operations. If the workflow run is green but `/releases/latest` is 404, bump to the next patch version (`npm version patch`) instead of retrying the retag — cleaner version history and avoids the overwrite path. The workflow artifact (zip on the run page) is the always-available fallback.
- **The smoke test for "did the app actually launch?" lives in `%APPDATA%\zentra-finance\logs\main.log`.** The crash handler in `main.js` (`log.errorHandler.startCatching`) writes uncaught exceptions there *if* it gets that far. If the log file doesn't exist *or* doesn't grow on launch, the app crashed before `electron-log` initialized — capture stderr by launching the installed `Zentra Finance.exe` from PowerShell with `-RedirectStandardError`.

## Security

- **Window**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` (preload uses CommonJS), `webSecurity: true`, `allowRunningInsecureContent: false`.
- **`setWindowOpenHandler`**: denies all in-app new windows. HTTP(S) URLs are opened in the user's default browser via `shell.openExternal`.
- **`will-navigate`**: blocks navigation away from `file://` (and `localhost:5173` in dev). External URLs are deflected to the OS browser.
- **`will-attach-webview`**: refused — we don't use `<webview>`.

### Content-Security-Policy
The renderer's `<meta http-equiv="Content-Security-Policy">` in `src/index.html` enforces:
- `script-src 'self' 'unsafe-inline'` — inline `onclick` handlers are pervasive in the renderer; **`'unsafe-eval'` is intentionally not allowed**, so `eval()` / `new Function()` remain blocked.
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` — Google Fonts CSS only.
- `font-src 'self' https://fonts.gstatic.com data:` — Google Fonts payloads + data URIs.
- `img-src 'self' data: blob:` — for base64 logos/profile images.
- `connect-src 'self'` — renderer never makes outbound XHR. All external I/O (GitHub Releases feed, etc.) goes through the main process.
- `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` — defence in depth.

If you add an inline `onclick` that interpolates a string, you **must** wrap it in `esc()` — CSP `'unsafe-inline'` does not protect against injection.

## Git commits

Do **not** include `Co-Authored-By` or any AI attribution in commit messages.
