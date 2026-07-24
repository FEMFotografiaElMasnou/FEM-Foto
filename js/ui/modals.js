// ═══════════════════════════════════
// MODALS
// ═══════════════════════════════════
export function openModal(id)  { document.getElementById(id).classList.add('open'); }
export function closeModal(id) { document.getElementById(id).classList.remove('open'); }

export function confirmAction(title, msg, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  document.getElementById('confirm-ok-btn').onclick    = () => { closeModal('modal-confirm'); callback(); };
  openModal('modal-confirm');
}

// Exponer en window (closeModal aparece en onclick del HTML)
window.openModal = openModal;
window.closeModal = closeModal;
window.confirmAction = confirmAction;
