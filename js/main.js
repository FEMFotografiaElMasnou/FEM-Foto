// ═══════════════════════════════════
// MAIN — punto de entrada de la app modular
// Importa todos los módulos (cada uno expone sus funciones en window para los
// onclick del HTML), ata los listeners globales y arranca con init().
// ═══════════════════════════════════

// ── Núcleo (orden no crítico: las dependencias se resuelven en tiempo de llamada) ──
import './core/state.js';
import './core/config.js';
import { applyTranslations } from './core/i18n.js';
import './core/data.js';
import './core/router.js';

// ── UI ──
import './ui/toast.js';
import './ui/modals.js';
import './ui/lightbox.js';

// ── Features ──
import './features/ranking.js';
import './features/votacio.js';
import './features/fotos.js';
import './features/socis.js';
import './features/tematiques.js';
import './features/textos.js';

// ── Screens ──
import { init, handleLogin } from './screens/login.js';
import './screens/admin.js';
import './screens/participant.js';

import { _dbMode, _updateTestStamp } from './core/config.js';

// ═══════════════════════════════════
// EVENTS
// ═══════════════════════════════════
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
});
document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
document.getElementById('login-user').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

// ═══════════════════════════════════
// BOOT — all functions are defined above this point
// ═══════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations(); // Apply lang to static elements immediately
  // Show TEST banner on login if mode was persisted
  const testBanner = document.getElementById('login-test-banner');
  if (testBanner && _dbMode === 'test') testBanner.style.display = 'block';
  _updateTestStamp();  // Segell TEST global (visible només en mode test)
  init();              // Then load data
});
