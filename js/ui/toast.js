// ═══════════════════════════════════
// GLOBAL LOADER + TOAST
// ═══════════════════════════════════
import { t } from '../core/i18n.js';

let _loaderSafetyTimer = null;

export function showLoader(text) {
  const el = document.getElementById('global-loader');
  const tx = document.getElementById('global-loader-text');
  if (tx) tx.textContent = text || t('loading');
  if (el) el.style.display = 'flex';
  // Safety: always hide after 30s to avoid permanent block
  clearTimeout(_loaderSafetyTimer);
  _loaderSafetyTimer = setTimeout(() => {
    hideLoader();
    console.warn('Loader hidden by safety timeout');
  }, 30000);
}

export function hideLoader() {
  clearTimeout(_loaderSafetyTimer);
  const el = document.getElementById('global-loader');
  if (el) el.style.display = 'none';
}

let toastTimer;
export function showToast(msg, type = 'info') {
  const toast     = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// Exponer en window (uso global heredado / debug)
window.showLoader = showLoader;
window.hideLoader = hideLoader;
window.showToast = showToast;
