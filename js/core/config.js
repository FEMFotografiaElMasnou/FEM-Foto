// ═══════════════════════════════════
// CONFIGURATION — ENVIRONMENTS (Supabase + Cloudinary)
// ═══════════════════════════════════
// NOTA DE SEGURETAT: les claus "anon" de Supabase estan dissenyades per ser
// exposades al client — la seguretat real recau en les Row Level Security (RLS)
// policies de Supabase, NO en amagar la clau.
// ─────────────────────────────────────────────────────────────────────────────
import { state } from './state.js';
import { showToast } from '../ui/toast.js';
import { enterWithExistingAuthSession, _resetToLoginScreen, _listenAuthChanges, signOutSilently } from '../screens/login.js';
import { loadAllData, loadAppTexts } from './data.js';
import { t, applyTranslations } from './i18n.js';

export const SUPABASE_CONFIGS = {
  normal: {
    url: 'https://ogqqcgbgcqowvywaolln.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncXFjZ2JnY3Fvd3Z5d2FvbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTYzNTIsImV4cCI6MjA4OTA3MjM1Mn0.f4JGoy2BQmir9veKMp_Fk1GqjMGGbMr4YMUK1iH9wfM',
  },
  test: {
    url: 'https://xxydxdsiunfwzkcffdai.supabase.co',   // ← substitueix per la URL del projecte test
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eWR4ZHNpdW5md3prY2ZmZGFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDQ5MDYsImV4cCI6MjA5NDMyMDkwNn0.OmI1ShqJe4v1__JpaCzh2nGcwqtNWns5TC45el6sFsw',   // ← substitueix per la anon key del projecte test
  },
};

// Pas 4c: els enllaços que s'envien per correu (recuperar contrasenya, enllaç
// màgic) tornen a l'app amb `?db=normal|test`. El testimoni que porten només el
// pot validar el client del MATEIX projecte que l'ha emès, i el mode actiu viu a
// localStorage: sense això, demanar un enllaç des del mode Test i obrir-lo amb
// l'app en mode Normal (o al revés) donaria un error incomprensible. Ha
// d'executar-se abans de crear el client, per això és aquí dalt.
function _modeFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search).get('db');
    if (p === 'test' || p === 'normal') return p;
  } catch (_) {}
  return null;
}
const _urlDbMode = _modeFromUrl();
if (_urlDbMode) localStorage.setItem('femvotacions_dbmode', _urlDbMode);

// Estat del mode actiu — persisteix en localStorage (per no perdre-ho en recàrrega)
export let _dbMode = localStorage.getItem('femvotacions_dbmode') === 'test' ? 'test' : 'normal';

// Client Supabase actiu — es pot reassignar amb switchDbMode()
export let sb = null;

function _createSupabaseClient(mode) {
  const cfg = SUPABASE_CONFIGS[mode];
  if (!window.supabase || !window.supabase.createClient) return null;
  return window.supabase.createClient(cfg.url, cfg.key);
}

// Exportada perquè la pantalla de Textos pugui obrir un client puntual cap a
// l'entorn NO actiu (botó "Replica a les dues bases") sense tocar la sessió
// activa ni l'estat de l'app — és només un client JS nou, cap query pròpia.
export function getClientForMode(mode) {
  return _createSupabaseClient(mode);
}

sb = _createSupabaseClient(_dbMode);

if (!sb) {
  console.error('Supabase client failed to initialize. Check CDN script.');
  document.addEventListener('DOMContentLoaded', () => {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#ff6b6b;font-family:sans-serif;"><h2>❌ Error: Supabase no s\'ha carregat</h2><p>Comprova la connexió a internet i recarrega.</p></div>';
  });
}

// ── MODE SWITCH (Normal ↔ Test) ──────────────────────────────────────────────
// Canvia la base de dades activa, reinicia l'estat i torna al login.
// Impacte Supabase: 0 queries addicionals (només crea un nou client JS).
export async function switchDbMode(newMode) {
  if (newMode === _dbMode) return;
  if (newMode !== 'normal' && newMode !== 'test') return;

  // Guardem l'email actual ABANS de reiniciar l'estat (per a l'auto-login a Test)
  const prevEmail = (state.currentUser && state.currentUser.email) ? state.currentUser.email : null;

  _dbMode = newMode;
  localStorage.setItem('femvotacions_dbmode', _dbMode);

  // Recrea el client apuntant a la nova BD
  sb = _createSupabaseClient(_dbMode);

  // Pas 4b: cada projecte té la seva pròpia sessió d'Auth a localStorage, i no
  // es trepitgen. Regla aplicada: **entrar a NORMAL (producció) sempre demana
  // login** — es tanca qualsevol sessió que hi hagués, com fins ara — mentre
  // que la sessió de TEST es conserva, perquè canviar d'entorn segueixi sent
  // àgil un cop s'hi ha entrat una primera vegada.
  if (newMode === 'normal') {
    await signOutSilently();
  }
  // El listener de canvis de sessió estava enganxat al client anterior.
  _listenAuthChanges();

  // Torna a carregar els textos des de l'entorn nou (Normal i Test poden tenir
  // valors diferents a app_texts si s'han editat per separat) i repinta.
  try { await loadAppTexts(); applyTranslations(); } catch (_) {}

  // Reinicia estat en memòria (evita barrejar dades de les dues BD)
  state.users             = [];
  state.objectives        = [];
  state.photos            = [];
  state.votes             = [];
  state.settings          = { uploads_enabled: false, voting_enabled: false, namesRevealed: false, rankingHidden: false, force_hide_upload: false, force_hide_vote: false, force_hide_resultats: false, force_hide_classificacio: false };
  state.generalRanking    = {};
  state.currentObjective  = null;
  state.currentUser       = null;
  state.adminViewingAsParticipant = false;

  // Actualitza el botó i el segell visualment
  _updateDbModeButton();

  // ACCÉS DIRECTE només en anar a TEST (entorn de proves), i només si en aquest
  // navegador JA hi ha una sessió d'Auth vàlida per al projecte de proves amb
  // el mateix email. Tornar a NORMAL (producció) sempre demana login.
  //
  // Pas 4b: abans s'entrava a Test només comprovant que l'email existís a la
  // seva taula d'usuaris, sense contrasenya. Això no pot generar cap sessió
  // real d'Auth, i des del Pas 3b/3c deixava el mode Test sense poder escriure
  // res (votar, gestionar socis...). Ara, la primera vegada cal fer login a
  // Test; com que la sessió és persistent, a partir d'aleshores el canvi torna
  // a ser immediat.
  if (newMode === 'test' && prevEmail) {
    try {
      await loadAllData();
      if (await enterWithExistingAuthSession(prevEmail)) {
        showToast(t('db_mode_changed').replace('{mode}', '🔴 ' + t('db_mode_test')), 'error');
        return;
      }
    } catch (e) {
      console.error('Accés directe a Test no possible, es demana login:', e);
    }
  }

  // Sense sessió vàlida al projecte nou (o tornada a Normal) → pantalla d'accés.
  // No es fa logout() perquè la sessió del projecte que deixàvem ja s'ha tancat
  // més amunt, i la del projecte nou (si n'hi ha) no s'ha de tocar.
  _resetToLoginScreen();

  const modeLabel = _dbMode === 'test' ? ('🔴 ' + t('db_mode_test')) : ('🟢 ' + t('db_mode_normal'));
  showToast(t('db_mode_changed').replace('{mode}', modeLabel), _dbMode === 'test' ? 'error' : 'success');
}

// Mostra/amaga el segell "TEST" (indicador global, independent de la pantalla)
export function _updateTestStamp() {
  const stamp = document.getElementById('test-stamp');
  if (!stamp) return;
  stamp.textContent = t('test_stamp_label');
  stamp.style.display = _dbMode === 'test' ? 'flex' : 'none';
}

export function _updateDbModeButton() {
  _updateTestStamp();
  // Actualiza todos los botones Normal/Test (cabecera + card del panel de control)
  const btns = document.querySelectorAll('.db-mode-btn');
  btns.forEach(btn => {
    if (_dbMode === 'test') {
      btn.textContent       = t('db_mode_test');
      btn.style.background   = 'rgba(255,59,48,0.15)';
      btn.style.borderColor  = 'rgba(255,59,48,0.5)';
      btn.style.color        = '#ff3b30';
    } else {
      btn.textContent       = t('db_mode_normal');
      btn.style.background   = 'rgba(52,199,89,0.15)';
      btn.style.borderColor  = 'rgba(52,199,89,0.5)';
      btn.style.color        = '#34c759';
    }
  });
}

export const CLOUDINARY_CLOUD  = 'dz1n0g9yg';
export const CLOUDINARY_PRESET = 'Fem_Apps';
export const CLOUDINARY_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

window.switchDbMode = switchDbMode;
// Exposats via window perquè applyTranslations() (i18n.js) els pugui refrescar
// en canviar d'idioma sense crear un import circular config.js ↔ i18n.js.
window._updateDbModeButton = _updateDbModeButton;
window._updateTestStamp    = _updateTestStamp;
