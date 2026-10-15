/**
 * budget.js — Stores for the Budget / CRM / Offers module.
 *
 * Backed by SQLite via window.api.budget.* / .contacts.* / .offers.* / .txlinks.*
 * (separate from the legacy JSON-backed transactions/accounts).
 */
import { writable, derived, get } from 'svelte/store'
import { transactions } from './app.js'

export const budgets  = writable([])
export const contacts = writable([])
export const offers   = writable([])
export const txLinks  = writable([])  // [{ txId, contactId, budgetId }]

// Unwrap { success, data, error } envelope returned by main process.
function unwrap(res) {
  if (!res) return null
  if (res.success === false) {
    console.error('[budget-api]', res.error)
    return null
  }
  return res.data
}

export async function loadBudget() {
  if (!window.api || !window.api.budget) return
  const [b, c, o, links] = await Promise.all([
    window.api.budget.list().then(unwrap),
    window.api.contacts.list().then(unwrap),
    window.api.offers.list().then(unwrap),
    window.api.txlinks.list().then(unwrap),
  ])
  budgets.set(b || [])
  contacts.set(c || [])
  offers.set(o || [])
  txLinks.set(links || [])
}

// ── Budget CRUD wrappers ─────────────────────────────────────────────────────
export async function saveBudget(input) {
  const res = input.id
    ? await window.api.budget.update(input)
    : await window.api.budget.create(input)
  const saved = unwrap(res)
  if (!saved) return null
  budgets.update(list => {
    const idx = list.findIndex(b => b.id === saved.id)
    if (idx >= 0) { list[idx] = saved; return list }
    return [...list, saved]
  })
  return saved
}

export async function deleteBudget(id) {
  const res = unwrap(await window.api.budget.delete(id))
  if (!res) return false
  budgets.update(list => list.filter(b => b.id !== id))
  return true
}

// ── Contact CRUD wrappers ────────────────────────────────────────────────────
export async function saveContact(input) {
  const res = input.id
    ? await window.api.contacts.update(input)
    : await window.api.contacts.create(input)
  const saved = unwrap(res)
  if (!saved) return null
  contacts.update(list => {
    const idx = list.findIndex(c => c.id === saved.id)
    if (idx >= 0) { list[idx] = saved; return list }
    return [...list, saved]
  })
  return saved
}

export async function deleteContact(id) {
  const res = unwrap(await window.api.contacts.delete(id))
  if (!res) return false
  contacts.update(list => list.filter(c => c.id !== id))
  return true
}

// ── Offer CRUD wrappers ──────────────────────────────────────────────────────
export async function saveOffer(input) {
  const res = input.id
    ? await window.api.offers.update(input)
    : await window.api.offers.create(input)
  const saved = unwrap(res)
  if (!saved) return null
  offers.update(list => {
    const idx = list.findIndex(o => o.id === saved.id)
    if (idx >= 0) { list[idx] = saved; return list }
    return [...list, saved]
  })
  return saved
}

export async function deleteOffer(id) {
  const res = unwrap(await window.api.offers.delete(id))
  if (!res) return false
  offers.update(list => list.filter(o => o.id !== id))
  return true
}

// ── Frequency normalisation: every entry as monthly equivalent ──────────────
export function monthlyAmount(entry) {
  const amt = Number(entry.amount) || 0
  if (entry.frequency === 'yearly') return amt / 12
  if (entry.frequency === 'once')   return 0  // one-off entries don't recur
  return amt
}

// ── Derived totals (monthly equivalent) ──────────────────────────────────────
export const budgetTotals = derived(budgets, ($budgets) => {
  let income = 0, fix = 0, variable = 0
  for (const b of $budgets) {
    if (!b.active) continue
    const m = monthlyAmount(b)
    if (b.type === 'income')   income   += m
    if (b.type === 'fix')      fix      += m
    if (b.type === 'variable') variable += m
  }
  const expenses = fix + variable
  return {
    income,
    fix,
    variable,
    expenses,
    net: income - expenses,
    savingsRate: income > 0 ? (income - expenses) / income : 0,
  }
})

// ── Soll/Ist comparison: budget vs. real transactions for a given month ─────
// monthKey: 'YYYY-MM' (defaults to current month)
export function compareBudgetWithActuals(monthKey) {
  const key = monthKey || new Date().toISOString().slice(0, 7)
  const $budgets = get(budgets)
  const $tx      = get(transactions)
  const $links   = get(txLinks)
  const linksByTx = new Map($links.map(l => [l.txId, l]))

  const monthTx = $tx.filter(t => (t.date || '').startsWith(key))

  // Bucket actuals by linked budgetId, falling back to category match.
  const actualsByBudgetId = new Map()
  const actualsByCategory = new Map()
  for (const t of monthTx) {
    const link = linksByTx.get(t.id)
    if (link && link.budgetId) {
      actualsByBudgetId.set(link.budgetId, (actualsByBudgetId.get(link.budgetId) || 0) + t.amount)
    } else if (t.category) {
      actualsByCategory.set(t.category, (actualsByCategory.get(t.category) || 0) + t.amount)
    }
  }

  return $budgets.filter(b => b.active).map(b => {
    const planned = monthlyAmount(b)
    const actual  = (actualsByBudgetId.get(b.id) || 0)
                  + (b.category && !actualsByBudgetId.has(b.id)
                      ? (actualsByCategory.get(b.category) || 0)
                      : 0)
    const delta = b.type === 'income' ? actual - planned : planned - actual
    const ratio = planned > 0 ? actual / planned : 0
    let status = 'green'
    if (b.type !== 'income') {
      if (ratio > 1.0)  status = 'red'
      else if (ratio > 0.85) status = 'yellow'
    } else {
      if (ratio < 0.85) status = 'yellow'
      if (ratio < 0.5)  status = 'red'
    }
    return { budget: b, planned, actual, delta, ratio, status }
  })
}
