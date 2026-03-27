import { writable } from 'svelte/store';

export const modal = writable(null);
// null = closed
// { type: 'transaction', data: tx | null } = add/edit transaction
// { type: 'account', data: acc | null } = add/edit account
// { type: 'import' } = import CSV
// { type: 'categories' } = manage categories
// { type: 'confirm', title, message, confirmLabel, onConfirm } = confirm dialog

export function openModal(config) { modal.set(config); }
export function closeModal() { modal.set(null); }
