<script>
  /**
   * Dashboard.svelte — Full feature parity with renderDashboard() in src/index.html.
   * Sub-renders: stats, MoM badges, monthly overview, category strip,
   * trend chart, income waffle, income list, recent tx, insights.
   */
  import { filteredTransactions, transactions, catColorOverrides, CAT_DEFAULTS } from '../stores/app.js'
  import { fmt, fmtDate, fmtDateShort, refreshIcons } from '../lib/format.js'
  import { getCatCfg, pctChange, isMonth } from '../lib/cat.js'
  import { onMount, afterUpdate } from 'svelte'

  import MonthlyOverviewChart from '../components/MonthlyOverviewChart.svelte'
  import TrendChart           from '../components/TrendChart.svelte'
  import WaffleDotChart       from '../components/WaffleDotChart.svelte'

  // ── Filtered + unfiltered ────────────────────────────────────────────────────
  $: tx    = $filteredTransactions
  $: allTx = $transactions

  // ── Stats (single pass) ──────────────────────────────────────────────────────
  $: ({ income, expense, saving } = (() => {
    let income = 0, expense = 0
    for (const t of tx) {
      if (t.type === 'income')  income  += t.amount
      else if (t.type === 'expense') expense += t.amount
    }
    return { income, expense, saving: income - expense }
  })())

  // ── Month-over-month (always full unfiltered) ────────────────────────────────
  $: ({ incPct, expPct, savPct } = calcMoM(allTx))
  function calcMoM(arr) {
    const now = new Date()
    const tm = now.getMonth(), ty = now.getFullYear()
    const pm = tm === 0 ? 11 : tm - 1
    const py = tm === 0 ? ty - 1 : ty
    let inP = 0, exP = 0, inC = 0, exC = 0
    for (const t of arr) {
      if (!t.date) continue
      const d = new Date(t.date)
      const m = d.getMonth(), y = d.getFullYear()
      if (m === pm && y === py) {
        if (t.type === 'income') inP += t.amount
        else if (t.type === 'expense') exP += t.amount
      } else if (m === tm && y === ty) {
        if (t.type === 'income') inC += t.amount
        else if (t.type === 'expense') exC += t.amount
      }
    }
    return {
      incPct: pctChange(inP, inC),
      expPct: pctChange(exP, exC),
      savPct: pctChange(inP - exP, inC - exC),
    }
  }

  // ── Budget bars (income vs expense ratio) ────────────────────────────────────
  $: budgetBars = (() => {
    if (!income && !expense) return { unusedPct: 0, usedPct: 0, reservedPct: 0 }
    const total       = income || 1
    const usedPct     = Math.min(Math.round(expense / total * 100), 100)
    const reservedPct = Math.min(20, 100 - usedPct)
    const unusedPct   = Math.max(0, 100 - usedPct - reservedPct)
    return { unusedPct, usedPct, reservedPct }
  })()

  // ── Category strip (top 5 expense categories with sparklines) ────────────────
  $: catStrip = buildCatStrip(tx, $catColorOverrides)
  function buildCatStrip(arr, overrides) {
    const expenses = arr.filter(t => t.type === 'expense')
    if (!expenses.length) return []
    const totals = {}, monthly = {}, yearsSet = new Set()
    for (const t of expenses) {
      totals[t.category] = (totals[t.category] || 0) + t.amount
      const ym = (t.date || '').slice(0, 7)
      const yr = (t.date || '').slice(0, 4)
      if (!monthly[t.category]) monthly[t.category] = {}
      monthly[t.category][ym] = (monthly[t.category][ym] || 0) + t.amount
      if (yr) yearsSet.add(yr)
    }
    let cats = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5)
    while (cats.length < 5) cats.push(['—', 0])
    const years = [...yearsSet].sort().slice(-5)
    return cats.map(([cat, total]) => {
      const cfg  = getCatCfg(cat)
      const mMap = monthly[cat] || {}
      const allVals = years.flatMap(y => Array.from({ length: 12 }, (_, m) => mMap[`${y}-${String(m + 1).padStart(2, '0')}`] || 0))
      const maxVal  = Math.max(...allVals, 1)
      const hasData = allVals.some(v => v > 0)
      const bars = []
      years.forEach((year, yi) => {
        if (yi > 0) bars.push({ type: 'gap', year })
        for (let m = 0; m < 12; m++) {
          const key = `${year}-${String(m + 1).padStart(2, '0')}`
          const val = mMap[key] || 0
          const h = hasData ? Math.max(6, Math.round((val / maxVal) * 100)) : 6
          bars.push({ type: 'bar', h, color: cfg.color, opacity: val > 0 ? 0.85 : 0.15 })
        }
      })
      return { cat, total, color: cfg.color, bars }
    })
  }

  // ── Income by month (waffle) ─────────────────────────────────────────────────
  $: incomeByMonth = (() => {
    const map = {}
    for (const t of allTx) {
      if (t.type !== 'income' || !t.date) continue
      const d = new Date(t.date)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map[k] = (map[k] || 0) + 1
    }
    return map
  })()
  $: incomeCount = Object.values(incomeByMonth).reduce((s, v) => s + v, 0)
  $: incomeTotal = allTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)

  // ── Income list (year-grouped, top 4 categories per year) ────────────────────
  $: incomeYears = (() => {
    const inc = tx.filter(t => t.type === 'income')
    if (!inc.length) return []
    const byYear = {}
    inc.forEach(t => {
      if (!t.date) return
      const y = new Date(t.date).getFullYear()
      const c = t.category || 'Sonstiges'
      if (!byYear[y]) byYear[y] = {}
      if (!byYear[y][c]) byYear[y][c] = { amount: 0, count: 0 }
      byYear[y][c].amount += t.amount
      byYear[y][c].count++
    })
    return Object.keys(byYear).map(Number).sort((a, b) => b - a).map(year => {
      const cats = byYear[year]
      const yearTotal = Object.values(cats).reduce((s, c) => s + c.amount, 0)
      const sorted = Object.entries(cats).sort((a, b) => b[1].amount - a[1].amount).slice(0, 4)
        .map(([cat, data]) => ({
          cat, ...data,
          cfg: getCatCfg(cat),
          pct: yearTotal > 0 ? Math.round(data.amount / yearTotal * 100) : 0,
        }))
      return { year, yearTotal, items: sorted }
    })
  })()

  // ── Recent transactions (last 6) ─────────────────────────────────────────────
  $: recentTx = [...tx].sort((a, b) => new Date(b.date || '1970-01-01') - new Date(a.date || '1970-01-01')).slice(0, 6)

  function txInitials(desc) {
    return (desc || '').split(' ').map(w => w[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || '??'
  }
  const TX_AVATAR_COLORS = ['#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#22c55e']
  function txAvatarColor(desc) { return TX_AVATAR_COLORS[((desc || '').charCodeAt(0) || 0) % TX_AVATAR_COLORS.length] }

  // ── Smart Insights (matches renderInsights) ──────────────────────────────────
  $: insights = (() => {
    const now = new Date()
    const tm = now.getMonth(), ty = now.getFullYear()
    const pm = tm === 0 ? 11 : tm - 1
    const py = tm === 0 ? ty - 1 : ty
    const curTx  = tx.filter(t => isMonth(t.date, tm, ty))
    const prevTx = tx.filter(t => isMonth(t.date, pm, py))
    const curExp  = curTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const prevExp = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const curInc  = curTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const catTotals = {}
    curTx.filter(t => t.type === 'expense').forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount })
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]
    const biggest = curTx.filter(t => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0]
    const savingsRate = curInc > 0 ? Math.round((curInc - curExp) / curInc * 100) : 0
    const expTrend = pctChange(prevExp, curExp)
    return { topCat, biggest, savingsRate, expTrend }
  })()

  // ── Income inline panel state ────────────────────────────────────────────────
  let incomePanelOpen = false
  let expensePanelOpen = false

  onMount(() => { refreshIcons() })
  afterUpdate(() => { refreshIcons() })
</script>

<div id="dashboard-page" class="page active fade-up">

  <!-- Stats -->
  <div class="stats-row glass">
    <div
      class="stat-card stat-card--clickable"
      on:click={() => { incomePanelOpen = !incomePanelOpen; expensePanelOpen = false }}
      role="button" tabindex="0"
    >
      <div class="stat-label">Total Income</div>
      <div class="stat-value-row">
        <span class="stat-value" style="color:var(--green)">{fmt(income)}</span>
        <span class="stat-badge {incPct >= 0 ? 'pos' : 'neg'}">{incPct >= 0 ? '+' : ''}{incPct}%</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Net Savings</div>
      <div class="stat-value-row">
        <span class="stat-value">{fmt(saving)}</span>
        <span class="stat-badge {savPct >= 0 ? 'pos' : 'neg'}">{savPct >= 0 ? '+' : ''}{savPct}%</span>
      </div>
    </div>
    <div
      class="stat-card stat-card--clickable"
      on:click={() => { expensePanelOpen = !expensePanelOpen; incomePanelOpen = false }}
      role="button" tabindex="0"
    >
      <div class="stat-label">Total Expenses</div>
      <div class="stat-value-row">
        <span class="stat-value" style="color:var(--red)">{fmt(expense)}</span>
        <span class="stat-badge {expPct < 0 ? 'pos' : 'neg'}">{expPct >= 0 ? '+' : ''}{expPct}%</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Transactions</div>
      <div class="stat-value-row"><span class="stat-value">{tx.length}</span></div>
    </div>
  </div>

  <!-- Inline transaction panels -->
  {#if incomePanelOpen}
    <div class="income-panel glass open">
      <div class="income-panel-head">
        <span style="font-size:13.5px;font-weight:600;color:var(--green)">Income — {fmt(income)}</span>
        <button class="card-btn" on:click={() => { incomePanelOpen = false }}><i data-lucide="x"></i></button>
      </div>
      <div class="income-panel-table">
        {#each tx.filter(t => t.type === 'income').sort((a, b) => (b.date || '').localeCompare(a.date || '')) as t}
          {@const cfg = getCatCfg(t.category)}
          <div class="tx-row income-panel-row">
            <div class="tx-avatar" style="background:linear-gradient(135deg,{cfg.color},{cfg.color}88)">
              {txInitials(t.description)}
            </div>
            <span class="tx-user">{t.description}</span>
            <span class="tx-desc tx-col-cat">{t.category || '—'}</span>
            <span class="tx-date tx-col-date">{fmtDate(t.date)}</span>
            <span class="tx-amount income">+{fmt(t.amount)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
  {#if expensePanelOpen}
    <div class="income-panel glass open">
      <div class="income-panel-head">
        <span style="font-size:13.5px;font-weight:600;color:var(--red)">Expenses — {fmt(expense)}</span>
        <button class="card-btn" on:click={() => { expensePanelOpen = false }}><i data-lucide="x"></i></button>
      </div>
      <div class="income-panel-table">
        {#each tx.filter(t => t.type === 'expense').sort((a, b) => (b.date || '').localeCompare(a.date || '')) as t}
          {@const cfg = getCatCfg(t.category)}
          <div class="tx-row income-panel-row">
            <div class="tx-avatar" style="background:linear-gradient(135deg,{cfg.color},{cfg.color}88)">
              {txInitials(t.description)}
            </div>
            <span class="tx-user">{t.description}</span>
            <span class="tx-desc tx-col-cat">{t.category || '—'}</span>
            <span class="tx-date tx-col-date">{fmtDate(t.date)}</span>
            <span class="tx-amount expense">-{fmt(t.amount)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Category strip -->
  {#if catStrip.length}
    <div class="cat-strip glass">
      {#each catStrip as item}
        <div class="cat-item">
          <div class="cat-item-name">{item.cat}</div>
          <div class="cat-item-val" style="color:{item.color}">{item.total > 0 ? fmt(item.total) : '—'}</div>
          <div class="cat-bars">
            {#each item.bars as b}
              {#if b.type === 'gap'}
                <div class="cat-bar-year-gap"><span class="cat-bar-year-lbl">{b.year}</span></div>
              {:else}
                <div class="cat-bar-seg" style="height:{b.h}%;background:{b.color};opacity:{b.opacity}"></div>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Main grid -->
  <div class="main-grid">
    <div class="col-left">

      <!-- Monthly Overview -->
      <div class="card glass">
        <div class="card-header">
          <div>
            <div class="card-title">Monthly Overview</div>
            <div class="card-value">{fmt(income - expense)}</div>
          </div>
        </div>
        <MonthlyOverviewChart transactions={allTx} />
      </div>

      <!-- Trend Chart -->
      <div class="card glass">
        <div class="card-header">
          <div>
            <div class="card-title">Expense Trend (90 days)</div>
            <div class="card-value">{fmt(expense)}</div>
          </div>
        </div>
        <div style="height:240px"><TrendChart transactions={allTx} /></div>
      </div>

      <!-- Smart Insights -->
      <div class="card glass">
        <div class="card-header">
          <div><div class="card-title">Smart Insights — This Month</div></div>
        </div>
        <div class="insight-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
          <div class="insight-item">
            <div class="insight-label">Top Category</div>
            <div class="insight-value" style="font-size:15px">{insights.topCat ? insights.topCat[0] : '—'}</div>
            <div class="insight-sub">{insights.topCat ? fmt(insights.topCat[1]) + ' this month' : 'No expenses yet'}</div>
          </div>
          <div class="insight-item">
            <div class="insight-label">Savings Rate</div>
            <div class="insight-value" style="color:{insights.savingsRate >= 20 ? 'var(--green)' : insights.savingsRate >= 0 ? 'var(--yellow)' : 'var(--red)'}">{insights.savingsRate}%</div>
            <div class="insight-sub">{insights.savingsRate >= 20 ? 'On track' : insights.savingsRate >= 0 ? 'Could be better' : 'Spending exceeds income'}</div>
          </div>
          <div class="insight-item">
            <div class="insight-label">Biggest Expense</div>
            <div class="insight-value" style="font-size:15px">{insights.biggest ? fmt(insights.biggest.amount) : '—'}</div>
            <div class="insight-sub">{insights.biggest ? (insights.biggest.description || '').substring(0, 20) : 'None this month'}</div>
          </div>
          <div class="insight-item">
            <div class="insight-label">vs Last Month</div>
            <div class="insight-value" style="color:{insights.expTrend <= 0 ? 'var(--green)' : 'var(--red)'}">{insights.expTrend >= 0 ? '+' : ''}{insights.expTrend}%</div>
            <div class="insight-sub">Expenses {insights.expTrend > 0 ? 'up' : 'down'} {Math.abs(insights.expTrend)}%</div>
          </div>
        </div>
      </div>

    </div>

    <div class="col-right">

      <!-- Budget card -->
      <div class="card glass">
        <div class="card-header">
          <div>
            <div class="card-title">Budget Overview</div>
            <div class="card-value">{fmt(expense)}</div>
          </div>
        </div>
        <div class="budget-pct-row">
          <span>Unused: {budgetBars.unusedPct}%</span>
          <span>Used: {budgetBars.usedPct}%</span>
          <span>Reserved: {budgetBars.reservedPct}%</span>
        </div>
        <div class="budget-bar-wrap">
          <div class="bb-seg bb-unused" style="width:{budgetBars.unusedPct}%"></div>
          <div class="bb-seg bb-used"   style="width:{budgetBars.usedPct}%"></div>
          <div class="bb-seg bb-reserved" style="width:{budgetBars.reservedPct}%"></div>
        </div>
        <div class="budget-legend">
          <div class="leg-item"><div class="leg-dot" style="background:#3b82f6"></div>Available</div>
          <div class="leg-item"><div class="leg-dot" style="background:#a855f7"></div>Spent</div>
          <div class="leg-item"><div class="leg-dot" style="background:rgba(255,255,255,0.18)"></div>Reserved</div>
        </div>
      </div>

      <!-- Income Sources (waffle + list) -->
      <div class="card glass" id="income-sources-card">
        <div class="card-header">
          <div>
            <div class="card-title">Income Sources</div>
            <div class="card-value" style="color:var(--green)">{fmt(incomeTotal)}</div>
          </div>
        </div>
        <WaffleDotChart
          dataByMonth={incomeByMonth}
          color="var(--green)"
          emptyText="No income data yet"
          labelL={incomeCount > 0 ? `${incomeCount} transactions` : '–'}
          labelR={incomeCount > 0 ? `Total ${fmt(incomeTotal)}` : '–'}
        />
        <div class="income-list">
          {#each incomeYears as g, yi}
            <div class="income-year-section{yi > 0 ? ' income-year-section--gap' : ''}">
              <div class="income-year-label">
                <span>{g.year}</span>
                <span class="income-year-total">{fmt(g.yearTotal)}</span>
              </div>
              {#each g.items as item}
                <div class="income-item">
                  <div class="income-left">
                    <div class="income-icon" style="background:{item.cfg.color}18;border:1px solid {item.cfg.color}30">
                      <i data-lucide={item.cfg.icon} style="color:{item.cfg.color}"></i>
                    </div>
                    <div class="income-meta">
                      <span class="income-name">{item.cat}</span>
                      <span class="income-count">{fmt(item.amount)}</span>
                    </div>
                  </div>
                  <div class="income-tx-count">
                    <span class="income-count-num" style="color:var(--green)">{item.pct}%</span>
                    <span class="income-count-label">{item.count} tx</span>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div style="padding:16px 0;text-align:center;color:var(--muted-fg);font-size:13px">No income transactions</div>
          {/each}
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="card glass">
        <div class="card-header">
          <div><div class="card-title">Recent Transactions</div></div>
        </div>
        <div class="tx-table">
          {#each recentTx as t}
            <div class="tx-row">
              <div class="tx-avatar tx-col-icon" style="background:{txAvatarColor(t.description)}">{txInitials(t.description)}</div>
              <span class="tx-user">{(t.description || '').substring(0, 22)}{t.quelle ? ` · ${t.quelle}` : ''}</span>
              <span class="tx-desc tx-col-cat">{t.category}</span>
              <span class="tx-date tx-col-date">{fmtDate(t.date)}</span>
              <span class="tx-amount {t.type}">{t.type === 'income' ? '+' : '-'}{fmt(t.amount)}</span>
            </div>
          {:else}
            <div style="padding:24px;text-align:center;color:var(--muted-fg);font-size:13.5px">No transactions yet</div>
          {/each}
        </div>
      </div>

    </div>
  </div>
</div>
