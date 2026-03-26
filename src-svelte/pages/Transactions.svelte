<script>
  /**
   * Transactions.svelte — Transfer / All Transactions page.
   * Mirrors renderAllTx() from src/index.html.
   */
  import { filteredTransactions, bankAccounts } from '../stores/app.js'
  import { CAT_DEFAULTS, catColorOverrides } from '../stores/app.js'
  import { fmt, fmtDate, fmtDateShort, groupByDate } from '../lib/format.js'
  import { createEventDispatcher, afterUpdate, onMount } from 'svelte'

  const dispatch = createEventDispatcher()

  // ── Filter state ──────────────────────────────────────────────────────────────
  let search   = ''
  let typeTab  = 'all'   // 'all' | 'income' | 'expense'
  let catFilter = ''
  let acctFilter = ''

  // ── Derived ───────────────────────────────────────────────────────────────────
  $: tx = $filteredTransactions

  $: filtered = tx.filter(t => {
    if (typeTab === 'income'  && t.type !== 'income')  return false
    if (typeTab === 'expense' && t.type !== 'expense') return false
    if (catFilter  && t.category     !== catFilter)  return false
    if (acctFilter && t.bankAccountId !== acctFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (t.description || '').toLowerCase().includes(q)
          || (t.category    || '').toLowerCase().includes(q)
    }
    return true
  })

  $: grouped = groupByDate(filtered)

  $: totalInc = filtered.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0)
  $: totalExp = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  $: categories = [...new Set($filteredTransactions.map(t => t.category).filter(Boolean))].sort()
  $: accounts   = $bankAccounts

  function getCatCfg(cat) {
    const base  = CAT_DEFAULTS[cat] || { color: '#6b7280', icon: 'help-circle' }
    const color = $catColorOverrides[cat] || base.color
    return { ...base, color }
  }

  function getAcctName(id) {
    const a = $bankAccounts.find(a => a.id === id)
    return a ? `${a.bankName || a.bank} – ${a.name}` : null
  }

  afterUpdate(() => { if (typeof lucide !== 'undefined') lucide.createIcons() })
  onMount(()     => { if (typeof lucide !== 'undefined') lucide.createIcons() })
</script>

<div id="transactions-page" class="page active fade-up">

  <!-- Summary strip -->
  <div class="txp-summary">
    <div class="txp-stat glass">
      <div class="txp-stat-icon" style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.2)">
        <i data-lucide="trending-up" style="color:var(--green)"></i>
      </div>
      <div class="txp-stat-label">Income</div>
      <div class="txp-stat-value" style="color:var(--green)">{fmt(totalInc)}</div>
    </div>
    <div class="txp-stat glass">
      <div class="txp-stat-icon" style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.2)">
        <i data-lucide="trending-down" style="color:var(--red)"></i>
      </div>
      <div class="txp-stat-label">Expenses</div>
      <div class="txp-stat-value">{fmt(totalExp)}</div>
    </div>
    <div class="txp-stat glass">
      <div class="txp-stat-icon" style="background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.2)">
        <i data-lucide="arrow-left-right" style="color:var(--blue)"></i>
      </div>
      <div class="txp-stat-label">Net</div>
      <div class="txp-stat-value">{fmt(totalInc - totalExp)}</div>
    </div>
    <div class="txp-stat glass">
      <div class="txp-stat-icon" style="background:rgba(168,85,247,.15);border:1px solid rgba(168,85,247,.2)">
        <i data-lucide="hash" style="color:var(--purple)"></i>
      </div>
      <div class="txp-stat-label">Count</div>
      <div class="txp-stat-value">{filtered.length}</div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="txp-toolbar">
    <!-- Search -->
    <div class="txp-search">
      <i data-lucide="search"></i>
      <input type="text" bind:value={search} placeholder="Search transactions…" />
    </div>

    <!-- Type tabs -->
    <div class="txp-type-tabs">
      {#each [['all','All'],['income','Income'],['expense','Expense']] as [id, label]}
        <button class="txp-type-tab" class:active={typeTab === id} on:click={() => { typeTab = id }}>
          {label}
        </button>
      {/each}
    </div>

    <!-- Category filter -->
    <select class="txp-select" bind:value={catFilter}>
      <option value="">All Categories</option>
      {#each categories as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select>

    <!-- Account filter -->
    {#if accounts.length}
      <select class="txp-select" bind:value={acctFilter}>
        <option value="">All Accounts</option>
        {#each accounts as acc}
          <option value={acc.id}>{acc.bankName || acc.bank} – {acc.name}</option>
        {/each}
      </select>
    {/if}

    <!-- Add -->
    <button class="view-btn" on:click={() => dispatch('openAdd')} title="Add transaction">
      <i data-lucide="plus"></i>
    </button>
  </div>

  <!-- Results count -->
  <div class="txp-results-count">{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</div>

  <!-- Transaction groups -->
  {#if grouped.length}
    {#each grouped as group}
      <div class="txp-group">
        <div class="txp-group-label">{group.label}</div>
        <div class="txp-group-grid">
          {#each group.items as t}
            {@const cfg = getCatCfg(t.category)}
            {@const acctName = getAcctName(t.bankAccountId)}
            <div
              class="txp-card"
              on:click={() => dispatch('editTx', t)}
              role="button"
              tabindex="0"
            >
              <div class="txp-card-top">
                <div class="txp-icon" style="background:{cfg.color}18;border:1px solid {cfg.color}30">
                  <i data-lucide={cfg.icon} style="color:{cfg.color}"></i>
                </div>
                <span class="txp-type-pill {t.type}">{t.type === 'income' ? 'Income' : 'Expense'}</span>
              </div>
              <div class="txp-amount {t.type}">
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </div>
              <div class="txp-desc">{t.description || '—'}</div>
              <div class="txp-meta">
                {#if t.category}
                  <span class="txp-cat-badge">{t.category}</span>
                {/if}
                <span class="txp-date-label">{fmtDateShort(t.date)}</span>
                {#if acctName}
                  <span class="txp-acct-badge">{acctName}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {:else}
    <div style="padding:48px 20px;text-align:center;color:var(--muted-fg)">
      <i data-lucide="inbox" style="width:44px;height:44px;margin-bottom:14px;opacity:.4"></i>
      <p style="font-size:16px;font-weight:600;color:var(--fg2);margin-bottom:6px">No transactions found</p>
      <p style="font-size:13.5px">Try adjusting your filters or import a CSV</p>
    </div>
  {/if}

</div>
