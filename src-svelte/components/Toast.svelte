<script>
  // Simple toast store/component.
  // Usage: import { showToast } from '../stores/toast.js'; showToast('msg', 'success')
  import { toastMsg, toastType, toastVisible } from '../stores/toast.js'
  import { onDestroy } from 'svelte'

  // Re-init lucide icons whenever toast shows, so the icon renders
  $: if ($toastVisible && typeof lucide !== 'undefined') {
    requestAnimationFrame(() => lucide.createIcons())
  }
</script>

<div
  class="toast {$toastType}"
  class:show={$toastVisible}
  aria-live="polite"
>
  <i
    id="toast-icon"
    data-lucide={$toastType === 'success' ? 'check-circle' : 'alert-circle'}
  ></i>
  <span>{$toastMsg}</span>
</div>
