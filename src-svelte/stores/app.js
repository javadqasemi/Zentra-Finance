import { writable, derived } from 'svelte/store'

// ── Core data ────────────────────────────────────────────────────────────────
export const transactions = writable([])
export const bankAccounts = writable([])
export const profile      = writable({ firstName: '', lastName: '', email: '' })

// ── Navigation ────────────────────────────────────────────────────────────────
export const currentPage = writable('dashboard')

// ── Time filter ───────────────────────────────────────────────────────────────
export const currentFilter    = writable('all')
export const customRangeStart = writable('')
export const customRangeEnd   = writable('')

// ── UI state ──────────────────────────────────────────────────────────────────
export const theme = writable(localStorage.getItem('theme') || 'dark')

theme.subscribe(t => {
  document.body.setAttribute('data-theme', t)
  localStorage.setItem('theme', t)
})

// ── Category color overrides (localStorage) ───────────────────────────────────
function loadCatOverrides() {
  try { return JSON.parse(localStorage.getItem('catColorOverrides') || '{}') }
  catch { return {} }
}
export const catColorOverrides = writable(loadCatOverrides())

catColorOverrides.subscribe(v => {
  localStorage.setItem('catColorOverrides', JSON.stringify(v))
})

// ── Category config (static defaults — colors overridable via catColorOverrides) ──
export const CAT_DEFAULTS = {
  'Lebensmittel':     { color: '#22c55e', icon: 'shopping-cart' },
  'Restaurant':       { color: '#f97316', icon: 'utensils' },
  'Transport':        { color: '#3b82f6', icon: 'train' },
  'Einkaufen':        { color: '#ec4899', icon: 'shopping-bag' },
  'Gesundheit':       { color: '#ef4444', icon: 'heart' },
  'Wohnen':           { color: '#8b5cf6', icon: 'home' },
  'Unterhaltung':     { color: '#f59e0b', icon: 'film' },
  'Bildung':          { color: '#06b6d4', icon: 'graduation-cap' },
  'Finanzen':         { color: '#6366f1', icon: 'landmark' },
  'Versicherungen':   { color: '#84cc16', icon: 'shield' },
  'Dienstleistungen': { color: '#14b8a6', icon: 'briefcase' },
  'Spenden':          { color: '#f472b6', icon: 'heart-handshake' },
  'Einnahmen':        { color: '#22c55e', icon: 'trending-up' },
  'Auszahlung':       { color: '#9ca3af', icon: 'banknote' },
  'Transfer':         { color: '#6b7280', icon: 'arrow-left-right' },
  'Sonstiges':        { color: '#6b7280', icon: 'help-circle' },
}

// ── Derived: filtered transactions ────────────────────────────────────────────
export const filteredTransactions = derived(
  [transactions, currentFilter, customRangeStart, customRangeEnd],
  ([$transactions, $filter, $start, $end]) => {
    return applyFilter($transactions, $filter, $start, $end)
  }
)

function applyFilter(txs, filter, start, end) {
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)

  if (filter === 'all') return txs

  if (filter === 'today') {
    return txs.filter(t => t.date === today)
  }
  if (filter === 'week') {
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return txs.filter(t => new Date(t.date) >= weekAgo)
  }
  if (filter === 'month') {
    const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return txs.filter(t => t.date.startsWith(m))
  }
  if (filter === '3months') {
    const threeAgo = new Date(now)
    threeAgo.setMonth(threeAgo.getMonth() - 3)
    return txs.filter(t => new Date(t.date) >= threeAgo)
  }
  if (filter === 'year') {
    return txs.filter(t => t.date.startsWith(String(now.getFullYear())))
  }
  if (filter === 'lastyear') {
    return txs.filter(t => t.date.startsWith(String(now.getFullYear() - 1)))
  }
  if (filter === 'custom' && start && end) {
    return txs.filter(t => t.date >= start && t.date <= end)
  }
  return txs
}

// ── Data loading ──────────────────────────────────────────────────────────────
export async function loadAll() {
  const [txs, accs, prof] = await Promise.all([
    window.api.getTransactions(),
    window.api.getBankAccounts(),
    window.api.getProfile(),
  ])
  transactions.set(txs  || [])
  bankAccounts.set(accs || [])
  profile.set(prof      || { firstName: '', lastName: '', email: '' })
}
