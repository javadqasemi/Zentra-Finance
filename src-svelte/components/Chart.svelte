<script>
  /**
   * Chart.svelte — Generic Chart.js wrapper.
   * Re-creates the chart whenever `config` (or `data`) changes.
   */
  import { onMount, onDestroy, afterUpdate } from 'svelte'

  export let config = null    // full Chart.js config object

  let canvas
  let chart = null
  let lastHash = ''

  function build() {
    if (!canvas || typeof Chart === 'undefined' || !config) return
    const hash = JSON.stringify(config.data || {})
    if (hash === lastHash && chart) return
    lastHash = hash
    if (chart) { chart.destroy(); chart = null }
    chart = new Chart(canvas, config)
  }

  // Reactive: rebuild only when `config` reference changes.
  // (afterUpdate fires on every parent state change which causes thrashing.)
  $: if (config) build()

  onMount(build)
  onDestroy(() => { if (chart) chart.destroy() })

  export function getCanvas() { return canvas }
  export function toDataUrl() { return canvas && canvas.toDataURL ? canvas.toDataURL('image/png') : null }
</script>

<canvas bind:this={canvas}></canvas>
