<script>
  /**
   * TrendChart.svelte — 90-day daily expense + 7-day rolling average.
   * Mirrors renderTrendChart() from src/index.html.
   */
  import { onMount, onDestroy } from 'svelte'
  import { fmt } from '../lib/format.js'

  export let transactions = []

  let canvas
  let chart = null
  let lastHash = ''
  let cachedTickColor = null
  let cachedGridColor = null

  function build() {
    if (!canvas || typeof Chart === 'undefined') return

    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - 89)
    start.setHours(0, 0, 0, 0)

    const dailyMap = {}
    for (const t of transactions) {
      if (t.type !== 'expense' || !t.date) continue
      const d = new Date(t.date)
      if (d < start) continue
      const key = t.date.slice(0, 10)
      dailyMap[key] = (dailyMap[key] || 0) + t.amount
    }

    const labels = [], daily = []
    for (let i = 0; i < 90; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      labels.push(d.toLocaleDateString('en-CH', { month: 'short', day: 'numeric' }))
      daily.push(dailyMap[key] || 0)
    }

    const rolling = daily.map((_, i) => {
      const w = daily.slice(Math.max(0, i - 6), i + 1)
      return w.reduce((s, v) => s + v, 0) / w.length
    })

    const dataHash = JSON.stringify(daily)
    if (dataHash === lastHash && chart) return
    lastHash = dataHash

    if (chart) { chart.destroy(); chart = null }

    if (!cachedTickColor) {
      const style = getComputedStyle(document.body)
      cachedGridColor = style.getPropertyValue('--glass-border').trim() || 'rgba(255,255,255,0.06)'
      cachedTickColor = style.getPropertyValue('--muted-fg').trim()    || '#888'
    }
    const gridColor = cachedGridColor
    const tickColor = cachedTickColor

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Daily Expenses',
            data: daily,
            borderColor: 'rgba(239,68,68,0.5)',
            backgroundColor: 'rgba(239,68,68,0.08)',
            fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5,
          },
          {
            label: '7-Day Average',
            data: rolling,
            borderColor: '#ef4444',
            borderWidth: 2, tension: 0.4, pointRadius: 0, fill: false,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { color: tickColor, boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
        },
        scales: {
          x: {
            ticks: { color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } },
            grid: { color: gridColor },
          },
          y: {
            beginAtZero: true,
            ticks: { color: tickColor, callback: v => fmt(v), font: { size: 10 } },
            grid: { color: gridColor },
          },
        },
      },
    })
  }

  // Reactive: rebuild only when the source array reference changes
  $: if (transactions) build()

  onMount(build)
  onDestroy(() => { if (chart) chart.destroy() })
</script>

<canvas bind:this={canvas}></canvas>
