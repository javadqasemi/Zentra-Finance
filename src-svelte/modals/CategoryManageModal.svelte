<script>
  /**
   * CategoryManageModal.svelte — rename + recolor categories.
   * Renaming triggers db:renameCategory which updates all matching transactions on disk.
   * Color overrides live in localStorage.catColorOverrides.
   */
  import { createEventDispatcher, afterUpdate } from 'svelte'
  import { refreshIcons } from '../lib/format.js'
  import { transactions, catColorOverrides, CAT_DEFAULTS, loadAll } from '../stores/app.js'
  import { showToast } from '../stores/toast.js'

  export let open = false

  const dispatch = createEventDispatcher()

  let edits = {}    // { origName: { newName?, color? } }
  let cats = []     // [{ name, color, count, baseColor }]

  $: if (open) build()

  function build() {
    edits = {}
    const txCounts = {}
    for (const t of $transactions) {
      if (t.category) txCounts[t.category] = (txCounts[t.category] || 0) + 1
    }
    const allNames = new Set([...Object.keys(CAT_DEFAULTS), ...Object.keys(txCounts)])
    cats = [...allNames].map(name => {
      const base = CAT_DEFAULTS[name] || { color: '#6b7280', icon: 'help-circle' }
      const overrideCol = ($catColorOverrides || {})[name]
      return {
        name,
        baseColor: base.color,
        color: overrideCol || base.color,
        icon: base.icon,
        count: txCounts[name] || 0,
      }
    }).sort((a, b) => b.count - a.count)
  }

  function close() { open = false; dispatch('close') }

  function setEdit(orig, key, value) {
    if (!edits[orig]) edits[orig] = {}
    edits[orig][key] = value
    edits = edits
  }

  async function save() {
    // 1) apply rename ops via IPC
    let renames = 0
    for (const [orig, e] of Object.entries(edits)) {
      if (e.newName && e.newName !== orig) {
        try { await window.api.renameCategory({ oldName: orig, newName: e.newName }); renames++ }
        catch (err) { console.error(err) }
      }
    }
    // 2) merge colour overrides into localStorage
    const overrides = { ...($catColorOverrides || {}) }
    for (const [orig, e] of Object.entries(edits)) {
      if (e.color) overrides[e.newName || orig] = e.color
    }
    catColorOverrides.set(overrides)

    if (renames > 0) await loadAll()
    showToast('Categories saved', 'success')
    dispatch('saved')
    close()
  }

  afterUpdate(() => { refreshIcons() })
</script>

{#if open}
<div class="overlay show" on:click={close} role="presentation">
  <div class="modal" on:click|stopPropagation role="dialog" style="max-width:520px;width:90vw">
    <div class="modal-head">
      <span class="modal-title">Manage Categories</span>
      <button class="modal-close" on:click={close}><i data-lucide="x"></i></button>
    </div>
    <div class="modal-body">
      <p style="font-size:12.5px;color:var(--muted-fg);margin-bottom:14px">
        Rename a category to update all matching transactions automatically.
        Change the colour for visual customisation only.
      </p>
      <div class="cat-edit-list">
        {#each cats as cat}
          <div class="cat-edit-row" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--sub-border);border-radius:10px;background:var(--sub-bg);margin-bottom:6px">
            <input
              type="color"
              value={cat.color}
              on:input={(e) => setEdit(cat.name, 'color', e.target.value)}
              style="width:34px;height:34px;border:1px solid var(--glass-border);border-radius:8px;background:none;cursor:pointer"
              title={cat.name}
            />
            <i data-lucide={cat.icon} style="width:16px;height:16px;color:{(edits[cat.name] && edits[cat.name].color) || cat.color}"></i>
            <input
              type="text"
              class="form-input"
              value={cat.name}
              on:input={(e) => setEdit(cat.name, 'newName', e.target.value)}
              style="flex:1;font-size:13px"
            />
            <span style="font-size:11px;color:var(--muted-fg);min-width:60px;text-align:right">{cat.count} tx</span>
          </div>
        {/each}
      </div>
    </div>
    <div class="modal-foot" style="display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid var(--sub-border)">
      <button class="btn btn-secondary" on:click={close}>Cancel</button>
      <button class="btn btn-primary" on:click={save}><i data-lucide="check"></i>Save Changes</button>
    </div>
  </div>
</div>
{/if}
