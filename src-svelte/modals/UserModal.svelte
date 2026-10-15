<script>
  /**
   * UserModal.svelte — Add/edit a user (admin only).
   */
  import { createEventDispatcher, afterUpdate } from 'svelte'
  import { refreshIcons } from '../lib/format.js'
  import { showToast } from '../stores/toast.js'

  export let open = false
  export let user = null

  const dispatch = createEventDispatcher()

  let editId = null
  let firstName = '', lastName = '', email = '', role = 'editor'

  $: if (open) initFromUser(user)

  function initFromUser(u) {
    if (u) {
      editId = u.id
      firstName = u.firstName || ''
      lastName  = u.lastName  || ''
      email     = u.email     || ''
      role      = u.role      || 'editor'
    } else {
      editId = null; firstName = ''; lastName = ''; email = ''; role = 'editor'
    }
  }

  function close() { open = false; dispatch('close') }

  async function save() {
    if (!firstName.trim() && !lastName.trim()) {
      showToast('Name required', 'error'); return
    }
    const payload = {
      ...(editId ? { id: editId } : {}),
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.trim(),
      role,
    }
    try {
      await window.api.saveUser(payload)
      showToast(editId ? 'User updated' : 'User added', 'success')
      dispatch('saved')
      close()
    } catch (err) {
      showToast('Save failed', 'error')
      console.error(err)
    }
  }

  afterUpdate(() => { refreshIcons() })
</script>

{#if open}
<div class="overlay show" on:click={close} role="presentation">
  <div class="modal" on:click|stopPropagation role="dialog" style="max-width:400px">
    <div class="modal-head">
      <span class="modal-title">{editId ? 'Edit User' : 'Add User'}</span>
      <button class="modal-close" on:click={close}><i data-lucide="x"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">First Name</label>
        <input type="text" class="form-input" bind:value={firstName} placeholder="First name" />
      </div>
      <div class="form-group">
        <label class="form-label">Last Name</label>
        <input type="text" class="form-input" bind:value={lastName} placeholder="Last name" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" bind:value={email} placeholder="Email" />
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-input" bind:value={role}>
          <option value="admin">Admin — Full access + user management</option>
          <option value="editor">Editor — Add/edit data, no user management</option>
          <option value="viewer">Viewer — Read-only access</option>
        </select>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" on:click={close}>Cancel</button>
      <button class="btn btn-primary" on:click={save}>Save User</button>
    </div>
  </div>
</div>
{/if}
