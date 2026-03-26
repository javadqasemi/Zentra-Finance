<script>
  /**
   * Wallet.svelte — My Wallet page.
   *
   * Shows net worth hero + account cards grid.
   * Mirrors renderWallet() from src/index.html.
   */
  import { bankAccounts, transactions } from '../stores/app.js'
  import { fmt, clamp } from '../lib/format.js'
  import { afterUpdate, onMount, createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  // ── Computed balance per account ──────────────────────────────────────────────
  $: accounts = $bankAccounts.map(acc => {
    const txs = $transactions.filter(t => t.bankAccountId === acc.id)
    const inc  = txs.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0)
    const exp  = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const bal  = (acc.balance || 0) + inc - exp
    return { ...acc, calcBalance: bal, txCount: txs.length }
  })

  $: netWorth = accounts.reduce((s, a) => s + a.calcBalance, 0)
  $: totalInc = $transactions.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0)
  $: totalExp = $transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  afterUpdate(() => { if (typeof lucide !== 'undefined') lucide.createIcons() })
  onMount(()     => { if (typeof lucide !== 'undefined') lucide.createIcons() })
</script>

<div id="wallet-page" class="page active fade-up">

  <!-- Net worth hero -->
  <div class="wallet-hero">
    <div class="wallet-hero-left">
      <div class="wallet-hero-label">Total Net Worth</div>
      <div class="wallet-hero-value">{fmt(netWorth)}</div>
      <div class="wallet-hero-sub">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="wallet-hero-right">
      <div class="wallet-hero-stat">
        <div class="wallet-hero-stat-label">Total Income</div>
        <div class="wallet-hero-stat-value" style="color:var(--green)">{fmt(totalInc)}</div>
      </div>
      <div class="wallet-hero-stat">
        <div class="wallet-hero-stat-label">Total Expenses</div>
        <div class="wallet-hero-stat-value" style="color:var(--red)">{fmt(totalExp)}</div>
      </div>
      <div class="wallet-hero-stat">
        <div class="wallet-hero-stat-label">Net Savings</div>
        <div class="wallet-hero-stat-value">{fmt(totalInc - totalExp)}</div>
      </div>
    </div>
  </div>

  <!-- Account grid -->
  {#if accounts.length}
    <div class="wallet-section-label">Accounts</div>
    <div class="wallet-grid">
      {#each accounts as acc}
        <div class="wallet-card">
          <div class="wallet-card-stripe" style="background:{acc.color || '#3b82f6'}"></div>
          <div class="wallet-card-body">
            <div class="wallet-card-top">
              <div
                class="wallet-card-icon"
                style="background:{acc.color || '#3b82f6'}22;border:1px solid {acc.color || '#3b82f6'}33"
              >
                {#if acc.imageSrc}
                  <img src={acc.imageSrc} alt={acc.name} />
                {:else}
                  <i data-lucide={acc.icon || 'landmark'} style="color:{acc.color || '#3b82f6'}"></i>
                {/if}
              </div>
              <div class="wallet-card-actions">
                <button
                  class="wallet-card-action"
                  title="Edit"
                  on:click|stopPropagation={() => dispatch('editAccount', acc)}
                >
                  <i data-lucide="pencil"></i>
                </button>
                <button
                  class="wallet-card-action danger"
                  title="Delete"
                  on:click|stopPropagation={() => dispatch('deleteAccount', acc)}
                >
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
            <div class="wallet-card-name">{acc.name}</div>
            <div class="wallet-card-bank">{acc.bankName || acc.bank || ''}</div>
            {#if acc.iban}
              <div class="wallet-card-iban">{acc.iban.replace(/(.{4})/g, '$1 ').trim()}</div>
            {/if}
            <div class="wallet-card-balance">
              <div>
                <div class="wallet-balance-label">Current Balance</div>
                <div class="wallet-balance-value" style="color:{acc.color || '#3b82f6'}">
                  {fmt(acc.calcBalance, { currency: acc.currency || 'CHF' })}
                </div>
              </div>
              <div class="wallet-currency-badge">{acc.currency || 'CHF'}</div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div style="padding:48px 20px;text-align:center;color:var(--muted-fg)">
      <i data-lucide="landmark" style="width:44px;height:44px;margin-bottom:14px;opacity:.4"></i>
      <p style="font-size:16px;font-weight:600;color:var(--fg2);margin-bottom:6px">No accounts yet</p>
      <p style="font-size:13.5px">Add a bank account to track your finances</p>
    </div>
  {/if}

</div>
