<script>
  /**
   * Dashboard.svelte
   * Mirrors renderDashboard() + its sub-renders from the original index.html.
   * Uses Svelte reactive declarations ($:) so the view updates automatically
   * whenever the transactions/bankAccounts stores change.
   */
  import { filteredTransactions, transactions, bankAccounts } from '../stores/app.js'
  import { CAT_DEFAULTS, catColorOverrides } from '../stores/app.js'
  import { fmt, fmtDate, fmtDateShort, clamp } from '../lib/format.js'
  import { showToast } from '../stores/toast.js'
  import { onMount, afterUpdate } from 'svelte'

  // ── Derived stats ────────────────────────────────────────────────────────────
  $: tx = $filteredTransactions

  $: income  = tx.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0)
  $: expense = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  $: saving  = income - expense

  // Month-over-month (calculated on full unfiltered dataset)
  $: ({ incPct, expPct, savPct } = calcMoM($transactions))

  function calcMoM(allTx) {
    const now = new Date()
    const thisMonth = now.getMonth(), thisYear = now.getFullYear()
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1
    const prevYear  = thisMonth === 0 ? thisYear - 1 : thisYear
    let inPrev = 0, exPrev = 0, inCur = 0, exCur = 0
    for (const t of allTx) {
      const d = new Date(t.date)
      const m = d.getMonth(), y = d.getFullYear()
      if (m === prevMonth && y === prevYear) {
        if      (t.type === 'income')  inPrev += t.amount
        else if (t.type === 'expense') exPrev += t.amount
      } else if (m === thisMonth && y === thisYear) {
        if      (t.type === 'income')  inCur += t.amount
        else if (t.type === 'expense') exCur += t.amount
      }
    }
    return {
      incPct: pctChange(inPrev, inCur),
      expPct: pctChange(exPrev, exCur),
      savPct: pctChange(inPrev - exPrev, inCur - exCur),
    }
  }

  function pctChange(prev, cur) {
    if (prev === 0) return cur > 0 ? 100 : 0
    return Math.round((cur - prev) / prev * 100)
  }

  // ── Budget bar ────────────────────────────────────────────────────────────────
  $: budgetBars = calcBudget(income, expense)

  function calcBudget(inc, exp) {
    if (!inc && !exp) return { unusedPct: 0, usedPct: 0, reservedPct: 0 }
    const total       = inc || 1
    const usedPct     = clamp(Math.round(exp / total * 100), 0, 100)
    const reservedPct = clamp(20, 0, 100 - usedPct)
    const unusedPct   = clamp(100 - usedPct - reservedPct, 0, 100)
    return { unusedPct, usedPct, reservedPct }
  }

  // ── Category strip ────────────────────────────────────────────────────────────
  $: catStrip = buildCatStrip(tx, $catColorOverrides)

  function buildCatStrip(allTx, overrides) {
    // Top 5 expense categories
    const totals = {}
    const monthly = {}  // { 'CatName': { 'YYYY-MM': total } }

    for (const t of allTx) {
      if (t.type !== 'expense' || !t.category) continue
      totals[t.category] = (totals[t.category] || 0) + t.amount
      const ym = t.date.slice(0, 7)
      if (!monthly[t.category]) monthly[t.category] = {}
      monthly[t.category][ym] = (monthly[t.category][ym] || 0) + t.amount
    }

    const top5 = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, total]) => {
        const base = CAT_DEFAULTS[cat] || { color: '#6b7280', icon: 'help-circle' }
        const color = overrides[cat] || base.color
        const mMap  = monthly[cat] || {}

        // Build sparkline data: last 5 years worth of months
        const years = getRecentYears(mMap)
        const bars  = buildSparklineBars(mMap, years, color)

        return { cat, total, color, icon: base.icon, bars, years }
      })

    return top5
  }

  function getRecentYears(mMap) {
    const keys = Object.keys(mMap)
    if (!keys.length) return [String(new Date().getFullYear())]
    const allYears = [...new Set(keys.map(k => k.slice(0, 4)))].sort()
    // Show newest first, max 5 years
    return allYears.slice(-5)
  }

  function buildSparklineBars(mMap, years, color) {
    const allVals = years.flatMap(y =>
      Array.from({ length: 12 }, (_, m) =>
        mMap[`${y}-${String(m + 1).padStart(2, '0')}`] || 0))
    const maxVal = Math.max(...allVals, 1)
    const hasData = allVals.some(v => v > 0)
    const bars = []
    years.forEach((year, yi) => {
      if (yi > 0) bars.push({ type: 'gap', year })
      for (let m = 0; m < 12; m++) {
        const key = `${year}-${String(m + 1).padStart(2, '0')}`
        const val = mMap[key] || 0
        const h   = hasData ? Math.max(6, Math.round((val / maxVal) * 100)) : 6
        const tipLbl = new Date(+year, m, 1).toLocaleDateString('en-CH', { month: 'long', year: 'numeric' })
        bars.push({ type: 'bar', h, val, color, opacity: val > 0 ? 0.85 : 0.15, tipLbl, tipVal: fmt(val) })
      }
    })
    return bars
  }

  // ── Recent transactions ───────────────────────────────────────────────────────
  $: recentTx = tx.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  // ── Income sources ────────────────────────────────────────────────────────────
  $: incomeBySource = buildIncomeSources(tx)

  function buildIncomeSources(allTx) {
    const map = {}
    for (const t of allTx) {
      if (t.type !== 'income') continue
      const key = t.description || t.category || 'Unknown'
      if (!map[key]) map[key] = { name: key, total: 0, count: 0 }
      map[key].total += t.amount
      map[key].count++
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  }

  // ── Insights ──────────────────────────────────────────────────────────────────
  $: insights = buildInsights(tx, income, expense)

  function buildInsights(allTx, inc, exp) {
    const avgIncome  = allTx.filter(t => t.type === 'income').length
      ? inc / allTx.filter(t => t.type === 'income').length : 0
    const avgExpense = allTx.filter(t => t.type === 'expense').length
      ? exp / allTx.filter(t => t.type === 'expense').length : 0
    const topCat = (() => {
      const cats = {}
      allTx.filter(t => t.type === 'expense').forEach(t => { if (t.category) cats[t.category] = (cats[t.category] || 0) + t.amount })
      const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1])
      return sorted[0] ? { name: sorted[0][0], amount: sorted[0][1] } : null
    })()
    return { avgIncome, avgExpense, topCat, txCount: allTx.length }
  }

  // ── Cat config helper ─────────────────────────────────────────────────────────
  function getCatCfg(cat) {
    const base = CAT_DEFAULTS[cat] || { color: '#6b7280', icon: 'help-circle' }
    const color = $catColorOverrides[cat] || base.color
    return { ...base, color }
  }

  // ── Income open panel state ───────────────────────────────────────────────────
  let incomePanelOpen = false

  // ── afterUpdate: re-init lucide icons ────────────────────────────────────────
  afterUpdate(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons()
  })
  onMount(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons()
  })
</script>

<div id="dashboard-page" class="page active fade-up">

  <!-- ── Stats row ─────────────────────────────────────────────────────── -->
  <div class="stats-row glass">
    <!-- Income -->
    <div
      class="stat-card stat-card--clickable"
      on:click={() => { incomePanelOpen = !incomePanelOpen }}
      role="button"
      tabindex="0"
    >
      <div class="stat-label">Total Income</div>
      <div class="stat-value-row">
        <span class="stat-value" style="color:var(--green)" id="stat-revenue">{fmt(income)}</span>
        <span class="stat-badge {incPct >= 0 ? 'pos' : 'neg'}" id="badge-revenue">
          {incPct >= 0 ? '+' : ''}{incPct}%
        </span>
      </div>
    </div>

    <!-- Savings -->
    <div class="stat-card">
      <div class="stat-label">Net Savings</div>
      <div class="stat-value-row">
        <span class="stat-value" id="stat-saving">{fmt(saving)}</span>
        <span class="stat-badge {savPct >= 0 ? 'pos' : 'neg'}" id="badge-saving">
          {savPct >= 0 ? '+' : ''}{savPct}%
        </span>
      </div>
    </div>

    <!-- Expenses -->
    <div class="stat-card">
      <div class="stat-label">Total Expenses</div>
      <div class="stat-value-row">
        <span class="stat-value" id="stat-expense">{fmt(expense)}</span>
        <span class="stat-badge {expPct < 0 ? 'pos' : 'neg'}" id="badge-expense">
          {expPct >= 0 ? '+' : ''}{expPct}%
        </span>
      </div>
    </div>

    <!-- Tx count -->
    <div class="stat-card">
      <div class="stat-label">Transactions</div>
      <div class="stat-value-row">
        <span class="stat-value">{tx.length}</span>
      </div>
    </div>
  </div>

  <!-- ── Income inline panel ────────────────────────────────────────────── -->
  {#if incomePanelOpen}
    <div class="income-panel glass open" id="income-panel">
      <div class="income-panel-head">
        <span style="font-size:13.5px;font-weight:600">Income Transactions</span>
        <button
          class="btn btn-sm btn-secondary"
          on:click={() => { incomePanelOpen = false }}
        >
          <i data-lucide="x" style="width:13px;height:13px"></i>
          Close
        </button>
      </div>
      <div class="income-panel-table">
        {#each tx.filter(t => t.type === 'income').sort((a,b) => b.date.localeCompare(a.date)) as t}
          {@const cfg = getCatCfg(t.category)}
          <div class="tx-row income-panel-row">
            <div class="tx-avatar" style="background:linear-gradient(135deg,{cfg.color},{cfg.color}88)">
              {(t.description || '?')[0].toUpperCase()}
            </div>
            <div>
              <div class="tx-user">{t.description}</div>
              <div class="tx-desc">{t.category || '—'}</div>
            </div>
            <div class="tx-date">{fmtDate(t.date)}</div>
            <div class="tx-amount income">+{fmt(t.amount)}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- ── Category strip ────────────────────────────────────────────────── -->
  {#if catStrip.length}
    <div class="cat-strip glass">
      {#each catStrip as item}
        <div class="cat-item">
          <div class="cat-item-name">{item.cat}</div>
          <div class="cat-item-val" style="color:{item.color}">{fmt(item.total)}</div>
          <div class="cat-bars">
            {#each item.bars as bar}
              {#if bar.type === 'gap'}
                <div class="cat-bar-year-gap">
                  <span class="cat-bar-year-lbl">{bar.year}</span>
                </div>
              {:else}
                <div
                  class="cat-bar-seg"
                  style="height:{bar.h}%;background:{bar.color};opacity:{bar.opacity}"
                  title="{bar.tipLbl}: {bar.tipVal}"
                ></div>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Main grid ─────────────────────────────────────────────────────── -->
  <div class="main-grid">
    <div class="col-left">

      <!-- Budget card -->
      <div class="card glass">
        <div class="card-header">
          <div>
            <div class="card-title">Budget Overview</div>
            <div class="card-value" id="budget-val">{fmt(expense)}</div>
          </div>
        </div>
        <div class="budget-pct-row">
          <span>Unused: {budgetBars.unusedPct}%</span>
          <span>Used: {budgetBars.usedPct}%</span>
          <span>Reserved: {budgetBars.reservedPct}%</span>
        </div>
        <div class="budget-bar-wrap">
          <div class="bb-seg bb-unused" id="bar-unused" style="width:{budgetBars.unusedPct}%"></div>
          <div class="bb-seg bb-used"   id="bar-used"   style="width:{budgetBars.usedPct}%"></div>
          <div class="bb-seg bb-reserved" id="bar-reserved" style="width:{budgetBars.reservedPct}%"></div>
        </div>
        <div class="budget-legend">
          <div class="leg-item"><div class="leg-dot" style="background:#3b82f6"></div>Available</div>
          <div class="leg-item"><div class="leg-dot" style="background:#a855f7"></div>Spent</div>
          <div class="leg-item"><div class="leg-dot" style="background:rgba(255,255,255,0.18)"></div>Reserved</div>
        </div>
      </div>

      <!-- Insights card -->
      <div class="card glass">
        <div class="card-header">
          <div>
            <div class="card-title">Insights</div>
          </div>
        </div>
        <div class="insight-grid">
          <div class="insight-item">
            <div class="insight-label">Avg. Income</div>
            <div class="insight-value">{fmt(insights.avgIncome)}</div>
            <div class="insight-sub">per transaction</div>
          </div>
          <div class="insight-item">
            <div class="insight-label">Avg. Expense</div>
            <div class="insight-value">{fmt(insights.avgExpense)}</div>
            <div class="insight-sub">per transaction</div>
          </div>
          <div class="insight-item">
            <div class="insight-label">Top Category</div>
            <div class="insight-value" style="font-size:15px">
              {insights.topCat?.name ?? '—'}
            </div>
            {#if insights.topCat}
              <div class="insight-sub">{fmt(insights.topCat.amount)}</div>
            {/if}
          </div>
          <div class="insight-item">
            <div class="insight-label">Total Records</div>
            <div class="insight-value">{insights.txCount}</div>
            <div class="insight-sub">transactions</div>
          </div>
        </div>
      </div>

    </div>

    <div class="col-right">

      <!-- Income sources card -->
      <div class="card glass">
        <div class="card-header">
          <div>
            <div class="card-title">Income Sources</div>
            <div class="card-value" id="income-total">{fmt(income)}</div>
          </div>
        </div>
        <div class="income-list">
          {#each incomeBySource as src}
            <div class="income-item">
              <div class="income-left">
                <div class="income-icon">
                  <i data-lucide="trending-up"></i>
                </div>
                <div class="income-meta">
                  <span class="income-name">{src.name}</span>
                  <span class="income-count">{src.count} transaction{src.count !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <span class="income-amount" style="color:var(--green)">+{fmt(src.total)}</span>
            </div>
          {:else}
            <div style="padding:24px;text-align:center;color:var(--muted-fg);font-size:13.5px">
              No income in this period
            </div>
          {/each}
        </div>
      </div>

      <!-- Recent transactions card -->
      <div class="card glass">
        <div class="card-header">
          <div>
            <div class="card-title">Recent Transactions</div>
          </div>
        </div>
        <div class="tx-table">
          <div class="tx-head">
            <div></div>
            <div>Description</div>
            <div class="tx-col-cat">Category</div>
            <div class="tx-col-date">Date</div>
            <div style="text-align:right">Amount</div>
          </div>
          {#each recentTx as t}
            {@const cfg = getCatCfg(t.category)}
            <div class="tx-row">
              <div class="tx-avatar" style="background:linear-gradient(135deg,{cfg.color},{cfg.color}88)">
                {(t.description || '?')[0].toUpperCase()}
              </div>
              <div>
                <div class="tx-user">{t.description}</div>
              </div>
              <div class="tx-desc tx-col-cat">{t.category || '—'}</div>
              <div class="tx-date tx-col-date">{fmtDateShort(t.date)}</div>
              <div class="tx-amount {t.type}">
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </div>
            </div>
          {:else}
            <div style="padding:24px;text-align:center;color:var(--muted-fg);font-size:13.5px">
              No transactions in this period
            </div>
          {/each}
        </div>
      </div>

    </div>
  </div>
</div>
