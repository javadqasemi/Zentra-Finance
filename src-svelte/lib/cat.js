/**
 * cat.js — Category helpers (mirrors getCatCfg from production).
 */
import { get } from 'svelte/store'
import { CAT_DEFAULTS, catColorOverrides } from '../stores/app.js'

/** Returns { color, icon } for a category, merging localStorage overrides. */
export function getCatCfg(cat) {
  const base = CAT_DEFAULTS[cat] || { color: '#6b7280', icon: 'help-circle' }
  const overrides = get(catColorOverrides) || {}
  if (overrides[cat]) return { ...base, color: overrides[cat] }
  return base
}

/** Escape user-provided strings before embedding in HTML/attributes. */
export function esc(str) {
  if (str == null) return ''
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

/** percent-change helper (matches production pctChange) */
export function pctChange(prev, cur) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round((cur - prev) / prev * 100)
}

/** Did `dateStr` fall in `month/year`? */
export function isMonth(dateStr, month, year) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d.getMonth() === month && d.getFullYear() === year
}
