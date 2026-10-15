<script>
  /**
   * AccountModal.svelte — Add / edit a bank account.
   * Mirrors openEditAccountModal / openAddAccountModal from src/index.html.
   */
  import { createEventDispatcher, afterUpdate, onMount } from 'svelte'
  import { refreshIcons } from '../lib/format.js'
  import ImageCropper from '../components/ImageCropper.svelte'
  import { showToast } from '../stores/toast.js'

  export let open = false
  export let account = null   // null = add mode

  const dispatch = createEventDispatcher()

  const ACC_ICONS = [
    'landmark','building-2','credit-card','wallet','piggy-bank',
    'banknote','coins','trending-up','globe','shopping-cart',
    'briefcase','shield','zap','star','home','layers',
    'bitcoin','euro','dollar-sign','swiss-franc','archive',
    'graduation-cap','repeat','university',
  ]
  const ACC_COLORS = [
    '#3b82f6','#22c55e','#ef4444','#f97316','#a855f7',
    '#14b8a6','#ec4899','#eab308','#06b6d4','#6366f1',
    '#dcff00','#e2e8f0',
  ]

  let cropper
  let tab = 'icon'         // 'icon' | 'image'
  let icon = 'landmark'
  let color = '#3b82f6'
  let imageSrc = null      // base64
  let bankName = '', name = '', type = 'checking', currency = 'CHF', balance = 0
  let iban = '', accountNumber = '', bic = '', notes = ''
  let editId = null
  let fileInput

  $: isEdit = !!editId

  // Initialise / reset every time `open` flips on
  $: if (open) initFromAccount(account)

  function initFromAccount(a) {
    if (a) {
      editId       = a.id
      icon         = a.icon || 'landmark'
      color        = a.color || '#3b82f6'
      imageSrc     = a.imageSrc || null
      bankName     = a.bankName || a.bank || ''
      name         = a.name || ''
      type         = a.accountType || 'checking'
      currency     = a.currency || 'CHF'
      balance      = a.balance != null ? a.balance : 0
      iban         = a.iban || ''
      accountNumber= a.accountNumber || ''
      bic          = a.bic || ''
      notes        = a.notes || ''
      tab          = imageSrc ? 'image' : 'icon'
    } else {
      editId = null
      icon = 'landmark'; color = '#3b82f6'; imageSrc = null
      bankName = ''; name = ''; type = 'checking'; currency = 'CHF'; balance = 0
      iban = ''; accountNumber = ''; bic = ''; notes = ''
      tab = 'icon'
    }
    requestAnimationFrame(() => {
      refreshIcons()
      if (cropper && imageSrc) cropper.loadDataUrl(imageSrc)
      else if (cropper) cropper.reset()
    })
  }

  function onCropChange(e) { imageSrc = e.detail.dataUrl }

  function onFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (cropper) cropper.loadFile(file)
  }

  function removeImage() {
    imageSrc = null
    if (cropper) cropper.reset()
  }

  function close() {
    open = false
    dispatch('close')
  }

  async function save() {
    if (!name.trim()) { showToast('Account name required', 'error'); return }
    const payload = {
      ...(editId ? { id: editId } : {}),
      bankName: bankName.trim(),
      bank:     bankName.trim().toLowerCase(),
      name:     name.trim(),
      accountType: type,
      currency,
      balance: parseFloat(balance) || 0,
      iban: iban.trim(),
      accountNumber: accountNumber.trim(),
      bic: bic.trim(),
      notes: notes.trim(),
      color,
      icon: tab === 'icon' ? icon : null,
      imageSrc: tab === 'image' ? imageSrc : null,
    }
    try {
      if (editId) await window.api.updateBankAccount(payload)
      else        await window.api.saveBankAccount(payload)
      showToast(editId ? 'Account updated' : 'Account added', 'success')
      dispatch('saved')
      close()
    } catch (err) {
      showToast('Save failed', 'error')
      console.error(err)
    }
  }

  async function remove() {
    if (!editId) return
    if (!confirm(`Delete account "${name}"? Linked transactions will be unlinked.`)) return
    try {
      await window.api.deleteBankAccount(editId)
      showToast('Account deleted', 'success')
      dispatch('saved')
      close()
    } catch (err) {
      showToast('Delete failed', 'error')
      console.error(err)
    }
  }

  afterUpdate(() => { refreshIcons() })
  onMount(() => { refreshIcons() })
</script>

{#if open}
<div class="overlay show" on:click={close} role="presentation">
  <div class="modal" on:click|stopPropagation role="dialog" style="max-width:520px">
    <div class="modal-head">
      <span class="modal-title">{isEdit ? 'Edit Bank Account' : 'Add Bank Account'}</span>
      <button class="modal-close" on:click={close}><i data-lucide="x"></i></button>
    </div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">

      <!-- Logo: Icon or Image tabs -->
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Account Logo</label>
        <div class="acc-logo-tabs">
          <div class="acc-logo-tab" class:active={tab === 'icon'}  on:click={() => tab = 'icon'}  role="button" tabindex="0">Icon</div>
          <div class="acc-logo-tab" class:active={tab === 'image'} on:click={() => tab = 'image'} role="button" tabindex="0">Image</div>
        </div>

        {#if tab === 'icon'}
          <div class="acc-icon-grid">
            {#each ACC_ICONS as ic}
              <div
                class="acc-icon-opt"
                class:selected={ic === icon}
                on:click={() => icon = ic}
                role="button" tabindex="0"
                title={ic}
              >
                <i data-lucide={ic}></i>
              </div>
            {/each}
          </div>
        {:else}
          <div class="acc-img-panel">
            <div class="acc-img-upload-area">
              <label class="acc-img-upload-btn">
                <i data-lucide="image-plus" style="width:14px;height:14px"></i>
                Choose Image
                <input bind:this={fileInput} type="file" accept="image/*" on:change={onFile} hidden />
              </label>
              {#if imageSrc}
                <button class="acc-img-remove-btn" on:click={removeImage}>Remove</button>
              {/if}
            </div>
            <div class="acc-img-editor visible">
              <ImageCropper bind:this={cropper} on:change={onCropChange} canvasSize={280} cropRadius={110} />
            </div>
            {#if imageSrc}
              <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
                <img src={imageSrc} alt="preview" style="width:44px;height:44px;border-radius:13px;object-fit:cover;border:1px solid var(--glass-border)" />
                <span style="font-size:12px;color:var(--muted-fg)">Drag &amp; zoom to adjust · saved automatically</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Color row -->
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Card Color</label>
        <div class="acc-color-row">
          {#each ACC_COLORS as c}
            <div
              class="acc-color-swatch"
              class:selected={c === color}
              style="background:{c}"
              on:click={() => color = c}
              role="button" tabindex="0"
              title={c}
            ></div>
          {/each}
          <label class="acc-color-custom" title="Custom">
            <span>+</span>
            <input type="color" bind:value={color} />
          </label>
        </div>
      </div>

      <div style="border-top:1px solid var(--glass-border);margin:0 -4px"></div>

      <!-- Bank name -->
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Bank Name</label>
        <input type="text" class="form-input" bind:value={bankName} placeholder="e.g. Migros Bank" />
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Account Name</label>
          <input type="text" class="form-input" bind:value={name} placeholder="e.g. Salary" />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Account Type</label>
          <select class="form-select" bind:value={type}>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="investment">Investment</option>
            <option value="credit">Credit Card</option>
            <option value="cash">Cash</option>
            <option value="crypto">Crypto</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Currency</label>
          <select class="form-select" bind:value={currency}>
            <option>CHF</option><option>EUR</option><option>USD</option>
            <option>GBP</option><option>JPY</option><option>BTC</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Current Balance</label>
          <input type="number" class="form-input" bind:value={balance} placeholder="0.00" step="0.01" />
        </div>
      </div>

      <div style="border-top:1px solid var(--glass-border);margin:0 -4px"></div>

      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">IBAN</label>
        <input type="text" class="form-input" bind:value={iban} placeholder="CH00 0000 0000 0000 0000 0" style="font-family:monospace;letter-spacing:1px" />
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Account Number</label>
          <input type="text" class="form-input" bind:value={accountNumber} placeholder="Optional" />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">BIC / SWIFT</label>
          <input type="text" class="form-input" bind:value={bic} placeholder="e.g. MIGRCHZZXXX" style="font-family:monospace;letter-spacing:1px" />
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Notes</label>
        <input type="text" class="form-input" bind:value={notes} placeholder="Optional notes" />
      </div>
    </div>
    <div class="modal-foot">
      {#if isEdit}
        <button class="btn btn-secondary" style="margin-right:auto;color:var(--red);border-color:rgba(239,68,68,0.3)" on:click={remove}>Delete</button>
      {/if}
      <button class="btn btn-secondary" on:click={close}>Cancel</button>
      <button class="btn btn-primary" on:click={save}>Save Account</button>
    </div>
  </div>
</div>
{/if}
