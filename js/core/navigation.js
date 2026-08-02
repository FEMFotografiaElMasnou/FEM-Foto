// ═══════════════════════════════════
// NAVEGACIÓ — ruta a l'URL (fragment) perquè Actualitzar i Enrere/Endavant
// del navegador es comportin com a la resta del web (Fase 5, 02/08/2026)
// ═══════════════════════════════════
// L'app no havia fet servir mai la History API: els canvis de pantalla eren
// classList.add/remove('hidden') purs, sense cap rastre a l'URL. Efecte:
//  · Refrescar sempre tornava a la pantalla per defecte del rol (init() no
//    sabia on era l'usuari).
//  · Enrere no tenia cap esglaó intern on tornar i treia l'usuari de l'app.
// Aquest mòdul hi afegeix un fragment (#admin, #participant/voting...) que
// reflecteix el panell actual, sense servidor ni build step.
import { state, actingAsAdmin } from './state.js';

const ROUTES = new Map(); // route -> { route, role: 'admin'|'participant', restoreFn }
const ROLE_HOME = { admin: 'admin', participant: 'participant' };
// Preparació prèvia d'una pantalla (capçalera, insígnia de rol...) que cal
// fer un sol cop abans d'entrar-hi per un panell concret en restaurar en
// fred (vegeu restoreRouteOrDefault) — només participant en necessita: la
// d'admin ja l'inclou dins la seva pròpia restoreFn.
const ROLE_CHROME = new Map();

export function registerRoute(route, role, restoreFn) {
  ROUTES.set(route, { route, role, restoreFn });
}

export function registerRoleChrome(role, chromeFn) {
  ROLE_CHROME.set(role, chromeFn);
}

// Rol "efectiu": el mateix criteri que actingAsAdmin() fa servir per triar
// què repintar (vegeu router.js _refreshUI) — un admin "veient com a
// participant" ha de poder restaurar rutes de participant, no les seves.
function _effectiveRole() {
  if (!state.currentUser) return null;
  return actingAsAdmin() ? 'admin' : 'participant';
}

// Cridat des de cada show*() en navegar-hi de debò (no en repintats interns
// del polling). Sense canvi real de fragment no fa res: evita omplir
// l'historial d'entrades repetides quan el mateix panell es repinta sol
// (p. ex. l'auto-refresh de router.js torna a cridar showParticipantMain()).
export function recordRoute(route) {
  const hash = '#' + route;
  if (location.hash === hash) return;
  history.pushState({ route }, '', hash);
}

// Arrencada — decideix la pantalla inicial. Si el fragment de l'URL
// correspon a una ruta vàlida per al rol efectiu d'aquest usuari, hi torna;
// si no (fragment d'un altre rol, d'un enllaç de correu, o buit), crida
// defaultFn() — el mateix "anar a l'inici del rol" que hi havia fins ara.
export function restoreRouteOrDefault(defaultFn) {
  const route = (location.hash || '').replace(/^#/, '');
  const entry = route && ROUTES.get(route);
  if (!entry) { defaultFn(); return; }

  // El flag adminViewingAsParticipant NOMÉS viu en memòria (mai s'ha
  // persistit): en refrescar sempre torna a false. Sense això, un admin que
  // refresqués mentre "veia com a participant" cauria sempre al seu panell
  // d'admin, encara que el fragment digui on era de debò. Es reconstrueix a
  // partir de la ruta: si la ruta és de participant i qui hi entra és un
  // admin real, és que hi era per aquest camí.
  if (entry.role === 'participant' && state.currentUser && state.currentUser.role === 'admin') {
    state.adminViewingAsParticipant = true;
  }

  if (entry.role !== _effectiveRole()) { defaultFn(); return; }

  // Els panells de participant (a diferència de showAdminScreen) no inclouen
  // la capçalera/insígnia — cal preparar-la abans d'entrar directament a un
  // panell concret (vegeu registerRoleChrome a router.js).
  const chrome = ROLE_CHROME.get(entry.role);
  if (chrome) chrome();
  entry.restoreFn();
}

// Enrere/Endavant del navegador: repinta el panell corresponent en lloc de
// deixar que el navegador surti de l'app. Si el fragment no és vàlid per al
// rol efectiu actual (p. ex. un admin ha deixat de "veure com a participant"
// pel mig), es corregeix el fragment (replaceState, sense afegir cap pas nou
// a l'historial) i es va a la pantalla principal del rol efectiu.
export function initRoutingListener() {
  window.addEventListener('popstate', () => {
    if (!state.currentUser) return; // pantalla d'accés: res a fer
    const route = (location.hash || '').replace(/^#/, '');
    const entry = route && ROUTES.get(route);
    const role  = _effectiveRole();
    if (entry && entry.role === role) {
      entry.restoreFn();
      return;
    }
    const fallback = ROUTES.get(ROLE_HOME[role]);
    if (!fallback) return;
    history.replaceState({ route: fallback.route }, '', '#' + fallback.route);
    fallback.restoreFn();
  });
}

// Neteja el fragment en tornar a la pantalla d'accés (logout / sessió
// caducada), perquè no hi quedi penjada una ruta d'una sessió ja tancada.
export function clearRoute() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
