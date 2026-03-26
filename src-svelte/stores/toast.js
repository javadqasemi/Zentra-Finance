import { writable } from 'svelte/store'

export const toastMsg     = writable('')
export const toastType    = writable('success')
export const toastVisible = writable(false)

let _timer = null

export function showToast(msg, type = 'success') {
  toastMsg.set(msg)
  toastType.set(type)
  toastVisible.set(true)
  clearTimeout(_timer)
  _timer = setTimeout(() => toastVisible.set(false), 3000)
}
