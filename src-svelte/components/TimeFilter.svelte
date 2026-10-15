<script>
  import { currentFilter, customRangeStart, customRangeEnd, currentPage, globalView } from '../stores/app.js'
  import { createEventDispatcher, onMount } from 'svelte'

  const dispatch = createEventDispatcher()

  let dropdownOpen = false
  let addOpen      = false

  const FILTERS = [
    { id: 'all',      label: 'All Time',      icon: 'infinity' },
    { id: 'today',    label: 'Today',         icon: 'sun' },
    { id: 'week',     label: 'This Week',     icon: 'calendar-days' },
    { id: 'month',    label: 'This Month',    icon: 'calendar' },
    { id: '3months',  label: 'Last 3 Months', icon: 'calendar-range' },
    { id: 'year',     label: 'This Year',     icon: 'calendar-check' },
    { id: 'lastyear', label: 'Last Year',     icon: 'archive' },
  ]

  $: activeFilter = FILTERS.find(f => f.id === $currentFilter) || FILTERS[0]
  $: isCustom = $currentFilter === 'custom'

  // Hide view toggle on Dashboard, Settings, Profile
  $: showViewToggle = !['dashboard', 'settings', 'profile', 'budget', 'analytics'].includes($currentPage)

  function setFilter(id) {
    currentFilter.set(id)
    dropdownOpen = false
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }
  function setCustomFilter() {
    currentFilter.set('custom')
    dropdownOpen = false
  }
  function closeAll(e) {
    if (!e.target.closest('#tfd-wrap'))   dropdownOpen = false
    if (!e.target.closest('#add-dd-wrap')) addOpen = false
  }
  function dispatchAndClose(name) {
    addOpen = false
    dispatch(name)
  }

  onMount(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons()
  })
</script>

<svelte:window on:click={closeAll} />

<div class="time-filter-wrap">
  <div class="filter-row">
    <div class="chip-spacer"></div>

    <div class="filter-range-label" class:show={$currentFilter !== 'all'}>
      {activeFilter?.label ?? 'Custom Range'}
    </div>

    <!-- Global view toggle (list/card) -->
    {#if showViewToggle}
      <div class="global-view-toggle">
        <button class="view-btn global-view-btn" class:active={$globalView === 'list'} title="List view" on:click={() => globalView.set('list')}>
          <i data-lucide="list"></i>
        </button>
        <button class="view-btn global-view-btn" class:active={$globalView === 'card'} title="Card view" on:click={() => globalView.set('card')}>
          <i data-lucide="grid-3x3"></i>
        </button>
      </div>
    {/if}

    <!-- "+" Add dropdown -->
    <div class="add-dropdown-wrap" id="add-dd-wrap">
      <button class="view-btn" on:click|stopPropagation={() => { addOpen = !addOpen; if (typeof lucide !== 'undefined') lucide.createIcons() }} title="Add">
        <i data-lucide="plus"></i>
      </button>
      {#if addOpen}
        <div class="add-dropdown" on:click|stopPropagation role="presentation">
          <button class="add-dropdown-item" on:click={() => dispatchAndClose('openAdd')}>
            <i data-lucide="receipt"></i>
            <div>
              <div class="add-dd-label">Add Transaction</div>
              <div class="add-dd-desc">Manually add an income or expense</div>
            </div>
          </button>
          <button class="add-dropdown-item" on:click={() => dispatchAndClose('openAddAccount')}>
            <i data-lucide="landmark"></i>
            <div>
              <div class="add-dd-label">Add Account</div>
              <div class="add-dd-desc">Create a new bank account</div>
            </div>
          </button>
          <button class="add-dropdown-item" on:click={() => dispatchAndClose('openImport')}>
            <i data-lucide="file-up"></i>
            <div>
              <div class="add-dd-label">Import CSV</div>
              <div class="add-dd-desc">Upload a bank CSV file</div>
            </div>
          </button>
        </div>
      {/if}
    </div>

    <!-- Filter dropdown -->
    <div class="tfd-wrap" id="tfd-wrap">
      <button
        class="tfd-trigger"
        class:open={dropdownOpen}
        on:click|stopPropagation={() => { dropdownOpen = !dropdownOpen; if (typeof lucide !== 'undefined') lucide.createIcons() }}
      >
        <i data-lucide="calendar" style="width:14px;height:14px"></i>
        <span>{isCustom ? 'Custom Range' : (activeFilter?.label ?? 'All Time')}</span>
        <i data-lucide="chevron-down" class="tfd-chevron" style="width:14px;height:14px;margin-left:2px"></i>
      </button>

      <div class="tfd-menu glass" class:open={dropdownOpen}>
        {#each FILTERS as f}
          <button
            class="tfd-item"
            class:active={$currentFilter === f.id}
            on:click|stopPropagation={() => setFilter(f.id)}
          >
            <i data-lucide={f.icon} style="width:13px;height:13px"></i>
            {f.label}
          </button>
        {/each}
        <div class="tfd-divider"></div>
        <button
          class="tfd-item"
          class:active={$currentFilter === 'custom'}
          on:click|stopPropagation={setCustomFilter}
        >
          <i data-lucide="sliders-horizontal" style="width:13px;height:13px"></i>
          Custom Range
        </button>
      </div>
    </div>
  </div>

  <div class="custom-range-panel" class:open={isCustom}>
    <div class="custom-range-inner glass">
      <input type="date" class="form-input range-date-input" bind:value={$customRangeStart} />
      <span style="color:var(--muted-fg);font-size:13px">→</span>
      <input type="date" class="form-input range-date-input" bind:value={$customRangeEnd} />
      <button class="btn btn-sm btn-secondary" on:click={() => { customRangeStart.set(''); customRangeEnd.set(''); currentFilter.set('all') }}>
        Clear
      </button>
    </div>
  </div>
</div>
