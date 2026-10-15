<script>
  /**
   * App.svelte — Root component.
   *
   * Renders the ambient orbs, Nav, TimeFilter sub-nav, the active page,
   * and global overlays (Toast, modals).
   *
   * The original app used a single BIG renderXxx() call per page;
   * here each page is a reactive Svelte component that auto-updates
   * when stores change.
   */
  import { onMount } from 'svelte'
  import { currentPage, loadAll, theme } from './stores/app.js'
  import { showToast } from './stores/toast.js'
  import { openModal } from './stores/modals.js'

  import Nav         from './components/Nav.svelte'
  import TimeFilter  from './components/TimeFilter.svelte'
  import Toast       from './components/Toast.svelte'
  import Tooltip     from './components/Tooltip.svelte'

  import TransactionModal from './modals/TransactionModal.svelte'
  import ConfirmDialog    from './modals/ConfirmDialog.svelte'
  import AccountModal     from './modals/AccountModal.svelte'

  let accountModalOpen = false

  import Dashboard   from './pages/Dashboard.svelte'
  import Wallet      from './pages/Wallet.svelte'
  import Transactions from './pages/Transactions.svelte'
  import Categories  from './pages/Categories.svelte'
  import Accounts    from './pages/Accounts.svelte'
  import Profile     from './pages/Profile.svelte'
  import Budget      from './pages/Budget.svelte'
  import Settings    from './pages/Settings.svelte'
  import Analytics   from './pages/Analytics.svelte'

  // ── Boot ──────────────────────────────────────────────────────────────────────
  onMount(async () => {
    // Apply persisted theme
    const saved = localStorage.getItem('theme') || 'blue'
    theme.set(saved)
    document.body.setAttribute('data-theme', saved)

    // Init lucide icons (from CDN, loaded in index.html)
    if (typeof lucide !== 'undefined') lucide.createIcons()

    // Load all data from Electron IPC
    try {
      await loadAll()
    } catch (e) {
      showToast('Failed to load data', 'error')
    }

    if (typeof lucide !== 'undefined') lucide.createIcons()
  })

  // Re-run lucide ONLY when the page actually changes (not on every state tick)
  let _lastPage = null
  $: if ($currentPage !== _lastPage) {
    _lastPage = $currentPage
    if (typeof lucide !== 'undefined') {
      requestAnimationFrame(() => lucide.createIcons())
    }
  }

  // ── Import CSV handler ────────────────────────────────────────────────────────
  async function handleImport() {
    try {
      const result = await window.api.openCSV()
      if (!result || !result.length) {
        showToast('No transactions imported', 'error')
        return
      }
      await window.api.importTransactions(result)
      await loadAll()
      showToast(`Imported ${result.length} transaction${result.length !== 1 ? 's' : ''}`, 'success')
    } catch (e) {
      console.error('import error:', e)
      showToast('Import failed', 'error')
    }
  }
</script>

<!-- Ambient orbs -->
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="orb orb-3"></div>
<div class="orb orb-4"></div>
<div class="orb orb-5"></div>

<div class="app">

  <!-- Top navigation bar -->
  <Nav on:openImport={handleImport} />

  <!-- Time filter sub-nav (always visible) -->
  <TimeFilter
    on:openAdd={() => openModal({ type: 'transaction', data: null })}
    on:openAddAccount={() => { accountModalOpen = true }}
    on:openImport={handleImport}
  />

  <!-- Main content area -->
  <main class="main">
    {#if $currentPage === 'dashboard'}
      <Dashboard />
    {:else if $currentPage === 'wallet'}
      <Wallet />
    {:else if $currentPage === 'transactions'}
      <Transactions />
    {:else if $currentPage === 'categories'}
      <Categories />
    {:else if $currentPage === 'accounts'}
      <Accounts />
    {:else if $currentPage === 'budget'}
      <Budget />
    {:else if $currentPage === 'analytics'}
      <Analytics />
    {:else if $currentPage === 'settings'}
      <Settings />
    {:else if $currentPage === 'profile'}
      <Profile />
    {/if}
  </main>

</div>

<!-- Global modals + toast -->
<TransactionModal />
<ConfirmDialog />
<AccountModal bind:open={accountModalOpen} account={null} on:saved={loadAll} />
<Tooltip />
<Toast />
