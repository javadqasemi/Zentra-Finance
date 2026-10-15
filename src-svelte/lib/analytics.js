/**
 * analytics.js — Aggregation + Chart.js config builders for the Analytics page.
 */
import { fmt } from './format.js'
import { getCatCfg } from './cat.js'

// Theme-color cache — getComputedStyle() forces a layout reflow.
// We refresh once per theme change (subscribed below) instead of per-chart.
let _themeCache = null
function themeColors() {
  if (_themeCache) return _themeCache
  const s = getComputedStyle(document.body)
  _themeCache = {
    grid: s.getPropertyValue('--glass-border').trim() || 'rgba(255,255,255,0.06)',
    tick: s.getPropertyValue('--muted-fg').trim()    || '#888',
    primary: s.getPropertyValue('--primary').trim()  || '#dcff00',
  }
  return _themeCache
}
export function invalidateThemeCache() { _themeCache = null }
// Auto-invalidate when [data-theme] changes
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  new MutationObserver(invalidateThemeCache).observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'style'] })
}

export function filterByPeriod(transactions, period) {
  if (!transactions || !period || period === 'all') return transactions
  const now = new Date()
  const months = { '3m': 3, '6m': 6, '1y': 12 }[period]
  if (!months) return transactions
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - months)
  return transactions.filter(t => t.date && new Date(t.date) >= cutoff)
}

export function filterByDateRange(transactions, from, to) {
  if (!from && !to) return transactions
  return transactions.filter(t => {
    if (!t.date) return false
    if (from && t.date < from) return false
    if (to   && t.date > to)   return false
    return true
  })
}

export function buildKPIs(tx) {
  let income = 0, expense = 0
  for (const t of tx) {
    if (t.type === 'income')  income  += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return { income, expense, net: income - expense, count: tx.length }
}

export function buildMonthlyMaps(tx) {
  const inMap = {}, exMap = {}
  for (const t of tx) {
    const k = (t.date || '').slice(0, 7)
    if (!k) continue
    if (t.type === 'income')  inMap[k] = (inMap[k] || 0) + t.amount
    if (t.type === 'expense') exMap[k] = (exMap[k] || 0) + t.amount
  }
  return { inMap, exMap }
}

export function buildCategoryTotals(tx, type = 'expense') {
  const map = {}
  for (const t of tx) {
    if (t.type !== type || !t.category) continue
    map[t.category] = (map[t.category] || 0) + t.amount
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1])
}

// ─── Chart configs ─────────────────────────────────────────────────────────
export function trendConfig(tx) {
  const sorted = [...tx].filter(t => t.type === 'expense' && t.date).sort((a, b) => a.date.localeCompare(b.date))
  const map = {}
  for (const t of sorted) {
    const k = t.date.slice(0, 10)
    map[k] = (map[k] || 0) + t.amount
  }
  const labels = Object.keys(map).sort()
  const data   = labels.map(k => map[k])
  const c = themeColors()
  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily Expenses',
        data,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.12)',
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${fmt(ctx.parsed.y)}` } } },
      scales: {
        x: { ticks: { color: c.tick, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } }, grid: { color: c.grid } },
        y: { beginAtZero: true, ticks: { color: c.tick, callback: v => fmt(v), font: { size: 10 } }, grid: { color: c.grid } },
      },
    },
  }
}

export function savingsConfig(tx) {
  const { inMap, exMap } = buildMonthlyMaps(tx)
  const months = [...new Set([...Object.keys(inMap), ...Object.keys(exMap)])].sort()
  const data = months.map(m => (inMap[m] || 0) - (exMap[m] || 0))
  const colors = data.map(v => v >= 0 ? '#22c55e' : '#ef4444')
  const c = themeColors()
  return {
    type: 'bar',
    data: { labels: months, datasets: [{ label: 'Savings', data, backgroundColor: colors }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.parsed.y) } } },
      scales: {
        x: { ticks: { color: c.tick, font: { size: 10 } }, grid: { color: c.grid } },
        y: { ticks: { color: c.tick, callback: v => fmt(v), font: { size: 10 } }, grid: { color: c.grid } },
      },
    },
  }
}

export function categoryConfig(tx) {
  const totals = buildCategoryTotals(tx, 'expense').slice(0, 8)
  const labels = totals.map(([cat]) => cat)
  const data   = totals.map(([, v]) => v)
  const colors = totals.map(([cat]) => getCatCfg(cat).color)
  const c = themeColors()
  return {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: 'rgba(0,0,0,0.2)', borderWidth: 1 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { color: c.tick, font: { size: 11 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.parsed)}` } },
      },
    },
  }
}

export function dailyConfig(tx) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const sums = [0,0,0,0,0,0,0]
  for (const t of tx) {
    if (t.type !== 'expense' || !t.date) continue
    const d = new Date(t.date).getDay()  // 0 = Sun
    const i = (d + 6) % 7   // Mon = 0
    sums[i] += t.amount
  }
  const c = themeColors()
  return {
    type: 'bar',
    data: { labels: days, datasets: [{ label: 'Spending', data: sums, backgroundColor: c.primary }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.parsed.y) } } },
      scales: {
        x: { ticks: { color: c.tick, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { color: c.tick, callback: v => fmt(v), font: { size: 10 } }, grid: { color: c.grid } },
      },
    },
  }
}

export function accountConfig(tx, accounts) {
  const sums = {}
  for (const t of tx) {
    const id = t.bankAccountId || '—'
    sums[id] = (sums[id] || 0) + (t.type === 'expense' ? t.amount : 0)
  }
  const labels = [], data = [], colors = []
  for (const [id, total] of Object.entries(sums)) {
    const acc = accounts.find(a => a.id === id)
    labels.push(acc ? acc.name : 'Unassigned')
    data.push(total)
    colors.push(acc?.color || '#6b7280')
  }
  const c = themeColors()
  return {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { color: c.tick, font: { size: 11 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.parsed)}` } },
      },
    },
  }
}
