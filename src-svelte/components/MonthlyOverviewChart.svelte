<script>
  /**
   * MonthlyOverviewChart.svelte — paired sparkline (income + expense) by month × years.
   * Mirrors renderMonthlyChart() from src/index.html. Uses HTML divs (not Chart.js).
   */
  import { fmt } from '../lib/format.js'

  export let transactions = []

  const MO_DEFAULT = { income: '#16db65', expense: '#ff0a54' }

  function getMoColors() {
    try { return { ...MO_DEFAULT, ...JSON.parse(localStorage.getItem('moChartColors') || '{}') } }
    catch { return { ...MO_DEFAULT } }
  }
  function setMoColor(key, value) {
    const c = getMoColors()
    c[key] = value
    localStorage.setItem('moChartColors', JSON.stringify(c))
    moC = c
  }

  let moC = getMoColors()

  $: ({ years, totals, totalIn, totalEx, maxVal, inMap, exMap } = (() => {
    const inMap = {}, exMap = {}, yearsSet = new Set()
    let totalIn = 0, totalEx = 0
    for (const t of transactions) {
      const date = t.date || ''
      const mk = date.slice(0, 7)
      const yr = date.slice(0, 4)
      if (yr) yearsSet.add(yr)
      if (t.type === 'income')  { inMap[mk] = (inMap[mk] || 0) + t.amount; totalIn += t.amount }
      if (t.type === 'expense') { exMap[mk] = (exMap[mk] || 0) + t.amount; totalEx += t.amount }
    }
    const years = [...yearsSet].sort().slice(-5)
    const allVals = years.flatMap(y =>
      Array.from({ length: 12 }, (_, m) => {
        const k = `${y}-${String(m + 1).padStart(2, '0')}`
        return Math.max(inMap[k] || 0, exMap[k] || 0)
      }),
    )
    const maxVal = Math.max(...allVals, 1)
    return { years, totals: null, totalIn, totalEx, maxVal, inMap, exMap }
  })())
</script>

<div class="monthly-overview-strip">
  <div class="mo-header">
    <div class="mo-legend">
      <label class="mo-dot mo-dot-pick" style="background:{moC.income}" title="Click to change color">
        <input type="color" value={moC.income} on:change={(e) => setMoColor('income', e.target.value)} />
      </label>
      <span class="mo-legend-label">Income</span>
      <span class="mo-legend-val" style="color:{moC.income}">{fmt(totalIn)}</span>
    </div>
    <div class="mo-legend">
      <label class="mo-dot mo-dot-pick" style="background:{moC.expense}" title="Click to change color">
        <input type="color" value={moC.expense} on:change={(e) => setMoColor('expense', e.target.value)} />
      </label>
      <span class="mo-legend-label">Expenses</span>
      <span class="mo-legend-val" style="color:{moC.expense}">{fmt(totalEx)}</span>
    </div>
  </div>
  <div class="cat-bars mo-bars">
    {#each years as year, yi}
      {#if yi > 0}
        <div class="cat-bar-year-gap"><span class="cat-bar-year-lbl">{year}</span></div>
      {/if}
      {#each Array(12) as _, m}
        {@const key = `${year}-${String(m + 1).padStart(2, '0')}`}
        {@const inc = inMap[key] || 0}
        {@const exp = exMap[key] || 0}
        {@const hI  = Math.max(6, Math.round((inc / maxVal) * 100))}
        {@const hE  = Math.max(6, Math.round((exp / maxVal) * 100))}
        {@const tip = new Date(+year, m, 1).toLocaleDateString('en-CH', { month: 'long', year: 'numeric' })}
        <div class="mo-pair" title="{tip} — Income: {fmt(inc)} · Expenses: {fmt(exp)}">
          <div class="cat-bar-seg" style="height:{hI}%;background:{moC.income};opacity:{inc > 0 ? 0.85 : 0.15}"></div>
          <div class="cat-bar-seg" style="height:{hE}%;background:{moC.expense};opacity:{exp > 0 ? 0.85 : 0.15}"></div>
        </div>
      {/each}
    {/each}
  </div>
</div>
