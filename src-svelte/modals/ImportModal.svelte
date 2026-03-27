<script>
  import { modal, closeModal, openModal } from '../stores/modals.js'
  import { bankAccounts, transactions, loadAll } from '../stores/app.js'
  import { showToast } from '../stores/toast.js'
  import { fmt, fmtDate } from '../lib/format.js'
  import { afterUpdate, tick } from 'svelte'

  $: cfg = $modal?.type === 'import' ? $modal : null

  let selectedAccountId = ''
  let phase = 'drop' // 'drop' | 'preview'
  let pendingImport = null // { txs, source, total }
  let importing = false

  // Reset when modal opens
  $: if (cfg) {
    selectedAccountId = ''
    phase = 'drop'
    pendingImport = null
    importing = false
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && cfg) {
      if (phase === 'preview') {
        back()
      } else {
        closeModal()
      }
    }
  }

  async function pickCSV() {
    if (!selectedAccountId) {
      showToast('Please select an account first', 'error')
      return
    }
    try {
      const parsed = await window.api.openCSV()
      if (!parsed || !parsed.success) {
        if (parsed?.error) showToast(parsed.error, 'error')
        return
      }

      // Assign selected account
      const txs = (parsed.transactions || []).map(t => ({ ...t, bankAccountId: selectedAccountId }))

      // Detect duplicates
      const existingTx = $transactions
      const dupeCount = txs.filter(t => existingTx.some(ex =>
        ex.date === t.date &&
        Math.abs(ex.amount - t.amount) < 0.001 &&
        ex.description === t.description &&
        (!ex.bankAccountId || !t.bankAccountId || ex.bankAccountId === t.bankAccountId)
      )).length
      const newCount = txs.length - dupeCount

      // Build preview stats
      const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      const dates   = txs.map(t => t.date).sort()
      const dateRange = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : '—'

      // Top 5 categories
      const catMap = {}
      txs.forEach(t => { catMap[t.category || 'Sonstiges'] = (catMap[t.category || 'Sonstiges'] || 0) + Math.abs(t.amount) })
      const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
      const maxAmt  = topCats[0]?.[1] || 1

      pendingImport = { txs, source: parsed.source, total: txs.length, income, expense, dateRange, topCats, maxAmt, dupeCount, newCount }
      phase = 'preview'
    } catch (e) {
      console.error(e)
      showToast('Import failed: ' + (e.message || e), 'error')
    }
  }

  async function confirmImport() {
    if (!pendingImport) return
    importing = true
    try {
      const res = await window.api.importTransactions(pendingImport.txs)
      await loadAll()
      const added   = res?.count ?? '?'
      const skipped = pendingImport.total - (res?.count ?? 0)
      const source  = pendingImport.source
      closeModal()
      showToast(`Imported ${added} transaction${added !== 1 ? 's' : ''} from ${source || 'CSV'}`, 'success')
    } catch (e) {
      console.error(e)
      showToast('Import failed', 'error')
    } finally {
      importing = false
    }
  }

  function back() {
    if (phase === 'preview') {
      phase = 'drop'
      pendingImport = null
    } else {
      closeModal()
    }
  }

  function newAccount() {
    closeModal()
    openModal({ type: 'account', data: null, returnToImport: true })
  }

  afterUpdate(async () => {
    await tick()
    if (typeof lucide !== 'undefined') lucide.createIcons()
  })
</script>

<svelte:window on:keydown={handleKeydown} />

{#if cfg}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="overlay show" on:click={() => { if (!importing) phase === 'preview' ? back() : closeModal() }}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-head">
        <span class="modal-title">Import Bank CSV</span>
        <button class="modal-close" on:click={closeModal} disabled={importing}>
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="modal-body">
        {#if phase === 'drop'}
          <!-- Account selector -->
          <div class="form-group">
            <label class="form-label" for="import-acct-sel" style="display:flex;justify-content:space-between;align-items:center">
              <span>Account <span style="color:var(--primary)">*</span></span>
              <button type="button" class="new-acct-btn" on:click={newAccount}>
                <i data-lucide="plus-circle" style="width:13px;height:13px"></i>
                New account
              </button>
            </label>
            <select id="import-acct-sel" class="form-select" bind:value={selectedAccountId}>
              <option value="">— select account —</option>
              {#each $bankAccounts as acc}
                <option value={acc.id}>{acc.name}{acc.bankName ? ' · ' + acc.bankName : ''}</option>
              {/each}
            </select>
          </div>

          <!-- Drop zone -->
          <button class="drop-zone" on:click={pickCSV}>
            <i data-lucide="file-up"></i>
            <p>Click to select a bank CSV file</p>
            <p style="margin-top:6px"><span>Migros · UBS · PostFinance</span></p>
          </button>

        {:else if phase === 'preview' && pendingImport}
          <!-- Preview stats -->
          <div class="imp-stats">
            <div class="imp-stat">
              <div class="imp-stat-val">{pendingImport.total}</div>
              <div class="imp-stat-lbl">Total rows</div>
            </div>
            <div class="imp-stat">
              <div class="imp-stat-val income">{fmt(pendingImport.income)}</div>
              <div class="imp-stat-lbl">Income</div>
            </div>
            <div class="imp-stat">
              <div class="imp-stat-val expense">{fmt(pendingImport.expense)}</div>
              <div class="imp-stat-lbl">Expenses</div>
            </div>
            <div class="imp-stat" style="grid-column:1/-1;text-align:left;display:flex;align-items:center;gap:8px">
              <i data-lucide="calendar" style="width:13px;height:13px;flex-shrink:0;opacity:.5"></i>
              <span style="font-size:12px;color:var(--muted-fg)">{pendingImport.dateRange}</span>
              <span style="margin-left:auto;font-size:12px;color:var(--primary);font-weight:600">
                {pendingImport.source || 'CSV'}
              </span>
            </div>
          </div>

          <!-- Top categories -->
          <div class="imp-cats">
            <div class="imp-cats-title">Top categories</div>
            {#each pendingImport.topCats as [cat, amt]}
              <div class="imp-cat-row">
                <div class="imp-cat-name">{cat}</div>
                <div class="imp-cat-bar-wrap">
                  <div class="imp-cat-bar" style="width:{Math.round(amt/pendingImport.maxAmt*100)}%"></div>
                </div>
                <div class="imp-cat-amt">{fmt(amt)}</div>
              </div>
            {/each}
          </div>

          <!-- Duplicate badge -->
          {#if pendingImport.dupeCount > 0}
            <div class="imp-dupes">
              <i data-lucide="copy-x" style="width:14px;height:14px"></i>
              <span>
                <strong>{pendingImport.dupeCount}</strong> duplicate{pendingImport.dupeCount !== 1 ? 's' : ''} will be skipped
                · <strong>{pendingImport.newCount}</strong> new transaction{pendingImport.newCount !== 1 ? 's' : ''} will be added
              </span>
            </div>
          {:else}
            <div class="imp-dupes" style="color:var(--primary)">
              <i data-lucide="check-circle" style="width:14px;height:14px"></i>
              <span>No duplicates — <strong>{pendingImport.newCount}</strong> new transaction{pendingImport.newCount !== 1 ? 's' : ''} will be added</span>
            </div>
          {/if}
        {/if}
      </div>

      <div class="modal-foot">
        <button class="btn btn-secondary" on:click={back} disabled={importing}>
          {phase === 'preview' ? 'Back' : 'Close'}
        </button>
        {#if phase === 'preview'}
          <button class="btn btn-primary" on:click={confirmImport} disabled={importing}>
            {#if importing}
              <i data-lucide="loader-2" style="width:14px;height:14px"></i>
              Importing…
            {:else}
              <i data-lucide="check" style="width:14px;height:14px"></i>
              Import
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(4,4,10,0.6);
    backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
  }

  .new-acct-btn {
    background: none; border: none;
    color: var(--primary); font-size: 12px; cursor: pointer;
    padding: 0; display: flex; align-items: center; gap: 4px;
    font-family: inherit;
  }
  .new-acct-btn:hover { text-decoration: underline; }

  .drop-zone {
    width: 100%;
    border: 2px dashed rgba(255,255,255,0.14);
    border-radius: 16px;
    padding: 36px 20px;
    text-align: center; cursor: pointer;
    transition: all 0.25s;
    background: rgba(255,255,255,0.02);
    display: flex; flex-direction: column; align-items: center; gap: 6px;
  }
  .drop-zone:hover {
    border-color: rgba(220,255,0,0.5);
    background: rgba(220,255,0,0.04);
  }
  .drop-zone :global(i) { width: 36px; height: 36px; color: var(--muted-fg); margin-bottom: 4px; }
  .drop-zone p { color: var(--muted-fg); font-size: 13.5px; margin: 0; }
  .drop-zone span { color: var(--primary); font-weight: 600; }
</style>
