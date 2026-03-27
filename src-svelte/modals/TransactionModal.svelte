<script>
  import { modal, closeModal, openModal } from '../stores/modals.js'
  import { bankAccounts, loadAll } from '../stores/app.js'
  import { showToast } from '../stores/toast.js'
  import { afterUpdate, onMount, tick } from 'svelte'

  const CATEGORIES = [
    'Auszahlung','Einnahmen','Lebensmittel','Restaurant','Transport',
    'Einkaufen','Gesundheit','Wohnen','Unterhaltung','Bildung',
    'Finanzen','Versicherungen','Dienstleistungen','Spenden','Transfer','Sonstiges'
  ]

  $: cfg = $modal?.type === 'transaction' ? $modal : null
  $: isEdit = !!(cfg?.data?.id)

  // Form state
  let txType     = 'expense'
  let desc       = ''
  let amount     = ''
  let date       = ''
  let category   = ''
  let accountId  = ''

  // Populate form when modal opens or data changes
  $: if (cfg) {
    const t = cfg.data
    if (t) {
      txType    = t.type || 'expense'
      desc      = t.description || ''
      amount    = t.amount != null ? String(t.amount) : ''
      date      = t.date || todayStr()
      category  = t.category || ''
      accountId = t.bankAccountId || ''
    } else {
      txType    = 'expense'
      desc      = ''
      amount    = ''
      date      = todayStr()
      category  = ''
      accountId = ''
    }
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10)
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && cfg) closeModal()
  }

  async function save() {
    const d = desc.trim()
    const a = Math.round(parseFloat(amount) * 100) / 100
    if (!d)        { showToast('Enter a description', 'error'); return }
    if (!a || a <= 0) { showToast('Enter a valid amount', 'error'); return }
    if (!date)     { showToast('Select a date', 'error'); return }

    const tx = {
      id: cfg?.data?.id || 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      description: d,
      amount: a,
      type: txType,
      category: category || undefined,
      date,
      bankAccountId: accountId || undefined,
      source: 'manual',
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      await window.api.updateTransaction(tx)
      await loadAll()
      closeModal()
      showToast(isEdit ? 'Transaction updated' : 'Transaction added', 'success')
    } catch (e) {
      console.error(e)
      showToast('Save failed', 'error')
    }
  }

  function deleteTx() {
    const id = cfg?.data?.id
    if (!id) return
    openModal({
      type: 'confirm',
      title: 'Delete Transaction',
      message: 'This transaction will be permanently removed and cannot be recovered.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await window.api.deleteTransaction(id)
          await loadAll()
          showToast('Transaction deleted', 'success')
        } catch (e) {
          showToast('Delete failed', 'error')
        }
      }
    })
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
  <div class="overlay show" on:click={closeModal}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-head">
        <span class="modal-title">{isEdit ? 'Edit Transaction' : 'Add Transaction'}</span>
        <button class="modal-close" on:click={closeModal}>
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- Type toggle -->
        <div class="form-group">
          <label class="form-label" for="tx-type-toggle">Type</label>
          <div class="type-toggle" id="tx-type-toggle">
            <button
              class="type-btn expense"
              class:active={txType === 'expense'}
              on:click={() => { txType = 'expense' }}
            >Expense</button>
            <button
              class="type-btn income"
              class:active={txType === 'income'}
              on:click={() => { txType = 'income' }}
            >Income</button>
          </div>
        </div>

        <!-- Description -->
        <div class="form-group">
          <label class="form-label" for="tx-modal-desc">Description</label>
          <input
            id="tx-modal-desc"
            type="text"
            class="form-input"
            bind:value={desc}
            placeholder="e.g. Migros, Netflix, Salary…"
          />
        </div>

        <!-- Amount + Date -->
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label" for="tx-modal-amount">Amount (CHF)</label>
            <input
              id="tx-modal-amount"
              type="number"
              class="form-input"
              bind:value={amount}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label" for="tx-modal-date">Date</label>
            <input
              id="tx-modal-date"
              type="date"
              class="form-input"
              bind:value={date}
            />
          </div>
        </div>

        <!-- Category -->
        <div class="form-group" style="margin-top:16px">
          <label class="form-label" for="tx-modal-cat">Category</label>
          <select id="tx-modal-cat" class="form-select" bind:value={category}>
            <option value="">Auto-detect</option>
            {#each CATEGORIES as cat}
              <option value={cat}>{cat}</option>
            {/each}
          </select>
        </div>

        <!-- Bank Account -->
        <div class="form-group">
          <label class="form-label" for="tx-modal-account">Bank Account (optional)</label>
          <select id="tx-modal-account" class="form-select" bind:value={accountId}>
            <option value="">— none —</option>
            {#each $bankAccounts as acc}
              <option value={acc.id}>{acc.bankName || acc.bank} – {acc.name}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn btn-secondary" on:click={closeModal}>Cancel</button>
        {#if isEdit}
          <button class="btn btn-danger btn-sm" on:click={deleteTx}>Delete</button>
        {/if}
        <button class="btn btn-primary" on:click={save}>Save</button>
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
</style>
