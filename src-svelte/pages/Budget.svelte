<script>
  /**
   * Budget.svelte — Manual budget planning + Soll/Ist comparison.
   *
   * Sections:
   *  • KPI row — monthly equivalent: Einnahmen, Fixkosten, Variabel, Netto
   *  • Soll/Ist — budget vs. real transactions for the selected month, with Ampel
   *  • Entries  — list grouped by Fix / Variabel / Einnahmen, add/edit modal
   */
  import { onMount, afterUpdate } from 'svelte'
  import {
    budgets, contacts, budgetTotals,
    loadBudget, saveBudget, deleteBudget,
    compareBudgetWithActuals,
  } from '../stores/budget.js'
  import { fmt, refreshIcons } from '../lib/format.js'
  import { showToast } from '../stores/toast.js'

  let editing = null   // null | budget object being edited
  let monthKey = new Date().toISOString().slice(0, 7)

  $: comparison = $budgets && monthKey ? compareBudgetWithActuals(monthKey) : []

  $: groups = {
    income:   $budgets.filter(b => b.type === 'income'),
    fix:      $budgets.filter(b => b.type === 'fix'),
    variable: $budgets.filter(b => b.type === 'variable'),
  }

  onMount(async () => {
    await loadBudget()
    refreshIcons()
  })
  afterUpdate(() => { refreshIcons() })

  function openNew(type = 'fix') {
    editing = {
      id: null,
      label: '',
      amount: 0,
      type,
      category: '',
      frequency: 'monthly',
      contactId: '',
      description: '',
      active: true,
    }
  }
  function openEdit(b) {
    editing = { ...b, contactId: b.contactId || '' }
  }
  async function submit() {
    if (!editing) return
    const payload = { ...editing, contactId: editing.contactId || null }
    const saved = await saveBudget(payload)
    if (saved) {
      showToast(editing.id ? 'Budget aktualisiert' : 'Budget hinzugefügt', 'success')
      editing = null
    } else {
      showToast('Speichern fehlgeschlagen', 'error')
    }
  }
  async function remove(b) {
    if (!confirm(`„${b.label}" wirklich löschen?`)) return
    const ok = await deleteBudget(b.id)
    if (ok) showToast('Gelöscht', 'success')
  }

  const TYPE_META = {
    income:   { label: 'Einnahmen', icon: 'trending-up',   color: 'var(--success, #22c55e)' },
    fix:      { label: 'Fixkosten', icon: 'lock',          color: 'var(--primary, #6366f1)' },
    variable: { label: 'Variable',  icon: 'shuffle',       color: 'var(--warning, #f59e0b)' },
  }
  const FREQ_LABEL = { monthly: 'Monatlich', yearly: 'Jährlich', once: 'Einmalig' }
  const STATUS_BG  = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' }
</script>

<div id="budget-page" class="page active fade-up">

  <div class="page-header">
    <h1 class="page-title">Budget</h1>
    <div style="display:flex;gap:10px;align-items:center">
      <input
        type="month"
        bind:value={monthKey}
        class="month-input"
        title="Monat für Soll/Ist-Vergleich"
      />
      <button class="btn-primary" on:click={() => openNew('fix')}>
        <i data-lucide="plus" style="width:16px;height:16px"></i>
        Neuer Eintrag
      </button>
    </div>
  </div>

  <!-- KPI row -->
  <div class="kpi-row">
    <div class="kpi-card kpi-income">
      <div class="kpi-label"><i data-lucide="trending-up"></i> Einnahmen / Monat</div>
      <div class="kpi-value">{fmt($budgetTotals.income)}</div>
    </div>
    <div class="kpi-card kpi-fix">
      <div class="kpi-label"><i data-lucide="lock"></i> Fixkosten</div>
      <div class="kpi-value">{fmt($budgetTotals.fix)}</div>
    </div>
    <div class="kpi-card kpi-var">
      <div class="kpi-label"><i data-lucide="shuffle"></i> Variabel</div>
      <div class="kpi-value">{fmt($budgetTotals.variable)}</div>
    </div>
    <div class="kpi-card" class:kpi-net-pos={$budgetTotals.net >= 0} class:kpi-net-neg={$budgetTotals.net < 0}>
      <div class="kpi-label"><i data-lucide="piggy-bank"></i> Netto / Monat</div>
      <div class="kpi-value">{fmt($budgetTotals.net)}</div>
      <div class="kpi-sub">Sparquote: {Math.round($budgetTotals.savingsRate * 100)}%</div>
    </div>
  </div>

  <!-- Soll / Ist comparison -->
  <section class="section">
    <h2 class="section-title">Soll / Ist – {monthKey}</h2>
    {#if comparison.length === 0}
      <div class="empty-hint">Noch keine Budget-Einträge angelegt.</div>
    {:else}
      <div class="compare-grid">
        {#each comparison as row}
          <div class="compare-row" style="--status:{STATUS_BG[row.status]}">
            <div class="compare-dot"></div>
            <div class="compare-info">
              <div class="compare-label">
                {row.budget.label}
                <span class="compare-sub">{TYPE_META[row.budget.type].label}{row.budget.category ? ' · ' + row.budget.category : ''}</span>
              </div>
              <div class="compare-bar-wrap">
                <div class="compare-bar" style="width:{Math.min(row.ratio, 1.5) / 1.5 * 100}%;background:{STATUS_BG[row.status]}"></div>
              </div>
            </div>
            <div class="compare-amounts">
              <div class="compare-actual">{fmt(row.actual)}</div>
              <div class="compare-planned">/ {fmt(row.planned)}</div>
              <div class="compare-pct" style="color:{STATUS_BG[row.status]}">{Math.round(row.ratio * 100)}%</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Entries grouped by type -->
  {#each ['income','fix','variable'] as type}
    <section class="section">
      <div class="section-header">
        <h2 class="section-title" style="color:{TYPE_META[type].color}">
          <i data-lucide={TYPE_META[type].icon}></i>
          {TYPE_META[type].label}
        </h2>
        <button class="btn-ghost" on:click={() => openNew(type)}>
          <i data-lucide="plus" style="width:14px;height:14px"></i> Hinzufügen
        </button>
      </div>
      {#if groups[type].length === 0}
        <div class="empty-hint">Keine {TYPE_META[type].label.toLowerCase()} angelegt.</div>
      {:else}
        <div class="entry-list">
          {#each groups[type] as b}
            <div class="entry-row" class:inactive={!b.active}>
              <div class="entry-icon" style="background:{TYPE_META[type].color}22;color:{TYPE_META[type].color}">
                <i data-lucide={TYPE_META[type].icon}></i>
              </div>
              <div class="entry-main">
                <div class="entry-label">{b.label}</div>
                <div class="entry-meta">
                  {FREQ_LABEL[b.frequency]}
                  {#if b.category} · {b.category}{/if}
                  {#if b.contactId}
                    {#each $contacts.filter(c => c.id === b.contactId) as c}
                      · {c.name}
                    {/each}
                  {/if}
                </div>
              </div>
              <div class="entry-amount" style="color:{TYPE_META[type].color}">{fmt(b.amount)}</div>
              <div class="entry-actions">
                <button class="icon-btn" on:click={() => openEdit(b)} title="Bearbeiten">
                  <i data-lucide="pencil"></i>
                </button>
                <button class="icon-btn icon-btn-danger" on:click={() => remove(b)} title="Löschen">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/each}
</div>

<!-- Edit / create modal -->
{#if editing}
  <div class="modal-backdrop" on:click={() => (editing = null)} role="presentation">
    <div class="modal-card" on:click|stopPropagation role="dialog">
      <div class="modal-header">
        <h3>{editing.id ? 'Budget bearbeiten' : 'Neuer Budget-Eintrag'}</h3>
        <button class="icon-btn" on:click={() => (editing = null)}>
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="modal-body">
        <label class="field">
          <span>Bezeichnung</span>
          <input type="text" bind:value={editing.label} placeholder="z. B. Miete" />
        </label>
        <div class="field-row">
          <label class="field">
            <span>Betrag</span>
            <input type="number" step="0.01" bind:value={editing.amount} />
          </label>
          <label class="field">
            <span>Typ</span>
            <select bind:value={editing.type}>
              <option value="fix">Fixkosten</option>
              <option value="variable">Variable Kosten</option>
              <option value="income">Einnahme</option>
            </select>
          </label>
          <label class="field">
            <span>Frequenz</span>
            <select bind:value={editing.frequency}>
              <option value="monthly">Monatlich</option>
              <option value="yearly">Jährlich</option>
              <option value="once">Einmalig</option>
            </select>
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span>Kategorie</span>
            <input type="text" bind:value={editing.category} placeholder="z. B. Wohnen" />
          </label>
          <label class="field">
            <span>Kontakt / Anbieter</span>
            <select bind:value={editing.contactId}>
              <option value="">— keiner —</option>
              {#each $contacts as c}
                <option value={c.id}>{c.name}</option>
              {/each}
            </select>
          </label>
        </div>
        <label class="field">
          <span>Beschreibung</span>
          <textarea bind:value={editing.description} rows="2"></textarea>
        </label>
        <label class="field-checkbox">
          <input type="checkbox" bind:checked={editing.active} /> Aktiv
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" on:click={() => (editing = null)}>Abbrechen</button>
        <button class="btn-primary" on:click={submit}>Speichern</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .month-input {
    background: var(--glass-bg, rgba(255,255,255,.04));
    border: 1px solid var(--glass-border, rgba(255,255,255,.08));
    color: var(--fg, #fff);
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 13px;
  }
  .btn-primary {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--primary, #6366f1); color: #0a0a0b;
    border: none; border-radius: 10px; padding: 9px 16px;
    font-weight: 600; font-size: 13px; cursor: pointer;
  }
  .btn-ghost {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; color: var(--fg2, #cfd2db);
    border: 1px solid var(--glass-border, rgba(255,255,255,.1));
    border-radius: 10px; padding: 7px 14px;
    font-size: 13px; cursor: pointer;
  }
  .btn-ghost:hover { background: var(--glass-bg, rgba(255,255,255,.04)); }

  .kpi-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 22px;
  }
  .kpi-card {
    background: var(--glass-bg, rgba(255,255,255,.04));
    border: 1px solid var(--glass-border, rgba(255,255,255,.08));
    border-radius: 16px;
    padding: 16px 18px;
    backdrop-filter: blur(10px);
  }
  .kpi-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--muted-fg, #8b8e9a);
    text-transform: uppercase; letter-spacing: .5px;
  }
  .kpi-value { font-size: 22px; font-weight: 700; margin-top: 6px; }
  .kpi-sub   { font-size: 12px; color: var(--muted-fg, #8b8e9a); margin-top: 2px; }
  .kpi-income .kpi-value { color: #22c55e; }
  .kpi-fix    .kpi-value { color: var(--primary, #6366f1); }
  .kpi-var    .kpi-value { color: #f59e0b; }
  .kpi-net-pos .kpi-value { color: #22c55e; }
  .kpi-net-neg .kpi-value { color: #ef4444; }

  .section { margin-bottom: 26px; }
  .section-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px;
  }
  .section-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 16px; font-weight: 600; margin: 0;
  }
  .section-title :global(i) { width: 18px; height: 18px; }
  .empty-hint {
    padding: 20px; text-align: center;
    color: var(--muted-fg, #8b8e9a); font-size: 13px;
    background: var(--glass-bg, rgba(255,255,255,.03));
    border-radius: 12px;
  }

  /* Compare rows */
  .compare-grid { display: flex; flex-direction: column; gap: 8px; }
  .compare-row {
    display: grid; grid-template-columns: 12px 1fr auto;
    gap: 14px; align-items: center;
    background: var(--glass-bg, rgba(255,255,255,.04));
    border: 1px solid var(--glass-border, rgba(255,255,255,.06));
    border-radius: 12px; padding: 12px 16px;
  }
  .compare-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--status); box-shadow: 0 0 8px var(--status);
  }
  .compare-label  { font-weight: 600; font-size: 14px; }
  .compare-sub    { font-weight: 400; font-size: 12px; color: var(--muted-fg, #8b8e9a); margin-left: 6px; }
  .compare-bar-wrap {
    height: 4px; background: rgba(255,255,255,.06);
    border-radius: 2px; margin-top: 6px; overflow: hidden;
  }
  .compare-bar { height: 100%; transition: width .3s ease; }
  .compare-amounts { text-align: right; }
  .compare-actual  { font-size: 14px; font-weight: 700; }
  .compare-planned { font-size: 11px; color: var(--muted-fg, #8b8e9a); }
  .compare-pct     { font-size: 12px; font-weight: 600; margin-top: 2px; }

  /* Entry list */
  .entry-list { display: flex; flex-direction: column; gap: 6px; }
  .entry-row {
    display: grid;
    grid-template-columns: 36px 1fr auto auto;
    gap: 14px; align-items: center;
    padding: 10px 14px;
    background: var(--glass-bg, rgba(255,255,255,.03));
    border: 1px solid var(--glass-border, rgba(255,255,255,.06));
    border-radius: 12px;
  }
  .entry-row.inactive { opacity: .5; }
  .entry-icon {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
  }
  .entry-icon :global(i) { width: 18px; height: 18px; }
  .entry-label { font-weight: 600; font-size: 14px; }
  .entry-meta  { font-size: 12px; color: var(--muted-fg, #8b8e9a); margin-top: 2px; }
  .entry-amount { font-weight: 700; font-size: 14px; }
  .entry-actions { display: flex; gap: 4px; }
  .icon-btn {
    width: 30px; height: 30px; border-radius: 8px;
    background: transparent; border: 1px solid transparent;
    color: var(--muted-fg, #8b8e9a); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .icon-btn:hover { background: var(--glass-bg, rgba(255,255,255,.05)); color: var(--fg, #fff); }
  .icon-btn-danger:hover { color: #ef4444; }
  .icon-btn :global(i) { width: 15px; height: 15px; }

  /* Modal */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,.55);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; backdrop-filter: blur(4px);
  }
  .modal-card {
    width: 100%; max-width: 560px;
    background: var(--bg, #0a0a0b);
    border: 1px solid var(--glass-border, rgba(255,255,255,.1));
    border-radius: 16px; overflow: hidden;
    display: flex; flex-direction: column;
    max-height: 90vh;
  }
  .modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 20px; border-bottom: 1px solid var(--glass-border, rgba(255,255,255,.06));
  }
  .modal-header h3 { margin: 0; font-size: 16px; }
  .modal-body { padding: 18px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
  .modal-footer {
    display: flex; gap: 10px; justify-content: flex-end;
    padding: 14px 20px; border-top: 1px solid var(--glass-border, rgba(255,255,255,.06));
  }
  .field { display: flex; flex-direction: column; gap: 5px; flex: 1; }
  .field span { font-size: 12px; color: var(--muted-fg, #8b8e9a); }
  .field input, .field select, .field textarea {
    background: var(--glass-bg, rgba(255,255,255,.04));
    border: 1px solid var(--glass-border, rgba(255,255,255,.08));
    color: var(--fg, #fff);
    border-radius: 8px; padding: 9px 12px; font-size: 13px;
    font-family: inherit; resize: vertical;
  }
  .field input:focus, .field select:focus, .field textarea:focus {
    outline: none; border-color: var(--primary, #6366f1);
  }
  .field-row { display: flex; gap: 12px; }
  .field-checkbox {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--fg2, #cfd2db);
  }

  @media (max-width: 900px) {
    .kpi-row { grid-template-columns: repeat(2, 1fr); }
    .field-row { flex-direction: column; }
  }
</style>
