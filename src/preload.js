/**
 * @file Electron preload script — context bridge.
 * Exposes `window.api` to the renderer process with whitelisted IPC channels.
 * The renderer must never access `ipcRenderer` directly.
 *
 * @typedef {Object} ZentraAPI
 * @property {() => Promise<Object[]>}        getTransactions    - Load all transactions (runs reconcileType on load).
 * @property {(tx: Object) => Promise<Object>} updateTransaction  - Upsert a transaction by ID.
 * @property {(id: string) => Promise<Object>} deleteTransaction  - Delete a transaction by ID.
 * @property {(txs: Object[]) => Promise<Object>} importTransactions - Bulk import with deduplication.
 * @property {() => Promise<Object[]>}        getBankAccounts    - Load all bank accounts.
 * @property {(acc: Object) => Promise<Object>} saveBankAccount   - Create a new bank account.
 * @property {(acc: Object) => Promise<Object>} updateBankAccount - Update an existing bank account.
 * @property {(id: string) => Promise<Object>} deleteBankAccount  - Delete account, unlink transactions.
 * @property {() => Promise<Object>}          getProfile         - Load user profile.
 * @property {(p: Object) => Promise<Object>} saveProfile        - Save user profile.
 * @property {(args: Object) => Promise<Object>} renameCategory  - Batch-rename category on all transactions.
 * @property {() => Promise<Object>}          clearAllData       - Wipe all JSON data files.
 * @property {() => Promise<Object>}          openCSV            - Open file picker, parse CSV, return transactions.
 * @property {(opts: Object) => Promise<Object>} exportCSV      - Export transactions as CSV (save dialog).
 * @property {() => Promise<Object>}          exportBackup       - Export all data as JSON backup.
 * @property {() => Promise<Object>}          importBackup       - Import a JSON backup file (open dialog).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getTransactions:    ()     => ipcRenderer.invoke('db:getTransactions'),
    updateTransaction:  (tx)   => ipcRenderer.invoke('db:updateTransaction', tx),
    deleteTransaction:  (id)   => ipcRenderer.invoke('db:deleteTransaction', id),
    importTransactions: (txs)  => ipcRenderer.invoke('db:importTransactions', txs),
    getBankAccounts:    ()     => ipcRenderer.invoke('db:getBankAccounts'),
    saveBankAccount:    (acc)  => ipcRenderer.invoke('db:saveBankAccount', acc),
    updateBankAccount:  (acc)  => ipcRenderer.invoke('db:updateBankAccount', acc),
    deleteBankAccount:  (id)   => ipcRenderer.invoke('db:deleteBankAccount', id),
    getProfile:         ()     => ipcRenderer.invoke('db:getProfile'),
    saveProfile:        (p)    => ipcRenderer.invoke('db:saveProfile', p),
    getUsers:           ()     => ipcRenderer.invoke('db:getUsers'),
    saveUser:           (u)    => ipcRenderer.invoke('db:saveUser', u),
    deleteUser:         (id)   => ipcRenderer.invoke('db:deleteUser', id),
    renameCategory:     (args) => ipcRenderer.invoke('db:renameCategory', args),
    clearAllData:       ()     => ipcRenderer.invoke('db:clearAllData'),
    openCSV:            ()     => ipcRenderer.invoke('dialog:openCSV'),
    exportCSV:          (opts) => ipcRenderer.invoke('dialog:exportCSV', opts),
    exportPDF:          (opts) => ipcRenderer.invoke('dialog:exportPDF', opts),
    exportBackup:       ()     => ipcRenderer.invoke('dialog:exportBackup'),
    importBackup:       ()     => ipcRenderer.invoke('dialog:importBackup'),

    // ── Budget module (SQLite, separate from JSON files) ─────────────────────
    budget: {
        list:   ()     => ipcRenderer.invoke('budget:list'),
        get:    (id)   => ipcRenderer.invoke('budget:get', id),
        create: (data) => ipcRenderer.invoke('budget:create', data),
        update: (data) => ipcRenderer.invoke('budget:update', data),
        delete: (id)   => ipcRenderer.invoke('budget:delete', id),
    },
    contacts: {
        list:   ()     => ipcRenderer.invoke('contacts:list'),
        get:    (id)   => ipcRenderer.invoke('contacts:get', id),
        create: (data) => ipcRenderer.invoke('contacts:create', data),
        update: (data) => ipcRenderer.invoke('contacts:update', data),
        delete: (id)   => ipcRenderer.invoke('contacts:delete', id),
    },
    offers: {
        list:       ()         => ipcRenderer.invoke('offers:list'),
        byCategory: (category) => ipcRenderer.invoke('offers:byCategory', category),
        create:     (data)     => ipcRenderer.invoke('offers:create', data),
        update:     (data)     => ipcRenderer.invoke('offers:update', data),
        delete:     (id)       => ipcRenderer.invoke('offers:delete', id),
    },
    txlinks: {
        list:  ()             => ipcRenderer.invoke('txlinks:list'),
        set:   (txId, link)   => ipcRenderer.invoke('txlinks:set', { txId, link }),
        unset: (txId)         => ipcRenderer.invoke('txlinks:unset', txId),
    },

    // ── Auto-updater (electron-updater) ──────────────────────────────────────
    // Renderer calls these to drive the update flow; subscribes to
    // `onUpdaterEvent` for lifecycle notifications. In dev mode, check/download/
    // install resolve to `{ ok: false, reason: 'dev-mode' }`.
    updater: {
        check:      ()  => ipcRenderer.invoke('updater:check'),
        download:   ()  => ipcRenderer.invoke('updater:download'),
        install:    ()  => ipcRenderer.invoke('updater:install'),
        status:     ()  => ipcRenderer.invoke('updater:status'),
        getVersion: ()  => ipcRenderer.invoke('updater:getVersion'),
        onEvent:    (handler) => {
            const wrapped = (_e, payload) => handler(payload);
            ipcRenderer.on('updater:event', wrapped);
            return () => ipcRenderer.removeListener('updater:event', wrapped);
        },
    },
});
