<script>
  /**
   * Analytics.svelte — Full analysis dashboard with KPI row, 5 charts and export.
   * Mirrors renderAnalytics() + the export modal from src/index.html.
   */
  import { onMount, afterUpdate } from 'svelte'
  import { transactions, bankAccounts } from '../stores/app.js'
  import { fmt, fmtDate, refreshIcons } from '../lib/format.js'
  import {
    filterByPeriod, filterByDateRange,
    buildKPIs, buildMonthlyMaps, buildCategoryTotals,
    trendConfig, savingsConfig, categoryConfig, dailyConfig, accountConfig,
  } from '../lib/analytics.js'
  import Chart from '../components/Chart.svelte'
  import { showToast } from '../stores/toast.js'

  let period = '6m'   // 3m | 6m | 1y | all
  $: tx = filterByPeriod($transactions, period)
  $: kpis = buildKPIs(tx)
  $: monthlyMaps = buildMonthlyMaps(tx)
  $: months = [...new Set([...Object.keys(monthlyMaps.inMap), ...Object.keys(monthlyMaps.exMap)])].sort()
  $: catTotals = buildCategoryTotals(tx, 'expense').slice(0, 12)

  // Top quellen (sources)
  $: topQuellen = (() => {
    const m = {}
    for (const t of tx) {
      if (t.type !== 'expense') continue
      const k = t.quelle || t.description || 'Unknown'
      m[k] = (m[k] || 0) + t.amount
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10)
  })()

  // ── Chart configs ─────────────────────────────────────────────────────────
  $: trendCfg     = trendConfig(tx)
  $: savingsCfg   = savingsConfig(tx)
  $: catCfg       = categoryConfig(tx)
  $: dailyCfg     = dailyConfig(tx)
  $: accountCfg   = accountConfig(tx, $bankAccounts)

  // Chart refs (for export)
  let trendChart, savingsChart, catChart, dailyChart, accountChart

  // ── Export modal ──────────────────────────────────────────────────────────
  let exportOpen = false
  let exportFmt  = 'pdf'   // pdf | csv | json | xlsx | html
  let dateFrom = '', dateTo = ''
  const SECTIONS = ['company','user','summary','monthly','categories','quellen','accounts','transactions','dailyspend','charts']
  let sel = SECTIONS.reduce((o, k) => (o[k] = true, o), {})

  function readCompany() {
    const KEYS = ['name','industry','address','city','country','taxid','phone','email','website']
    const out = {}
    for (const k of KEYS) out[k] = localStorage.getItem('company-' + k) || ''
    out.logo = localStorage.getItem('companyLogo') || ''
    return out
  }

  function captureCharts() {
    return {
      trend:    trendChart    && trendChart.toDataUrl(),
      savings:  savingsChart  && savingsChart.toDataUrl(),
      category: catChart      && catChart.toDataUrl(),
      daily:    dailyChart    && dailyChart.toDataUrl(),
      account:  accountChart  && accountChart.toDataUrl(),
    }
  }

  function buildExportData() {
    const filtered = filterByDateRange(tx, dateFrom, dateTo)
    const k = buildKPIs(filtered)
    const mm = buildMonthlyMaps(filtered)
    const monthsLocal = [...new Set([...Object.keys(mm.inMap), ...Object.keys(mm.exMap)])].sort()
    return {
      generatedAt: new Date().toISOString(),
      company: sel.company ? readCompany() : null,
      summary: sel.summary ? k : null,
      monthly: sel.monthly ? monthsLocal.map(m => ({ month: m, income: mm.inMap[m] || 0, expense: mm.exMap[m] || 0, net: (mm.inMap[m] || 0) - (mm.exMap[m] || 0) })) : null,
      categories:   sel.categories   ? buildCategoryTotals(filtered, 'expense') : null,
      quellen:      sel.quellen      ? topQuellen : null,
      accounts:     sel.accounts     ? $bankAccounts : null,
      transactions: sel.transactions ? filtered : null,
      charts:       sel.charts       ? captureCharts() : null,
    }
  }

  function buildCsv(data) {
    const rows = [['Date','Description','Category','Quelle','Amount','Type','Account']]
    for (const t of data.transactions || tx) {
      const accName = ($bankAccounts.find(a => a.id === t.bankAccountId) || {}).name || ''
      rows.push([t.date || '', t.description || '', t.category || '', t.quelle || '', t.amount, t.type || '', accName])
    }
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    return csv
  }
  function buildJson(data) { return JSON.stringify(data, null, 2) }
  function buildXlsx(data) {
    // Minimal Excel XML Spreadsheet 2003
    const txs = data.transactions || tx
    const rows = txs.map(t => `<Row>
      <Cell><Data ss:Type="String">${t.date || ''}</Data></Cell>
      <Cell><Data ss:Type="String">${(t.description || '').replace(/[<>&]/g, '')}</Data></Cell>
      <Cell><Data ss:Type="String">${t.category || ''}</Data></Cell>
      <Cell><Data ss:Type="Number">${t.amount}</Data></Cell>
      <Cell><Data ss:Type="String">${t.type || ''}</Data></Cell>
    </Row>`).join('')
    return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Transactions"><Table>
<Row><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Description</Data></Cell><Cell><Data ss:Type="String">Category</Data></Cell><Cell><Data ss:Type="String">Amount</Data></Cell><Cell><Data ss:Type="String">Type</Data></Cell></Row>
${rows}
</Table></Worksheet></Workbook>`
  }
  function buildHtml(data) {
    const c = data.company || {}
    const charts = data.charts || {}
    const summaryHtml = data.summary ? `
      <h3>Summary</h3>
      <table><tr><th>Income</th><td>${fmt(data.summary.income)}</td></tr>
      <tr><th>Expense</th><td>${fmt(data.summary.expense)}</td></tr>
      <tr><th>Net</th><td>${fmt(data.summary.net)}</td></tr>
      <tr><th>Transactions</th><td>${data.summary.count}</td></tr></table>` : ''
    const monthlyHtml = data.monthly ? `
      <h3>Monthly</h3>
      <table><tr><th>Month</th><th>Income</th><th>Expense</th><th>Net</th></tr>
      ${data.monthly.map(m => `<tr><td>${m.month}</td><td>${fmt(m.income)}</td><td>${fmt(m.expense)}</td><td>${fmt(m.net)}</td></tr>`).join('')}</table>` : ''
    const catHtml = data.categories ? `
      <h3>Categories</h3>
      <table><tr><th>Category</th><th>Total</th></tr>
      ${data.categories.map(([n, v]) => `<tr><td>${n}</td><td>${fmt(v)}</td></tr>`).join('')}</table>` : ''
    const txHtml = data.transactions ? `
      <h3>Transactions</h3>
      <table><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>
      ${data.transactions.map(t => `<tr><td>${t.date || ''}</td><td>${t.description || ''}</td><td>${t.category || ''}</td><td>${fmt(t.amount)}</td></tr>`).join('')}</table>` : ''
    const chartsHtml = data.charts ? `
      <h3>Charts</h3>
      ${charts.trend ? `<img class="chart" src="${charts.trend}"/>` : ''}
      ${charts.savings ? `<img class="chart" src="${charts.savings}"/>` : ''}
      ${charts.category ? `<img class="chart" src="${charts.category}"/>` : ''}
      ${charts.daily ? `<img class="chart" src="${charts.daily}"/>` : ''}
      ${charts.account ? `<img class="chart" src="${charts.account}"/>` : ''}` : ''
    const companyHtml = data.company ? `
      <div class="company">
        ${c.logo ? `<img src="${c.logo}" style="width:72px;height:72px;object-fit:contain;border-radius:10px;border:1px solid #eee">` : ''}
        <div><h1>${c.name || ''}</h1>
        <p>${c.address || ''} ${c.city || ''}<br/>${c.email || ''} · ${c.phone || ''} · ${c.website || ''}</p></div>
      </div>` : ''
    return `<!doctype html><html><head><meta charset="utf-8"><title>Zentra Finance Report</title>
<style>body{font-family:Inter,Arial,sans-serif;max-width:900px;margin:40px auto;color:#222;font-size:13px}
h1{font-size:22px;margin:0 0 4px}h3{margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
th{background:#f5f5f5}.company{display:flex;gap:14px;align-items:flex-start;border:1px solid #ddd;padding:14px;border-radius:10px;margin-bottom:14px}
img.chart{max-width:100%;display:block;margin:10px 0}
@media print{body{margin:20px}img{max-width:100%;page-break-inside:avoid}}</style></head><body>
${companyHtml}${summaryHtml}${monthlyHtml}${catHtml}${chartsHtml}${txHtml}</body></html>`
  }

  function downloadBlob(content, mime, ext) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zentra-finance-${new Date().toISOString().slice(0, 10)}.${ext}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  async function doExport() {
    const data = buildExportData()
    if (exportFmt === 'csv')  { downloadBlob(buildCsv(data),  'text/csv;charset=utf-8',          'csv');  showToast('CSV exported',  'success'); return }
    if (exportFmt === 'json') { downloadBlob(buildJson(data), 'application/json',                 'json'); showToast('JSON exported', 'success'); return }
    if (exportFmt === 'xlsx') { downloadBlob(buildXlsx(data), 'application/vnd.ms-excel',         'xls');  showToast('XLSX exported', 'success'); return }
    if (exportFmt === 'html') { downloadBlob(buildHtml(data), 'text/html;charset=utf-8',          'html'); showToast('HTML exported', 'success'); return }
    if (exportFmt === 'pdf') {
      try {
        const html = buildHtml(data)
        const res = await window.api.exportPDF({ html })
        if (res && res.success) showToast('PDF saved', 'success')
        else                    showToast('PDF cancelled', 'error')
      } catch (err) { showToast('PDF failed', 'error') }
    }
  }

  function toggleAll(on) { for (const k of SECTIONS) sel[k] = on; sel = sel }

  onMount(() => { refreshIcons() })
  afterUpdate(() => { refreshIcons() })
</script>

<div id="analytics-page" class="page active fade-up">

  <div class="page-header">
    <h1 class="page-title">Analytics</h1>
    <div style="display:flex;gap:10px;align-items:center">
      <div class="cat-type-toggle">
        {#each ['3m','6m','1y','all'] as p}
          <button class="cat-type-btn" class:active={period === p} on:click={() => period = p}>
            {p === 'all' ? 'All' : p.toUpperCase()}
          </button>
        {/each}
      </div>
      <button class="btn btn-primary btn-sm" on:click={() => exportOpen = true}>
        <i data-lucide="download" style="width:14px;height:14px"></i> Export
      </button>
    </div>
  </div>

  <!-- KPI row -->
  <div class="stats-row glass">
    <div class="stat-card"><div class="stat-label">Total Income</div><div class="stat-value-row"><span class="stat-value" style="color:var(--green)">{fmt(kpis.income)}</span></div></div>
    <div class="stat-card"><div class="stat-label">Total Expenses</div><div class="stat-value-row"><span class="stat-value" style="color:var(--red)">{fmt(kpis.expense)}</span></div></div>
    <div class="stat-card"><div class="stat-label">Net</div><div class="stat-value-row"><span class="stat-value" style="color:{kpis.net >= 0 ? 'var(--green)' : 'var(--red)'}">{fmt(kpis.net)}</span></div></div>
    <div class="stat-card"><div class="stat-label">Transactions</div><div class="stat-value-row"><span class="stat-value">{kpis.count}</span></div></div>
  </div>

  <!-- Charts grid -->
  <div class="main-grid">
    <div class="col-left">
      <div class="card glass"><div class="card-header"><div><div class="card-title">Expense Trend</div></div></div><div style="height:280px"><Chart bind:this={trendChart} config={trendCfg} /></div></div>
      <div class="card glass"><div class="card-header"><div><div class="card-title">Monthly Savings Rate</div></div></div><div style="height:280px"><Chart bind:this={savingsChart} config={savingsCfg} /></div></div>
      <div class="card glass"><div class="card-header"><div><div class="card-title">Daily Spending Pattern</div></div></div><div style="height:280px"><Chart bind:this={dailyChart} config={dailyCfg} /></div></div>
    </div>
    <div class="col-right">
      <div class="card glass"><div class="card-header"><div><div class="card-title">Category Breakdown</div></div></div><div style="height:280px"><Chart bind:this={catChart} config={catCfg} /></div></div>
      <div class="card glass"><div class="card-header"><div><div class="card-title">Account Distribution</div></div></div><div style="height:280px"><Chart bind:this={accountChart} config={accountCfg} /></div></div>

      <!-- Top Quellen -->
      <div class="card glass">
        <div class="card-header"><div><div class="card-title">Top Sources</div></div></div>
        <div class="income-list">
          {#each topQuellen as [name, total]}
            <div class="income-item">
              <div class="income-left">
                <div class="income-icon"><i data-lucide="receipt"></i></div>
                <div class="income-meta"><span class="income-name">{name}</span></div>
              </div>
              <span class="income-amount" style="color:var(--red)">-{fmt(total)}</span>
            </div>
          {:else}
            <div style="padding:24px;text-align:center;color:var(--muted-fg);font-size:13px">No data</div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Monthly + Category tables -->
  <div class="main-grid" style="margin-top:18px">
    <div class="col-left">
      <div class="card glass">
        <div class="card-header"><div><div class="card-title">Monthly Breakdown</div></div></div>
        <div class="tx-table">
          <div class="tx-head"><div>Month</div><div>Income</div><div>Expense</div><div style="text-align:right">Net</div></div>
          {#each months as m}
            {@const inc = monthlyMaps.inMap[m] || 0}
            {@const exp = monthlyMaps.exMap[m] || 0}
            {@const net = inc - exp}
            <div class="tx-row" style="grid-template-columns:1fr 1fr 1fr 1fr">
              <span class="tx-user">{m}</span>
              <span style="color:var(--green)">{fmt(inc)}</span>
              <span style="color:var(--red)">{fmt(exp)}</span>
              <span class="tx-amount" style="color:{net >= 0 ? 'var(--green)' : 'var(--red)'}">{fmt(net)}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
    <div class="col-right">
      <div class="card glass">
        <div class="card-header"><div><div class="card-title">Category Details</div></div></div>
        <div class="tx-table">
          <div class="tx-head"><div>Category</div><div style="text-align:right">Total</div></div>
          {#each catTotals as [cat, total]}
            <div class="tx-row" style="grid-template-columns:1fr 1fr">
              <span class="tx-user">{cat}</span>
              <span class="tx-amount" style="color:var(--red)">-{fmt(total)}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Export Modal -->
{#if exportOpen}
<div class="overlay show" on:click={() => exportOpen = false} role="presentation">
  <div class="modal" on:click|stopPropagation role="dialog" style="max-width:600px">
    <div class="modal-head">
      <span class="modal-title">Export Report</span>
      <button class="modal-close" on:click={() => exportOpen = false}><i data-lucide="x"></i></button>
    </div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Format</label>
        <div style="display:flex;gap:6px">
          {#each ['pdf','csv','json','xlsx','html'] as f}
            <button class="cat-type-btn" class:active={exportFmt === f} on:click={() => exportFmt = f}>{f.toUpperCase()}</button>
          {/each}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">From</label>
          <input type="date" class="form-input" bind:value={dateFrom} />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">To</label>
          <input type="date" class="form-input" bind:value={dateTo} />
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <label class="form-label" style="margin:0">Sections</label>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" on:click={() => toggleAll(true)}>All</button>
            <button class="btn btn-secondary btn-sm" on:click={() => toggleAll(false)}>None</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
          {#each SECTIONS as k}
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;padding:6px 10px;background:var(--sub-bg);border:1px solid var(--sub-border);border-radius:8px">
              <input type="checkbox" bind:checked={sel[k]} /> {k}
            </label>
          {/each}
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" on:click={() => exportOpen = false}>Cancel</button>
      <button class="btn btn-primary" on:click={doExport}>
        <i data-lucide="download" style="width:14px;height:14px"></i> Export
      </button>
    </div>
  </div>
</div>
{/if}
