<script>
  /**
   * Settings.svelte — Tabbed Settings page (Company / Admin / Themes).
   * Mirrors the settings-page from src/index.html.
   */
  import { onMount, afterUpdate } from 'svelte'
  import { users, loadAll, theme } from '../stores/app.js'
  import { showToast } from '../stores/toast.js'
  import { initials, refreshIcons } from '../lib/format.js'
  import UserModal from '../modals/UserModal.svelte'

  let tab = 'company'   // 'company' | 'admin' | 'themes'

  // ── Company state (localStorage) ──────────────────────────────────────────
  const COMPANY_KEYS = ['name','industry','address','city','country','taxid','phone','email','website']
  let company = {}
  let logoSrc = null

  function loadCompany() {
    const out = {}
    for (const k of COMPANY_KEYS) out[k] = localStorage.getItem('company-' + k) || ''
    company = out
    logoSrc = localStorage.getItem('companyLogo') || null
  }

  function saveCompanyInfo() {
    for (const k of COMPANY_KEYS) localStorage.setItem('company-' + k, company[k] || '')
    showToast('Company info saved', 'success')
  }

  function onLogoFile(e) {
    const f = e.target.files && e.target.files[0]
    if (!f || !f.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const max = 200
        const c = document.createElement('canvas')
        const r = Math.min(max / img.naturalWidth, max / img.naturalHeight, 1)
        c.width = Math.round(img.naturalWidth  * r)
        c.height = Math.round(img.naturalHeight * r)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        const data = c.toDataURL('image/png')
        localStorage.setItem('companyLogo', data)
        logoSrc = data
        showToast('Logo uploaded', 'success')
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(f)
  }
  function removeLogo() {
    localStorage.removeItem('companyLogo')
    logoSrc = null
    showToast('Logo removed', 'success')
  }

  // ── Users (Admin) ─────────────────────────────────────────────────────────
  let userModalOpen = false
  let editingUser = null

  function openAddUser()  { editingUser = null; userModalOpen = true }
  function openEditUser(u) { editingUser = u; userModalOpen = true }
  async function deleteUser(u) {
    if (!confirm(`Delete user "${u.firstName || ''} ${u.lastName || ''}"?`)) return
    try {
      await window.api.deleteUser(u.id)
      showToast('User deleted', 'success')
      await loadAll()
    } catch (err) {
      showToast('Delete failed', 'error')
    }
  }
  async function onUserSaved() { await loadAll() }

  // ── Themes ────────────────────────────────────────────────────────────────
  const BUILTIN_THEMES = [
    { id: 'dark',  name: 'Dark',  primary: '#dcff00', bg: '#07070e' },
    { id: 'blue',  name: 'Blue',  primary: '#4d8ef0', bg: '#060d1f' },
    { id: 'light', name: 'Light', primary: '#4d8ef0', bg: '#f0f2f8' },
  ]
  function pickTheme(id) {
    theme.set(id)
    showToast(`Theme: ${id}`, 'success')
  }

  // Editable theme variables (subset matching production)
  const THEME_VARS = [
    { var: '--bg',          label: 'Background' },
    { var: '--fg',          label: 'Text' },
    { var: '--primary',     label: 'Primary' },
    { var: '--green',       label: 'Income' },
    { var: '--red',         label: 'Expense' },
    { var: '--glass-bg',    label: 'Glass surface' },
    { var: '--nav-bg',      label: 'Nav background' },
  ]
  let themeColors = {}

  function readThemeColors() {
    const style = getComputedStyle(document.body)
    const out = {}
    for (const v of THEME_VARS) out[v.var] = style.getPropertyValue(v.var).trim()
    themeColors = out
  }
  function setThemeColor(varName, value) {
    document.body.style.setProperty(varName, value)
    themeColors[varName] = value
    themeColors = themeColors
    // persist
    const key = `themeOverrides:${$theme}`
    const prev = JSON.parse(localStorage.getItem(key) || '{}')
    prev[varName] = value
    localStorage.setItem(key, JSON.stringify(prev))
  }
  function resetThemeColors() {
    const key = `themeOverrides:${$theme}`
    const prev = JSON.parse(localStorage.getItem(key) || '{}')
    for (const v in prev) document.body.style.removeProperty(v)
    localStorage.removeItem(key)
    readThemeColors()
    showToast('Theme reset', 'success')
  }

  // Re-read colors when theme changes
  $: if ($theme) requestAnimationFrame(readThemeColors)

  // ── Nav size editor ──────────────────────────────────────────────────────
  const NAV_VARS = [
    { var: '--nav-height',     label: 'Bar height',  min: 30, max: 80, suffix: 'px' },
    { var: '--nav-tab-font',   label: 'Tab font',    min: 9,  max: 18, suffix: 'px' },
    { var: '--nav-tab-icon',   label: 'Tab icon',    min: 9,  max: 18, suffix: 'px' },
    { var: '--nav-btn-size',   label: 'Button size', min: 18, max: 40, suffix: 'px' },
    { var: '--nav-avatar-size', label: 'Avatar size', min: 18, max: 44, suffix: 'px' },
  ]
  let navValues = {}
  function readNavValues() {
    const style = getComputedStyle(document.body)
    const out = {}
    for (const v of NAV_VARS) out[v.var] = parseInt(style.getPropertyValue(v.var)) || 0
    navValues = out
  }
  function setNavValue(varName, value) {
    document.body.style.setProperty(varName, value + 'px')
    navValues[varName] = value
    navValues = navValues
    const prev = JSON.parse(localStorage.getItem('navSizes') || '{}')
    prev[varName] = value
    localStorage.setItem('navSizes', JSON.stringify(prev))
  }
  function resetNavSizes() {
    const prev = JSON.parse(localStorage.getItem('navSizes') || '{}')
    for (const v in prev) document.body.style.removeProperty(v)
    localStorage.removeItem('navSizes')
    readNavValues()
    showToast('Nav sizes reset', 'success')
  }

  onMount(() => {
    loadCompany()
    readThemeColors()
    readNavValues()
    refreshIcons()
  })
  afterUpdate(() => { refreshIcons() })
</script>

<div id="settings-page" class="page active fade-up">
  <div class="settings-wrap">

    <div class="settings-tabs">
      <button class="settings-tab" class:active={tab === 'company'} on:click={() => tab = 'company'}>
        <i data-lucide="building-2" style="width:15px;height:15px"></i><span>Company</span>
      </button>
      <button class="settings-tab" class:active={tab === 'admin'} on:click={() => tab = 'admin'}>
        <i data-lucide="shield" style="width:15px;height:15px"></i><span>Admin</span>
      </button>
      <button class="settings-tab" class:active={tab === 'themes'} on:click={() => tab = 'themes'}>
        <i data-lucide="palette" style="width:15px;height:15px"></i><span>Themes</span>
      </button>
    </div>

    {#if tab === 'company'}
      <div class="settings-panel active">
        <h2 class="settings-heading"><i data-lucide="image" style="width:20px;height:20px"></i> Company Logo</h2>
        <p class="settings-desc">Upload your company logo. Used in exports and branding.</p>
        <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px">
          <label class="company-logo-preview" style="cursor:pointer">
            {#if logoSrc}
              <img src={logoSrc} alt="logo" style="width:100%;height:100%;object-fit:contain;border-radius:12px" />
            {:else}
              <i data-lucide="building-2" style="width:32px;height:32px;color:var(--muted-fg)"></i>
            {/if}
            <input type="file" accept="image/*" on:change={onLogoFile} hidden />
          </label>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;margin-bottom:4px">Company Logo</div>
            <div style="font-size:11.5px;color:var(--muted-fg);margin-bottom:8px">PNG, JPG or SVG. Recommended 200×200px.</div>
            <div style="display:flex;gap:8px">
              <label class="btn btn-secondary btn-sm" style="cursor:pointer">
                <i data-lucide="upload" style="width:12px;height:12px"></i> Upload
                <input type="file" accept="image/*" on:change={onLogoFile} hidden />
              </label>
              {#if logoSrc}
                <button class="btn btn-secondary btn-sm" on:click={removeLogo}>
                  <i data-lucide="trash-2" style="width:12px;height:12px"></i> Remove
                </button>
              {/if}
            </div>
          </div>
        </div>

        <div style="border-top:1px solid var(--sub-border);padding-top:24px">
          <h2 class="settings-heading"><i data-lucide="building-2" style="width:20px;height:20px"></i> Company Information</h2>
          <p class="settings-desc">Used in exports and reports.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            {#each [
              { key: 'name',     label: 'Company Name', placeholder: 'Zentra GmbH' },
              { key: 'industry', label: 'Industry',     placeholder: 'Finance & Technology' },
              { key: 'address',  label: 'Address',      placeholder: 'Bahnhofstrasse 1' },
              { key: 'city',     label: 'City / ZIP',   placeholder: '8001 Zürich' },
              { key: 'country',  label: 'Country',      placeholder: 'Switzerland' },
              { key: 'taxid',    label: 'Tax ID / UID', placeholder: 'CHE-123.456.789' },
              { key: 'phone',    label: 'Phone',        placeholder: '+41 44 123 45 67' },
              { key: 'email',    label: 'Email',        placeholder: 'info@company.ch' },
            ] as f}
              <div class="form-group">
                <label class="form-label">{f.label}</label>
                <input type="text" class="form-input" bind:value={company[f.key]} placeholder={f.placeholder} />
              </div>
            {/each}
            <div class="form-group" style="grid-column:span 2">
              <label class="form-label">Website</label>
              <input type="url" class="form-input" bind:value={company.website} placeholder="https://company.ch" />
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
            <button class="btn btn-primary btn-sm" on:click={saveCompanyInfo}>
              <i data-lucide="save" style="width:13px;height:13px"></i> Save Company Info
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if tab === 'admin'}
      <div class="settings-panel active">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <h2 class="settings-heading" style="margin-bottom:4px">
              <i data-lucide="users" style="width:20px;height:20px"></i> Team & Users
            </h2>
            <p class="settings-desc">Manage team members and their roles.</p>
          </div>
          <button class="btn btn-primary btn-sm" on:click={openAddUser}>
            <i data-lucide="user-plus" style="width:14px;height:14px"></i> Add User
          </button>
        </div>
        <div class="user-list">
          {#each $users as u}
            <div class="user-card glass" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;margin-bottom:8px">
              <div class="us-avatar" style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--purple));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#fff;overflow:hidden">
                {#if u.imageSrc}
                  <img src={u.imageSrc} alt={u.firstName} style="width:100%;height:100%;object-fit:cover" />
                {:else}
                  {initials(u.firstName, u.lastName)}
                {/if}
              </div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:14px">{u.firstName || ''} {u.lastName || ''}</div>
                <div style="font-size:12px;color:var(--muted-fg)">{u.email || '—'}</div>
              </div>
              <span style="font-size:11px;padding:3px 10px;border-radius:8px;background:var(--sub-bg);border:1px solid var(--sub-border);text-transform:uppercase;letter-spacing:.5px">{u.role}</span>
              <button class="card-btn" on:click={() => openEditUser(u)} title="Edit"><i data-lucide="pencil"></i></button>
              <button class="card-btn" on:click={() => deleteUser(u)} title="Delete" style="color:var(--red)"><i data-lucide="trash-2"></i></button>
            </div>
          {:else}
            <div style="padding:48px 20px;text-align:center;color:var(--muted-fg)">
              <i data-lucide="users" style="width:44px;height:44px;margin-bottom:14px;opacity:.4"></i>
              <p style="font-size:14px;font-weight:600">No users yet</p>
            </div>
          {/each}
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:var(--sub-bg);border:1px solid var(--sub-border);border-radius:10px">
          <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted-fg)">
            <i data-lucide="info" style="width:14px;height:14px;flex-shrink:0"></i>
            <span>Roles are organisational only. <strong>Admin</strong>: full access + user management. <strong>Editor</strong>: add/edit data. <strong>Viewer</strong>: read-only.</span>
          </div>
        </div>
      </div>
    {/if}

    {#if tab === 'themes'}
      <div class="settings-panel active">
        <h2 class="settings-heading"><i data-lucide="palette" style="width:20px;height:20px"></i> Themes</h2>
        <p class="settings-desc">Switch between built-in themes.</p>
        <div class="theme-gallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
          {#each BUILTIN_THEMES as t}
            <div
              class="theme-card glass"
              class:active={$theme === t.id}
              style="padding:14px;border-radius:14px;cursor:pointer;{$theme === t.id ? 'border-color:var(--primary)' : ''}"
              on:click={() => pickTheme(t.id)}
              role="button" tabindex="0"
            >
              <div style="height:42px;border-radius:10px;background:linear-gradient(135deg,{t.bg},{t.primary}66);margin-bottom:10px"></div>
              <div style="font-weight:600;font-size:13px">{t.name}</div>
              <div style="font-size:11px;color:var(--muted-fg)">{t.id === $theme ? 'Active' : 'Click to apply'}</div>
            </div>
          {/each}
        </div>

        <div style="border-top:1px solid var(--sub-border);margin-top:28px;padding-top:24px">
          <h2 class="settings-heading"><i data-lucide="palette" style="width:20px;height:20px"></i> Theme Colors</h2>
          <p class="settings-desc">Customise the active theme. Changes apply instantly and are saved.</p>
          <div class="theme-color-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
            {#each THEME_VARS as v}
              <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--sub-bg);border:1px solid var(--sub-border);border-radius:10px">
                <input type="color" value={themeColors[v.var]} on:input={(e) => setThemeColor(v.var, e.target.value)} style="width:30px;height:30px;border:none;background:none;cursor:pointer" />
                <span style="font-size:12px;flex:1">{v.label}</span>
                <code style="font-size:10px;color:var(--muted-fg)">{themeColors[v.var]}</code>
              </label>
            {/each}
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
            <button class="btn btn-secondary btn-sm" on:click={resetThemeColors}>
              <i data-lucide="rotate-ccw" style="width:13px;height:13px"></i> Reset to Default
            </button>
          </div>
        </div>

        <div style="border-top:1px solid var(--sub-border);margin-top:28px;padding-top:24px">
          <h2 class="settings-heading"><i data-lucide="ruler" style="width:20px;height:20px"></i> Navigation Size</h2>
          <p class="settings-desc">Adjust nav-bar sizes. Saved automatically.</p>
          <div class="nav-size-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
            {#each NAV_VARS as v}
              <div style="padding:10px 12px;background:var(--sub-bg);border:1px solid var(--sub-border);border-radius:10px">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                  <span>{v.label}</span>
                  <span style="color:var(--muted-fg)">{navValues[v.var]}{v.suffix}</span>
                </div>
                <input type="range" min={v.min} max={v.max} value={navValues[v.var]} on:input={(e) => setNavValue(v.var, parseInt(e.target.value))} style="width:100%" />
              </div>
            {/each}
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
            <button class="btn btn-secondary btn-sm" on:click={resetNavSizes}>
              <i data-lucide="rotate-ccw" style="width:13px;height:13px"></i> Reset to Default
            </button>
          </div>
        </div>
      </div>
    {/if}

  </div>
</div>

<UserModal bind:open={userModalOpen} user={editingUser} on:saved={onUserSaved} />
