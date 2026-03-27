<script>
  import { modal, closeModal } from '../stores/modals.js'
  import { onMount, onDestroy } from 'svelte'

  $: cfg = $modal?.type === 'confirm' ? $modal : null

  function handleKeydown(e) {
    if (e.key === 'Escape' && cfg) closeModal()
  }

  async function confirm() {
    const cb = cfg?.onConfirm
    closeModal()
    if (cb) await cb()
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if cfg}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="overlay show" on:click={closeModal}>
    <div class="modal confirm-modal" on:click|stopPropagation>
      <div class="confirm-icon-ring">
        <i data-lucide="alert-triangle"></i>
      </div>
      <div class="confirm-ttl">{cfg.title}</div>
      <div class="confirm-msg">{cfg.message}</div>
      <div class="confirm-btns">
        <button class="btn btn-secondary" on:click={closeModal}>Cancel</button>
        <button class="btn btn-danger" on:click={confirm}>
          {cfg.confirmLabel || 'Confirm'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(4,4,10,0.6);
    backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
  }
</style>
