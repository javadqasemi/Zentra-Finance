<script>
  /**
   * Profile.svelte — User profile page.
   * Mirrors the profile section from src/index.html.
   */
  import { profile } from '../stores/app.js'
  import { showToast } from '../stores/toast.js'
  import { initials } from '../lib/format.js'
  import { afterUpdate, onMount } from 'svelte'

  let firstName = ''
  let lastName  = ''
  let email     = ''

  // Sync local form state from store
  $: {
    firstName = $profile.firstName || ''
    lastName  = $profile.lastName  || ''
    email     = $profile.email     || ''
  }

  $: avatarInitials = initials(firstName, lastName)

  async function save() {
    try {
      await window.api.saveProfile({ firstName, lastName, email })
      profile.set({ firstName, lastName, email })
      showToast('Profile saved', 'success')
    } catch (e) {
      showToast('Save failed', 'error')
    }
  }

  async function clearAll() {
    if (!confirm('This will permanently delete ALL transactions and accounts. Are you sure?')) return
    try {
      await window.api.clearAllData()
      window.location.reload()
    } catch (e) {
      showToast('Clear failed', 'error')
    }
  }

  afterUpdate(() => { if (typeof lucide !== 'undefined') lucide.createIcons() })
  onMount(()     => { if (typeof lucide !== 'undefined') lucide.createIcons() })
</script>

<div id="profile-page" class="page active fade-up">
  <div class="profile-wrap">

    <!-- Avatar -->
    <div class="profile-avatar-large">{avatarInitials}</div>

    <div class="card glass" style="margin-bottom:16px">
      <div class="card-header">
        <div>
          <div class="card-title">Personal Information</div>
        </div>
      </div>

      <div class="form-row" style="margin-bottom:16px">
        <div class="form-group">
          <label class="form-label">First Name</label>
          <input class="form-input" type="text" bind:value={firstName} placeholder="First name" />
        </div>
        <div class="form-group">
          <label class="form-label">Last Name</label>
          <input class="form-input" type="text" bind:value={lastName} placeholder="Last name" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" type="email" bind:value={email} placeholder="your@email.com" />
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-primary" on:click={save}>
          <i data-lucide="save"></i>
          Save Profile
        </button>
      </div>
    </div>

    <!-- Danger zone -->
    <div class="card glass" style="border-color:rgba(239,68,68,0.2)">
      <div class="card-header">
        <div class="card-title" style="color:var(--red)">Danger Zone</div>
      </div>
      <p style="font-size:13.5px;color:var(--muted-fg);margin-bottom:14px">
        Permanently delete all transactions and accounts. This cannot be undone.
      </p>
      <button class="btn btn-danger" on:click={clearAll}>
        <i data-lucide="trash-2"></i>
        Clear All Data
      </button>
    </div>

  </div>
</div>
