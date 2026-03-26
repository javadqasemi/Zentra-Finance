<script>
  /**
   * Accounts.svelte — Bank accounts management page.
   * Mirrors renderAccounts() from src/index.html.
   */
  import { bankAccounts, transactions } from '../stores/app.js'
  import { fmt } from '../lib/format.js'
  import { createEventDispatcher, afterUpdate, onMount } from 'svelte'

  const dispatch = createEventDispatcher()

  $: accounts = $bankAccounts.map(acc => {
    const txs = $transactions.filter(t => t.bankAccountId === acc.id)
    const inc  = txs.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0)
    const exp  = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const bal  = (acc.balance || 0) + inc - exp
    return { ...acc, calcBalance: bal, txCount: txs.length }
  })

  $: maxBal = Math.max(...accounts.map(a => Math.abs(a.calcBalance)), 1)

  afterUpdate(() => { if (typeof lucide !== 'undefined') lucide.createIcons() })
  onMount(()     => { if (typeof lucide !== 'undefined') lucide.createIcons() })
</script>

<div id="accounts-page" class="page active fade-up">

  <div class="page-header">
    <h1 class="page-title">Accounts</h1>
    <button class="btn btn-primary" on:click={() => dispatch('addAccount')}>
      <i data-lucide="plus"></i>
      Add Account
    </button>
  </div>

  {#if accounts.length}
    {#each accounts as acc}
      {@const barPct = Math.round(Math.abs(acc.calcBalance) / maxBal * 100)}
      <div class="accp-row" on:click={() => dispatch('editAccount', acc)} role="button" tabindex="0">
        <div class="accp-accent" style="background:{acc.color || '#3b82f6'}"></div>

        <div class="accp-icon" style="background:{acc.color || '#3b82f6'}18;border:1px solid {acc.color || '#3b82f6'}30">
          {#if acc.imageSrc}
            <img src={acc.imageSrc} alt={acc.name} />
          {:else}
            <i data-lucide={acc.icon || 'landmark'} style="color:{acc.color || '#3b82f6'}"></i>
          {/if}
        </div>

        <div class="accp-info">
          <div class="accp-name">{acc.name}</div>
          <div class="accp-meta">
            <span class="accp-bank">{acc.bankName || acc.bank || '—'}</span>
            {#if acc.accountType}
              <span class="accp-type-badge">{acc.accountType}</span>
            {/if}
          </div>
        </div>

        <div class="accp-right">
          <div class="accp-balance">
            {fmt(acc.calcBalance, { currency: acc.currency || 'CHF' })}
            <span class="accp-balance-currency">{acc.currency || 'CHF'}</span>
          </div>
          <div class="accp-bar-wrap">
            <div class="accp-bar" style="width:{barPct}%;background:{acc.color || '#3b82f6'}"></div>
          </div>
          <div class="accp-tx-label">{acc.txCount} transaction{acc.txCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    {/each}
  {:else}
    <div style="padding:48px 20px;text-align:center;color:var(--muted-fg)">
      <i data-lucide="landmark" style="width:44px;height:44px;margin-bottom:14px;opacity:.4"></i>
      <p style="font-size:16px;font-weight:600;color:var(--fg2);margin-bottom:6px">No accounts yet</p>
      <p style="font-size:13.5px">Click "Add Account" to get started</p>
    </div>
  {/if}

</div>
