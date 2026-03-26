<script>
  import { currentPage } from '../stores/app.js'
  import { profile, loadAll } from '../stores/app.js'
  import { theme } from '../stores/app.js'
  import { showToast } from '../stores/toast.js'
  import { initials } from '../lib/format.js'
  import { createEventDispatcher, onMount } from 'svelte'

  const dispatch = createEventDispatcher()

  const THEMES = [
    { id: 'dark',  icon: 'moon',     label: 'Dark'  },
    { id: 'blue',  icon: 'droplets', label: 'Blue'  },
    { id: 'light', icon: 'sun',      label: 'Light' },
  ]

  // Derive current theme index from the store
  $: themeObj = THEMES.find(t => t.id === $theme) || THEMES[0]

  function cycleTheme() {
    const idx = THEMES.findIndex(t => t.id === $theme)
    const next = THEMES[(idx + 1) % THEMES.length]
    theme.set(next.id)
    showToast(`Theme: ${next.label}`, 'success')
    // Re-init lucide after theme update
    requestAnimationFrame(() => typeof lucide !== 'undefined' && lucide.createIcons())
  }

  function navigateTo(page) {
    currentPage.set(page)
  }

  async function refreshApp() {
    await loadAll()
    showToast('Data refreshed', 'success')
    // Re-run current page render is handled reactively in App.svelte
  }

  // After component mounts, init lucide icons
  onMount(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons()
  })

  $: navInitials = initials($profile.firstName, $profile.lastName)
</script>

<nav class="nav">
  <div class="nav-left">
    <!-- Brand -->
    <div class="brand" on:click={() => navigateTo('dashboard')} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && navigateTo('dashboard')}>
      <div class="brand-logo">
        <i data-lucide="zap" style="width:18px;height:18px"></i>
      </div>
      <span class="brand-name">Zentra</span>
    </div>

    <!-- Page tabs -->
    <div class="nav-tabs">
      {#each [
        { id: 'dashboard',    icon: 'layout-dashboard',  label: 'Dashboard' },
        { id: 'wallet',       icon: 'wallet',            label: 'My Wallet' },
        { id: 'transactions', icon: 'arrow-left-right',  label: 'Transfer'  },
        { id: 'categories',   icon: 'tag',               label: 'Categories'},
        { id: 'accounts',     icon: 'landmark',          label: 'Accounts'  },
      ] as tab}
        <button
          class="nav-tab"
          class:active={$currentPage === tab.id}
          data-page={tab.id}
          on:click={() => navigateTo(tab.id)}
        >
          <i data-lucide={tab.icon}></i>
          <span>{tab.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="nav-right">
    <!-- Theme cycle -->
    <button class="theme-cycle-btn" on:click={cycleTheme} title="Switch theme" id="theme-btn">
      <i data-lucide={themeObj.icon} id="theme-icon"></i>
      <span id="theme-label">{themeObj.label}</span>
    </button>

    <!-- Refresh -->
    <button class="nav-icon-btn" id="refresh-btn" on:click={refreshApp} title="Refresh data">
      <i data-lucide="refresh-cw"></i>
    </button>

    <!-- Import CSV -->
    <button class="nav-icon-btn" on:click={() => dispatch('openImport')} title="Import CSV">
      <i data-lucide="upload"></i>
    </button>

    <!-- Profile avatar -->
    <div
      class="nav-avatar"
      on:click={() => navigateTo('profile')}
      role="button"
      tabindex="0"
      title="Profile"
      on:keydown={e => e.key === 'Enter' && navigateTo('profile')}
    >
      <span id="nav-initials">{navInitials}</span>
    </div>
  </div>
</nav>
