<script>
  /**
   * WaffleDotChart — Global reusable dot-grid component.
   *
   * Props:
   *   dataByMonth  — { 'YYYY-MM': count, ... }
   *   minDots      — minimum dots on Y-axis (default: 10)
   *   maxYears     — years to display (default: 5)
   *   color        — CSS color for active dots (default: var(--primary))
   *   emptyText    — shown when no data (default: 'No data yet')
   *   labelL       — left label text (optional, auto-set if omitted)
   *   labelR       — right label text (optional, auto-set if omitted)
   */
  export let dataByMonth = {}
  export let minDots     = 10
  export let maxYears    = 5
  export let color       = null
  export let emptyText   = 'No data yet'
  export let labelL      = null
  export let labelR      = null

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])) }

  $: entries = Object.values(dataByMonth)
  $: totalEntries = entries.reduce((s, v) => s + v, 0)
  $: maxCount = Math.max(minDots, ...entries, 0)

  $: now = new Date()
  $: curYear = now.getFullYear()
  $: startYear = curYear - maxYears + 1

  $: years = Array.from({ length: maxYears }, (_, i) => startYear + i)

  $: leftLabel  = labelL != null ? labelL : (totalEntries > 0 ? `${totalEntries} entries` : '–')
  $: rightLabel = labelR != null ? labelR : '–'

  function monthLabel(y, m) {
    return new Date(y, m - 1, 1).toLocaleDateString('de-CH', { month: 'short' })
  }

  function monthCount(y, m) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    return dataByMonth[key] || 0
  }
</script>

{#if !totalEntries}
  <div class="income-waffle-section">
    <div class="waffle-labels" style="margin-bottom:2px">
      <span>{leftLabel}</span>
      <span>{rightLabel}</span>
    </div>
    <div class="waffle">
      <div style="padding:20px;color:var(--muted-fg);font-size:13px">{emptyText}</div>
    </div>
  </div>
{:else}
  <div class="income-waffle-section">
    <div class="waffle-labels" style="margin-bottom:2px">
      <span>{leftLabel}</span>
      <span>{rightLabel}</span>
    </div>
    <div class="waffle">
      {#each years as y, yi}
        {#if yi > 0}
          <div class="waffle-year-gap">
            <span class="waffle-year-label">{y}</span>
          </div>
        {/if}
        {#each Array(12) as _, mi}
          {@const m = mi + 1}
          {@const count = monthCount(y, m)}
          {@const label = monthLabel(y, m)}
          <div class="waffle-col" title="{count} — {label} {y}">
            {#each Array(maxCount) as _, di}
              {#if di < count}
                <div
                  class="waffle-dot on"
                  style={color ? `background:${color};box-shadow:0 0 6px ${color}80,0 0 12px ${color}33` : ''}
                ></div>
              {:else}
                <div class="waffle-dot dim"></div>
              {/if}
            {/each}
            {#if m === 1 || m === 7}
              <span class="waffle-month-label">{label}</span>
            {/if}
          </div>
        {/each}
      {/each}
    </div>
  </div>
{/if}
