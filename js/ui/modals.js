// ═══════════════════════════════════
// MODALS
// ═══════════════════════════════════
export function openModal(id)  { document.getElementById(id).classList.add('open'); }
export function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// okLabel opcional: si no es passa, es manté "Confirmar" (bug corregit
// 2026-07-26 — abans el botó es quedava amb el text de l'última crida que
// l'havia tocat directament, p.ex. "Canviar" de toggleDbMode/router.js,
// perquè aquesta funció mai en netejava el text).
export function confirmAction(title, msg, callback, okLabel) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  document.getElementById('confirm-ok-btn').textContent = okLabel || 'Confirmar';
  document.getElementById('confirm-ok-btn').onclick    = () => { closeModal('modal-confirm'); callback(); };
  openModal('modal-confirm');
}

// Exponer en window (closeModal aparece en onclick del HTML)
window.openModal = openModal;
window.closeModal = closeModal;
window.confirmAction = confirmAction;
