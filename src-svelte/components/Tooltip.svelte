<script>
  /**
   * Tooltip.svelte — Global hover tooltip.
   * Listens for mouseover on elements with `data-tip-lbl` (and optional `data-tip-val`).
   * Mirrors initTooltips() from src/index.html, with AbortController-based cleanup.
   */
  import { onMount, onDestroy } from 'svelte'

  let tipEl
  let visible = false
  let lbl = ''
  let val = ''
  let abort

  function move(e) {
    if (!tipEl) return
    const x = e.clientX + 14
    const y = e.clientY + 14
    tipEl.style.left = x + 'px'
    tipEl.style.top  = y + 'px'
  }
  function over(e) {
    const target = e.target.closest('[data-tip-lbl]')
    if (!target) return
    lbl = target.getAttribute('data-tip-lbl') || ''
    val = target.getAttribute('data-tip-val') || ''
    visible = true
    move(e)
  }
  function out(e) {
    const target = e.target.closest('[data-tip-lbl]')
    if (!target) return
    visible = false
  }

  onMount(() => {
    abort = new AbortController()
    const sig = { signal: abort.signal }
    document.addEventListener('mouseover', over, sig)
    document.addEventListener('mouseout',  out,  sig)
    document.addEventListener('mousemove', move, sig)
  })
  onDestroy(() => { if (abort) abort.abort() })
</script>

<div class="tip" bind:this={tipEl} class:show={visible}>
  <div class="tip-lbl">{lbl}</div>
  {#if val}<div class="tip-val">{val}</div>{/if}
</div>

<style>
  .tip {
    position: fixed; pointer-events: none; z-index: 9999;
    padding: 6px 10px; font-size: 11.5px;
    background: rgba(7,7,14,0.92); color: #fff;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    opacity: 0; transition: opacity 0.12s;
    backdrop-filter: blur(8px);
  }
  .tip.show { opacity: 1; }
  .tip-lbl  { font-weight: 600; }
  .tip-val  { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 2px; }
</style>
