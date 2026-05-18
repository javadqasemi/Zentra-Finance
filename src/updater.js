/**
 * @file Auto-update module — electron-updater integration.
 * Wires update lifecycle events to renderer via IPC, with retry, logging,
 * and graceful failure on dev / unsigned / network-error scenarios.
 *
 * Channels (renderer → main):
 *   updater:check        - Force an update check
 *   updater:download     - Begin downloading the available update
 *   updater:install      - Quit and install the downloaded update
 *   updater:status       - Get last known status snapshot
 *
 * Channels (main → renderer):
 *   updater:event        - Lifecycle event { type, ...payload }
 *     types: 'checking' | 'available' | 'not-available' | 'progress' |
 *            'downloaded' | 'error' | 'disabled'
 */
const { app, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// ── Logging ──────────────────────────────────────────────────────────────────
// Logs land in:
//   %APPDATA%\ZentraFinance\logs\main.log   (Windows)
//   ~/Library/Logs/ZentraFinance/main.log   (macOS)
//   ~/.config/ZentraFinance/logs/main.log   (Linux)
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
autoUpdater.logger = log;
autoUpdater.autoDownload = false;          // ask the user before downloading
autoUpdater.autoInstallOnAppQuit = true;   // install on next quit if downloaded

// Register at module load so the renderer can read the version before
// did-finish-load fires (which is when registerIpc() otherwise runs).
ipcMain.handle('updater:getVersion', () => app.getVersion());

// ── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let lastStatus = { type: 'idle' };
let checkRetryTimer = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 60_000; // 1 minute

/** Push status to renderer and remember it. */
function emit(payload) {
  lastStatus = payload;
  log.info('[updater]', payload.type, payload);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:event', payload);
  }
}

/** True when running under `electron .` (no installer present). */
function isDev() {
  return !app.isPackaged || process.env.ELECTRON_IS_DEV === '1';
}

// ── autoUpdater event wiring ─────────────────────────────────────────────────
autoUpdater.on('checking-for-update', () => emit({ type: 'checking' }));

autoUpdater.on('update-available', (info) => {
  retryCount = 0;
  emit({
    type: 'available',
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes,
  });
});

autoUpdater.on('update-not-available', (info) => {
  retryCount = 0;
  emit({ type: 'not-available', version: info?.version });
});

autoUpdater.on('download-progress', (p) => {
  emit({
    type: 'progress',
    percent: Math.round(p.percent),
    transferred: p.transferred,
    total: p.total,
    bytesPerSecond: p.bytesPerSecond,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  emit({
    type: 'downloaded',
    version: info.version,
    releaseDate: info.releaseDate,
  });
});

autoUpdater.on('error', (err) => {
  const message = (err && err.message) || String(err);
  emit({ type: 'error', message });

  // Retry transient network errors a few times
  const isTransient = /ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|net::/i.test(message);
  if (isTransient && retryCount < MAX_RETRIES) {
    retryCount += 1;
    clearTimeout(checkRetryTimer);
    log.warn(`[updater] retry ${retryCount}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms`);
    checkRetryTimer = setTimeout(() => {
      autoUpdater.checkForUpdates().catch((e) => log.error('[updater] retry failed', e));
    }, RETRY_DELAY_MS);
  }
});

// ── IPC handlers ─────────────────────────────────────────────────────────────
function registerIpc() {
  ipcMain.handle('updater:check', async () => {
    if (isDev()) {
      emit({ type: 'disabled', reason: 'dev-mode' });
      return { ok: false, reason: 'dev-mode' };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, version: result?.updateInfo?.version };
    } catch (err) {
      log.error('[updater] check failed', err);
      return { ok: false, reason: err.message };
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (isDev()) return { ok: false, reason: 'dev-mode' };
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      log.error('[updater] download failed', err);
      return { ok: false, reason: err.message };
    }
  });

  ipcMain.handle('updater:install', async () => {
    if (isDev()) return { ok: false, reason: 'dev-mode' };
    // isSilent=false → show NSIS UI · isForceRunAfter=true → relaunch after install
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { ok: true };
  });

  ipcMain.handle('updater:status', () => lastStatus);
}

// ── Public API ───────────────────────────────────────────────────────────────
/**
 * Initialize the updater. Call once from main process after the main window
 * is created. Safe to call in dev — checks are skipped and a `disabled` event
 * is emitted instead.
 * @param {Electron.BrowserWindow} window - The window that receives events.
 */
function init(window) {
  mainWindow = window;
  registerIpc();

  if (isDev()) {
    log.info('[updater] dev mode — auto-update disabled');
    return;
  }

  // First check shortly after startup (don't block window open)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => log.error('[updater] initial check', err));
  }, 5_000);

  // Then poll every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => log.error('[updater] periodic check', err));
  }, 4 * 60 * 60 * 1000);
}

module.exports = { init, log };
