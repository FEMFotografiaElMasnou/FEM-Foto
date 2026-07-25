// ═══════════════════════════════════
// PANTALLA PARTICIPANT — paneles, dashboard, visibilidad de botones y mosaico
// ═══════════════════════════════════
import { state, actingAsAdmin } from '../core/state.js';
import { t, applyTranslations } from '../core/i18n.js';
import { showToast } from '../ui/toast.js';
import { renderVotingGrid, updateVoteButtonsState, isVotingSubmitted } from '../features/votacio.js';
import { renderRanking, renderResultatsRepte, objectiveHasExpertVoting, renderClassificacioGeneral, renderValoracioRepte, renderTaulaClassificacio } from '../features/ranking.js';
import { updateUploadSection, _formatDateEs, _formatDateSlash } from '../features/fotos.js';
import { setActiveNav, switchTab } from '../core/router.js';
import { populateGalleryFilters, renderGallery, startGalleryCarousel, stopGalleryCarousel } from '../features/galeria.js';
import { getActiveCalendar } from '../features/calendari.js';
import { getVotingProgress } from '../core/data.js';

// ═══════════════════════════════════
// PANELES
// ═══════════════════════════════════
// Amaga tots els panells del participant (helper per no oblidar-ne cap)
function _hideAllParticipantPanels() {
  document.getElementById('participant-panel-main').classList.add('hidden');
  document.getElementById('participant-panel-voting').classList.add('hidden');
  document.getElementById('participant-panel-ranking').classList.add('hidden');
  document.getElementById('participant-panel-gallery').classList.add('hidden');
  document.getElementById('participant-panel-resultats').classList.add('hidden');
  document.getElementById('participant-panel-classificacio').classList.add('hidden');
  document.getElementById('participant-panel-valoracio-repte').classList.add('hidden');
  document.getElementById('participant-panel-taula-classificacio').classList.add('hidden');
  // Aturar el carrusel de la card galeria (només viu al panell principal)
  stopGalleryCarousel();
}

export function showParticipantMain() {
  _hideAllParticipantPanels();
  document.getElementById('participant-panel-main').classList.remove('hidden');
  setActiveNav('bnav-home');
  refreshParticipantDashboard();
}

export function showParticipantVoting() {
  // Allow viewing published photos even if voting is not open yet
  if (state.publishedPhotos.length === 0) {
    showToast(t('no_photos_published_toast'), 'info');
    return;
  }
  _hideAllParticipantPanels();
  document.getElementById('participant-panel-voting').classList.remove('hidden');
  setActiveNav('bnav-vote');
  renderVotingHeader();
  renderVotingGrid('participant-voting-grid');
  // Assegura que el botó del peu reflecteix sempre l'estat real (bloquejat
  // i "Vots Enviats" si ja s'ha enviat) cada cop que s'entra a la pantalla,
  // no només després d'un refresc complet del dashboard.
  updateVoteButtonsState();
}

// Capçalera dinàmica de la pantalla de votació (v0.1.30, revisat v0.1.31):
// repte concret + una sola línia d'estat amb el recompte global de vots
// rebuts fos amb la data límit / si ja s'ha enviat (abans en 2 línies
// separades — decisió Pablo: es fonien massa entre el títol i la instrucció).
// Vegeu FEM_reptes.md (proposta discutida amb Pablo) per al disseny.
// Exportada + a window: applyTranslations() (i18n.js) la crida via
// window._refreshVotingGrids (votacio.js) en canviar d'idioma, perquè el
// text (generat amb t()) es repinti igual que la resta de contingut dinàmic.
export function renderVotingHeader() {
  const titleEl  = document.getElementById('voting-screen-title');
  const statusEl = document.getElementById('voting-status-line');
  if (!titleEl) return;

  const obj = state.currentObjective;
  titleEl.textContent = obj ? t('voting_repte_title').replace('{title}', obj.title) : t('voting_screen_title');

  if (statusEl) {
    const uid = state.currentUser ? state.currentUser.id : null;
    const objId = obj ? obj.id : null;
    const submitted = (uid && objId) ? isVotingSubmitted(uid, objId) : false;
    const votesReceived = getVotingProgress().voted;
    statusEl.classList.toggle('is-submitted', submitted);
    if (submitted) {
      statusEl.textContent = t('voting_status_done').replace('{n}', votesReceived);
    } else {
      const cal = getActiveCalendar();
      const endDate = cal ? _formatDateEs(cal.votingEnd) : '';
      statusEl.textContent = endDate
        ? t('voting_status_pending_date').replace('{n}', votesReceived).replace('{date}', endDate)
        : t('voting_status_pending_nodate').replace('{n}', votesReceived);
    }
  }
}

export function showParticipantRanking() {
  _hideAllParticipantPanels();
  document.getElementById('participant-panel-ranking').classList.remove('hidden');
  setActiveNav('bnav-rank');
  renderRanking('p-ranking-current-list', 'p-ranking-general-list');
}

export function showParticipantGallery() {
  _hideAllParticipantPanels();
  document.getElementById('participant-panel-gallery').classList.remove('hidden');
  populateGalleryFilters();
  renderGallery();
}

// ── NAVEGACIÓ — Resultat Repte (natiu, amb desplegable de reptes finalitzats) ──
// Data d'un repte per ordenar cronològicament (tancament > inici)
function _objDate(o) {
  return o.end_date || o.start_date || '';
}
// Reptes que es mostren al desplegable de "Resultat Repte".
// Diferenciat per TIPUS DE COMPTE (rol real):
//   · admin       → TOTS els reptes (inclòs l'actiu i els inactius)
//   · participant → només els finalitzats
function _resultatsObjectives() {
  const isAdmin = !!(state.currentUser && state.currentUser.role === 'admin');
  return state.objectives
    .filter(o => isAdmin || o.status === 'finished')
    .slice()
    .sort((a, b) => String(_objDate(b)).localeCompare(String(_objDate(a))));  // recent → antic
}

// Mostra/amaga el bloc de filtre Tots/Socis/Expert segons si el repte triat
// té algun vot d'expert — si no en té, els tres modes donarien el mateix
// resultat, així que directament no té sentit mostrar cap filtre.
function _updateResultatsVoteFilter(objId) {
  const voteGroup = document.getElementById('resultats-vote-filter-group');
  if (voteGroup) voteGroup.classList.toggle('hidden', !objectiveHasExpertVoting(objId));
}

// Scope efectiu pel rànquing principal: si el repte no té vot d'expert, el
// desplegable queda amagat i sempre es calcula amb 'all' (equivalent a
// "vots dels socis" quan no hi ha experts entre els votants).
function _resultatsScope(objId) {
  if (!objectiveHasExpertVoting(objId)) return 'all';
  const sel = document.getElementById('resultats-vote-filter');
  return sel ? sel.value : 'all';
}

export function showParticipantResultats() {
  _hideAllParticipantPanels();
  document.getElementById('participant-panel-resultats').classList.remove('hidden');
  setActiveNav('bnav-rank');

  const sel   = document.getElementById('resultats-repte-select');
  const empty = document.getElementById('resultats-empty');
  const list  = document.getElementById('resultats-list');
  const objs  = _resultatsObjectives();
  const label = sel ? sel.closest('.gallery-filters') : null;

  if (objs.length === 0) {
    // Cap repte finalitzat encara: amagar desplegables, mostrar avís
    if (label) label.style.display = 'none';
    if (list)  list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (label) label.style.display = '';
  if (empty) empty.classList.add('hidden');
  // Conservar la selecció prèvia si encara existeix; si no, el més recent
  const prev = sel ? sel.value : '';
  sel.innerHTML = objs.map(o => `<option value="${o.id}">${o.title}</option>`).join('');
  sel.value = objs.some(o => o.id === prev) ? prev : objs[0].id;
  _updateResultatsVoteFilter(sel.value);
  renderResultatsRepte(sel.value, 'resultats-list', _resultatsScope(sel.value));
}

export function onResultatsRepteChange() {
  const sel = document.getElementById('resultats-repte-select');
  if (!sel) return;
  _updateResultatsVoteFilter(sel.value);
  renderResultatsRepte(sel.value, 'resultats-list', _resultatsScope(sel.value));
}

export function onResultatsVoteFilterChange() {
  const sel = document.getElementById('resultats-repte-select');
  if (sel) renderResultatsRepte(sel.value, 'resultats-list', _resultatsScope(sel.value));
}

// ── NAVEGACIÓ — Valoració Repte (nom de treball, Fase 3 Pas 2) ──
// Eina només per a l'admin: compara el nou sistema de puntuació (1 sola nota,
// valoracio 0-10) amb l'actual (Resultat Repte, 3 criteris), sense tocar-lo.
// Mateix patró exacte que Resultat Repte, incloent _resultatsObjectives()
// (l'admin ja hi veu reptes actius+tancats) reutilitzada tal qual.
function _updateValoracioVoteFilter(objId) {
  const group = document.getElementById('valoracio-vote-filter-group');
  if (group) group.classList.toggle('hidden', !objectiveHasExpertVoting(objId));
}

function _valoracioScope(objId) {
  if (!objectiveHasExpertVoting(objId)) return 'all';
  const sel = document.getElementById('valoracio-vote-filter');
  return sel ? sel.value : 'all';
}

export function showParticipantValoracioRepte() {
  _hideAllParticipantPanels();
  document.getElementById('participant-panel-valoracio-repte').classList.remove('hidden');
  setActiveNav('bnav-rank');

  const sel   = document.getElementById('valoracio-repte-select');
  const empty = document.getElementById('valoracio-empty');
  const list  = document.getElementById('valoracio-list');
  const objs  = _resultatsObjectives();
  const label = sel ? sel.closest('.gallery-filters') : null;

  if (objs.length === 0) {
    if (label) label.style.display = 'none';
    if (list)  list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (label) label.style.display = '';
  if (empty) empty.classList.add('hidden');
  const prev = sel ? sel.value : '';
  sel.innerHTML = objs.map(o => `<option value="${o.id}">${o.title}</option>`).join('');
  sel.value = objs.some(o => o.id === prev) ? prev : objs[0].id;
  _updateValoracioVoteFilter(sel.value);
  renderValoracioRepte(sel.value, 'valoracio-list', _valoracioScope(sel.value));
}

export function onValoracioRepteChange() {
  const sel = document.getElementById('valoracio-repte-select');
  if (!sel) return;
  _updateValoracioVoteFilter(sel.value);
  renderValoracioRepte(sel.value, 'valoracio-list', _valoracioScope(sel.value));
}

export function onValoracioVoteFilterChange() {
  const sel = document.getElementById('valoracio-repte-select');
  if (sel) renderValoracioRepte(sel.value, 'valoracio-list', _valoracioScope(sel.value));
}

// ── NAVEGACIÓ — Classificació General (natiu, recàlcul en viu, Fase 2.2) ──
// Hi ha algun repte finalitzat amb vot d'expert? Determina si té sentit
// mostrar el filtre Tots/Socis/Expert (mateix criteri que a Resultat Repte,
// però agregat: n'hi ha prou que UN dels reptes finalitzats en tingui).
function _anyFinishedObjectiveHasExpertVoting() {
  return state.objectives.some(o => o.status === 'finished' && objectiveHasExpertVoting(o.id));
}

function _updateClassificacioVoteFilter() {
  const group = document.getElementById('classificacio-vote-filter-group');
  if (group) group.classList.toggle('hidden', !_anyFinishedObjectiveHasExpertVoting());
}

function _classificacioScope() {
  if (!_anyFinishedObjectiveHasExpertVoting()) return 'all';
  const sel = document.getElementById('classificacio-vote-filter');
  return sel ? sel.value : 'all';
}

export function showParticipantClassificacioGeneral() {
  _hideAllParticipantPanels();
  document.getElementById('participant-panel-classificacio').classList.remove('hidden');
  setActiveNav('bnav-rank');
  _updateClassificacioVoteFilter();
  renderClassificacioGeneral('classificacio-list', _classificacioScope());
}

export function onClassificacioVoteFilterChange() {
  renderClassificacioGeneral('classificacio-list', _classificacioScope());
}

// ── NAVEGACIÓ — Taula de Classificació (nom de treball, Fase 3 Pas 3) ──
// Eina només per a l'admin: compara el nou sistema de puntuació (valoracio
// 0-10) amb l'actual (Classificació General, 3 criteris), sense tocar-lo.
// Mateix patró exacte que Classificació General, incloent
// _anyFinishedObjectiveHasExpertVoting() reutilitzada tal qual (el criteri
// per mostrar el filtre no depèn de quin sistema de puntuació es faci servir).
function _updateTaulaClassificacioVoteFilter() {
  const group = document.getElementById('taula-classificacio-vote-filter-group');
  if (group) group.classList.toggle('hidden', !_anyFinishedObjectiveHasExpertVoting());
}

function _taulaClassificacioScope() {
  if (!_anyFinishedObjectiveHasExpertVoting()) return 'all';
  const sel = document.getElementById('taula-classificacio-vote-filter');
  return sel ? sel.value : 'all';
}

export function showParticipantTaulaClassificacio() {
  _hideAllParticipantPanels();
  document.getElementById('participant-panel-taula-classificacio').classList.remove('hidden');
  setActiveNav('bnav-rank');
  _updateTaulaClassificacioVoteFilter();
  renderTaulaClassificacio('taula-classificacio-list', _taulaClassificacioScope());
}

export function onTaulaClassificacioVoteFilterChange() {
  renderTaulaClassificacio('taula-classificacio-list', _taulaClassificacioScope());
}

// ── Classificació General (vista interna antiga; ja no enllaçada, es manté per referència) ──
export function showParticipantClassificacio() {
  showParticipantRanking();
  switchTab('p-rank', 'general');
}

// ═══════════════════════════════════
// PARTICIPANT DASHBOARD
// ═══════════════════════════════════
export function refreshParticipantDashboard() {
  // Set role badge — skip if admin is using the pill as a toggle
  const roleBadge = document.getElementById('participant-role-badge');
  if (roleBadge && state.currentUser && !state.adminViewingAsParticipant) {
    roleBadge.textContent = state.currentUser.role === 'admin'
      ? t('admin_role_name')
      : state.currentUser.role === 'expert'
        ? t('expert_role_name')
        : t('member_role_name');
  }

  const obj = state.currentObjective;
  document.getElementById('participant-objective-name').textContent = obj ? obj.title : '—';
  document.getElementById('participant-objective-desc').textContent = obj
    ? (obj.description || '')
    : t('no_active_objective_short');

  // Imatge de fons de la capçalera del repte (objectives.cover_image_url,
  // pujada per l'admin des del modal de repte — 2026-07-24). Sense imatge,
  // la capçalera queda exactament com abans (fons pla, sense classe extra).
  const headerEl = document.getElementById('objective-header');
  if (headerEl) {
    if (obj && obj.coverImageUrl) {
      headerEl.style.backgroundImage =
        `linear-gradient(180deg, rgba(10,20,50,.30), rgba(10,20,50,.78)), url("${obj.coverImageUrl}")`;
      headerEl.classList.add('objective-header--has-cover');
    } else {
      headerEl.style.backgroundImage = '';
      headerEl.classList.remove('objective-header--has-cover');
    }
  }

  // Rang de dates de pujada/votació del repte (objectives.cal_upload_*/
  // cal_voting_*, via getActiveCalendar()) — es mostren dins la mateixa
  // capçalera perquè el repte informi de les dates sense haver d'obrir cap
  // altra pantalla. Format "dd/mm/aaaa" (_formatDateSlash, fotos.js). Si
  // falta alguna de les dues dates d'un rang, es deixa la línia amagada en
  // lloc de mostrar un rang a mitges.
  const calUploadEl = document.getElementById('participant-objective-cal-upload');
  const calVotingEl = document.getElementById('participant-objective-cal-voting');
  const cal = obj ? getActiveCalendar(obj.id) : null;
  if (calUploadEl) {
    const start = cal ? _formatDateSlash(cal.uploadStart) : '';
    const end   = cal ? _formatDateSlash(cal.uploadEnd)   : '';
    if (start && end) {
      calUploadEl.textContent = t('cal_upload_range_label').replace('{start}', start).replace('{end}', end);
      calUploadEl.classList.remove('hidden');
    } else {
      calUploadEl.textContent = '';
      calUploadEl.classList.add('hidden');
    }
  }
  if (calVotingEl) {
    const start = cal ? _formatDateSlash(cal.votingStart) : '';
    const end   = cal ? _formatDateSlash(cal.votingEnd)   : '';
    if (start && end) {
      calVotingEl.textContent = t('cal_voting_range_label').replace('{start}', start).replace('{end}', end);
      calVotingEl.classList.remove('hidden');
    } else {
      calVotingEl.textContent = '';
      calVotingEl.classList.add('hidden');
    }
  }

  // (La barra PROGRÉS VOTACIONS s'ha mogut al dashboard d'admin, v0.1.21:
  //  els socis ja no la veuen.)

  // Sección de subida: siempre con la lógica normal
  updateUploadSection();

  // Re-apply all data-i18n translations (nav cards, labels, etc.)
  applyTranslations();
  updateVoteButtonsState();
  // Aplicar visibilitat de nav-cards (estat repte + forçats admin)
  applyParticipantButtonVisibility();

  // "Valoració Repte" (Fase 3, Pas 2): eina de comparació només per a comptes
  // amb rol admin. OJO: NO es pot fer servir actingAsAdmin() aquí — l'únic
  // camí pel qual un admin arriba a veure aquesta pantalla de nav-cards és
  // posant-se en mode "veure com a participant" (toggleAdminParticipantView,
  // router.js), i en aquell mode actingAsAdmin() és fals a propòsit (perquè
  // tota la resta es vegi exactament com ho veu un soci). Cal el rol real.
  const valoracioCard = document.getElementById('nav-card-valoracio-repte');
  const taulaClassificacioCard = document.getElementById('nav-card-taula-classificacio');
  const isRealAdmin = !!(state.currentUser && state.currentUser.role === 'admin');
  if (valoracioCard) valoracioCard.classList.toggle('hidden', !isRealAdmin);
  if (taulaClassificacioCard) taulaClassificacioCard.classList.toggle('hidden', !isRealAdmin);

  // Carrusel de la card galeria: només si la card és visible i som al panell principal
  const galCard    = document.getElementById('nav-card-gallery');
  const mainVisible = !document.getElementById('participant-panel-main').classList.contains('hidden');
  const galVisible  = galCard && galCard.style.display !== 'none';
  if (mainVisible && galVisible) startGalleryCarousel();
  else stopGalleryCarousel();
}

// ═══════════════════════════════════════════════════════════════════════════
// VISIBILITAT DE BOTONS PARTICIPANT
// ═══════════════════════════════════════════════════════════════════════════
export function getButtonVisibility() {
  const s = state.settings;
  const hasObjective = !!state.currentObjective;
  // Lògica de l'estat del repte
  const logicShowUpload    = hasObjective && s.uploads_enabled;
  const logicShowVote      = hasObjective && s.voting_enabled;
  const logicShowResultats     = true;   // sempre visible: obre l'App Resultats (Enric), amb desplegable de reptes finalitzats
  const logicShowClassificacio = true;
  // Aplicar forçats d'admin (override → ocultar)
  return {
    showUpload:        logicShowUpload        && !s.force_hide_upload,
    showVote:          logicShowVote          && !s.force_hide_vote,
    showResultats:     logicShowResultats     && !s.force_hide_resultats,
    showClassificacio: logicShowClassificacio && !s.force_hide_classificacio,
  };
}

// Aplicar visibilitat sobre les nav-cards del participant
export function applyParticipantButtonVisibility() {
  if (!state.currentUser || actingAsAdmin()) return;
  const v = getButtonVisibility();
  const setDisplay = (id, show) => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  };
  // Votar ja no és una targeta pròpia: la substitueix el mosaic dins la
  // targeta de Repte/La meva foto (vegeu updateUploadSection a fotos.js).
  setDisplay('nav-card-resultats',     v.showResultats);
  setDisplay('nav-card-classificacio', v.showClassificacio);
  // Galeria: visible si hi ha algun repte finalitzat; l'admin (rol real) també
  // la veu si hi ha repte actual, perquè a la galeria veu el repte en curs.
  const hasFinished = state.objectives.some(o => o.status === 'finished');
  const isAdminRole = !!(state.currentUser && state.currentUser.role === 'admin');
  setDisplay('nav-card-gallery', hasFinished || (isAdminRole && !!state.currentObjective));
}

// Exponer en window las funciones usadas desde onclick del HTML
window.showParticipantMain = showParticipantMain;
window.showParticipantVoting = showParticipantVoting;
window.showParticipantRanking = showParticipantRanking;
window.showParticipantResultats = showParticipantResultats;
window.onResultatsRepteChange = onResultatsRepteChange;
window.onResultatsVoteFilterChange = onResultatsVoteFilterChange;
window.showParticipantClassificacioGeneral = showParticipantClassificacioGeneral;
window.onClassificacioVoteFilterChange = onClassificacioVoteFilterChange;
window.showParticipantValoracioRepte = showParticipantValoracioRepte;
window.onValoracioRepteChange = onValoracioRepteChange;
window.onValoracioVoteFilterChange = onValoracioVoteFilterChange;
window.showParticipantTaulaClassificacio = showParticipantTaulaClassificacio;
window.onTaulaClassificacioVoteFilterChange = onTaulaClassificacioVoteFilterChange;
window.showParticipantClassificacio = showParticipantClassificacio;
window.showParticipantGallery = showParticipantGallery;
window.refreshParticipantDashboard = refreshParticipantDashboard;
window.renderVotingHeader = renderVotingHeader;
