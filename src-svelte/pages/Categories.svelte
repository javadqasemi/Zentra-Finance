<script>
  /**
   * Categories.svelte — Category breakdown page.
   * Mirrors renderCatPage() from src/index.html.
   */
  import { filteredTransactions } from '../stores/app.js'
  import { CAT_DEFAULTS, catColorOverrides } from '../stores/app.js'
  import { fmt } from '../lib/format.js'
  import { afterUpdate, onMount } from 'svelte'

  let typeTab = 'expense'  // 'expense' | 'income'

  $: tx = $filteredTransactions.filter(t => t.type === typeTab)

  $: total = tx.reduce((s, t) => s + t.amount, 0)

  $: catData = buildCatData(tx, total, $catColorOverrides)

  function buildCatData(txs, grand, overrides) {
    const map = {}
    for (const t of txs) {
      const cat = t.category || 'Sonstiges'
      if (!map[cat]) map[cat] = { total: 0, count: 0 }
      map[cat].total += t.amount
      map[cat].count++
    }
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([cat, { total, count }]) => {
        const base  = CAT_DEFAULTS[cat] || { color: '#6b7280', icon: 'help-circle' }
        const color = overrides[cat] || base.color
        const pct   = grand > 0 ? Math.round(total / grand * 100) : 0
        return { cat, total, count, color, icon: base.icon, pct }
      })
  }

  afterUpdate(() => { if (typeof lucide !== 'undefined') lucide.createIcons() })
  onMount(()     => { if (typeof lucide !== 'undefined') lucide.createIcons() })
</script>

<div id="categories-page" class="page active fade-up">

  <div class="page-header">
    <h1 class="page-title">Categories</h1>
    <div class="cat-type-toggle">
      <button class="cat-type-btn" class:active={typeTab === 'expense'} on:click={() => { typeTab = 'expense' }}>Expenses</button>
      <button class="cat-type-btn" class:active={typeTab === 'income'}  on:click={() => { typeTab = 'income'  }}>Income</button>
    </div>
  </div>

  {#if catData.length}
    <div class="cat-grid">
      {#each catData as item}
        <div class="cat-card">
          <div class="cat-card-accent" style="background:{item.color}"></div>
          <div class="cat-card-header">
            <div class="cat-card-icon" style="background:{item.color}18;border:1px solid {item.color}30">
              <i data-lucide={item.icon} style="color:{item.color}"></i>
            </div>
            <span class="cat-card-pct" style="background:{item.color}18;color:{item.color}">
              {item.pct}%
            </span>
          </div>
          <div class="cat-card-name">{item.cat}</div>
          <div class="cat-card-count">{item.count} transaction{item.count !== 1 ? 's' : ''}</div>
          <div class="cat-card-amount" style="color:{item.color}">{fmt(item.total)}</div>
          <div class="cat-card-bar-wrap">
            <div class="cat-card-bar" style="width:{item.pct}%;background:{item.color}"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div style="padding:48px 20px;text-align:center;color:var(--muted-fg)">
      <i data-lucide="tag" style="width:44px;height:44px;margin-bottom:14px;opacity:.4"></i>
      <p style="font-size:16px;font-weight:600;color:var(--fg2);margin-bottom:6px">No {typeTab} data</p>
      <p style="font-size:13.5px">Import transactions to see category breakdown</p>
    </div>
  {/if}

</div>
