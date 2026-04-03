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
    exportBackup:       ()     => ipcRenderer.invoke('dialog:exportBackup'),
    importBackup:       ()     => ipcRenderer.invoke('dialog:importBackup'),
});
