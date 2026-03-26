/**
 * format.js — Shared formatting helpers.
 * Extracted from the monolithic src/index.html <script> block.
 */

/**
 * Format a number as Swiss-locale currency.
 * Positive amounts are displayed as-is; income flag adds a + prefix.
 */
export function fmt(amount, { currency = 'CHF', showPlus = false } = {}) {
  const n = parseFloat(amount) || 0
  const formatted = new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n))
  const prefix = showPlus && n > 0 ? '+' : ''
  return `${prefix}${formatted} ${currency}`
}

/**
 * Format a YYYY-MM-DD date string to a human-readable label.
 * e.g. "2025-03-26" → "26. Mär. 2025"
 */
export function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Format a YYYY-MM-DD date string to short form.
 * e.g. "2025-03-26" → "26.03.25"
 */
export function fmtDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/**
 * Clamp a value between min and max.
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

/**
 * Returns the first letter(s) of a name for an avatar/initials display.
 */
export function initials(firstName, lastName) {
  const f = (firstName || '').trim()
  const l = (lastName || '').trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  return 'ZF'
}

/**
 * Group an array of transactions by date (YYYY-MM-DD), newest first.
 * Returns an array of { date, label, items } objects.
 */
export function groupByDate(txs) {
  const map = new Map()
  for (const tx of txs) {
    const d = tx.date || ''
    if (!map.has(d)) map.set(d, [])
    map.get(d).push(tx)
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, label: fmtDate(date), items }))
}
