<script>
  import { currentFilter, customRangeStart, customRangeEnd } from '../stores/app.js'
  import { createEventDispatcher, onMount } from 'svelte'

  const dispatch = createEventDispatcher()

  let dropdownOpen = false

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

  function setFilter(id) {
    currentFilter.set(id)
    dropdownOpen = false
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }

  function setCustomFilter() {
    currentFilter.set('custom')
    dropdownOpen = false
  }

  function closeDropdown(e) {
    // Clicks outside the tfd-wrap close the dropdown
    if (!e.target.closest('#tfd-wrap')) {
      dropdownOpen = false
    }
  }

  onMount(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons()
  })
</script>

<svelte:window on:click={closeDropdown} />

<div class="time-filter-wrap">
  <div class="filter-row">
    <div class="chip-spacer"></div>

    <!-- Active range label -->
    <div class="filter-range-label" class:show={$currentFilter !== 'all'}>
      {activeFilter?.label ?? 'Custom Range'}
    </div>

    <!-- Add transaction button -->
    <button class="view-btn" on:click={() => dispatch('openAdd')} title="Add Transaction">
      <i data-lucide="plus"></i>
    </button>

    <!-- Filter dropdown -->
    <div class="tfd-wrap" id="tfd-wrap">
      <button
        class="tfd-trigger"
        class:open={dropdownOpen}
        id="tfd-trigger"
        on:click|stopPropagation={() => { dropdownOpen = !dropdownOpen; if (typeof lucide !== 'undefined') lucide.createIcons() }}
      >
        <i data-lucide="calendar" style="width:14px;height:14px"></i>
        <span id="tfd-label">{isCustom ? 'Custom Range' : (activeFilter?.label ?? 'All Time')}</span>
        <i data-lucide="chevron-down" class="tfd-chevron" style="width:14px;height:14px;margin-left:2px"></i>
      </button>

      <div class="tfd-menu glass" class:open={dropdownOpen} id="tfd-menu">
        {#each FILTERS as f}
          <button
            class="tfd-item"
            class:active={$currentFilter === f.id}
            data-filter={f.id}
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
          data-filter="custom"
          on:click|stopPropagation={setCustomFilter}
        >
          <i data-lucide="sliders-horizontal" style="width:13px;height:13px"></i>
          Custom Range
        </button>
      </div>
    </div>
  </div>

  <!-- Custom date range panel -->
  <div class="custom-range-panel" class:open={isCustom} id="custom-range-panel">
    <div class="custom-range-inner glass">
      <input
        type="date"
        class="form-input range-date-input"
        bind:value={$customRangeStart}
        placeholder="From"
      />
      <span style="color:var(--muted-fg);font-size:13px">→</span>
      <input
        type="date"
        class="form-input range-date-input"
        bind:value={$customRangeEnd}
        placeholder="To"
      />
      <button class="btn btn-sm btn-secondary" on:click={() => { customRangeStart.set(''); customRangeEnd.set(''); currentFilter.set('all') }}>
        Clear
      </button>
    </div>
  </div>
</div>
