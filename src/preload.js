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
    renameCategory:     (args) => ipcRenderer.invoke('db:renameCategory', args),
    clearAllData:       ()     => ipcRenderer.invoke('db:clearAllData'),
    openCSV:            ()     => ipcRenderer.invoke('dialog:openCSV'),
});
