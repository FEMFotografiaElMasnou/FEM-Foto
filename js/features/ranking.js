// ═══════════════════════════════════
// RANKING — cálculo client-side y render
// ═══════════════════════════════════
import { state } from '../core/state.js';
import { t } from '../core/i18n.js';
import { openFullscreen } from '../ui/lightbox.js';

// ── Taula de punts per posició al rànquing global ───────────────
const POSITION_POINTS = [25, 18, 15, 12, 10, 8, 7, 6, 5, 4];

export function getPointsForPosition(position) {
  // position: 1-indexed
  if (position <= 10) return POSITION_POINTS[position - 1];
  // Posició 11 → 1.0099, 12 → 1.0098, 13 → 1.0097...
  const decimalOffset = (position - 10) / 10000; // 11→0.0001, 12→0.0002…
  return 1.01 - decimalOffset;
}

// Assigna punts de tabla a una llista ordenada de fotos amb score.
export function assignPositionPoints(rankedList) {
  const result = [];
  let lastAssignedPosition = 0;
  let previousScore = null;

  rankedList.forEach((item) => {
    let effectivePosition;
    if (previousScore !== null && item.score === previousScore) {
      // Empat: hereta la mateixa posició que l'anterior
      effectivePosition = lastAssignedPosition;
    } else {
      // No empat: posició consecutiva (no es salta encara que hi hagi hagut empats)
      effectivePosition = lastAssignedPosition + 1;
    }
    result.push({
      ...item,
      position: effectivePosition,
      points: getPointsForPosition(effectivePosition),
    });
    lastAssignedPosition = effectivePosition;
    previousScore = item.score;
  });

  return result;
}

// Format a 0–5 score with 2 decimals and Catalan comma (e.g. 4.2333 → "4,23")
export function formatScore(score) {
  if (typeof score !== 'number' || isNaN(score)) return '0,00';
  return score.toFixed(2).replace('.', ',');
}

// Set de userIds que han ENVIAT (es_esborrany=false) en aquest repte, filtrat
// opcionalment per l'origen del vot:
//   'all'    → tothom que ha enviat (comportament original, sense filtrar)
//   'expert' → només usuaris amb role === 'expert'
//   'socis'  → tothom que NO és expert (participants i admins, és a dir "socis")
function _submittedUserIdsForScope(objectiveId, scope) {
  const ids = new Set();
  for (const [key, val] of Object.entries(state.submittedVoting || {})) {
    if (!val || val.es_esborrany !== false) continue;
    const sepIdx = key.lastIndexOf('__');
    if (sepIdx === -1) continue;
    const uid = key.slice(0, sepIdx);
    const oid = key.slice(sepIdx + 2);
    if (oid !== String(objectiveId)) continue;
    if (scope === 'all') { ids.add(uid); continue; }
    const u = state.users.find(x => x.id === uid);
    const isExpert = !!(u && u.role === 'expert');
    if (scope === 'expert' && isExpert) ids.add(uid);
    if (scope === 'socis' && !isExpert) ids.add(uid);
  }
  return ids;
}

// Hi ha algun expert que hagi enviat vot per aquest repte? Determina si té
// sentit mostrar el desglossament "Votació Expert / Vots Socis / Tots els Vots".
export function objectiveHasExpertVoting(objectiveId) {
  return _submittedUserIdsForScope(objectiveId, 'expert').size > 0;
}

// Hi ha algú del scope triat que hagi enviat vot en aquest repte? Si no n'hi
// ha cap, el repte no ha d'aportar punts a ningú a la Classificació General
// sota aquest filtre (en lloc de repartir el màxim per empat a 0).
export function objectiveHasVotesForScope(objectiveId, scope) {
  return _submittedUserIdsForScope(objectiveId, scope).size > 0;
}

export function getPhotoScoreBreakdown(photoId, scope = 'all') {
  // Desglossament de la puntuació d'una foto: mitja per criteri + nota final.
  // `scope` permet restringir el càlcul a un subconjunt de votants (vegeu
  // _submittedUserIdsForScope): 'all' (per defecte), 'expert' o 'socis'.
  const empty = { creativity: 0, theme: 0, composition: 0, final: 0 };

  // 1) Trobar la foto i el seu objectiveId (publicada o no: el repte actiu pot
  //    tenir fotos pujades encara no publicades, que l'admin també vol veure)
  const photo = state.publishedPhotos.find(p => p.id === photoId)
             || state.photos.find(p => p.id === photoId);
  if (!photo || !photo.objectiveId) return empty;
  const objectiveId = photo.objectiveId;

  // 2) Set de userIds que han ENVIAT (es_esborrany=false) en aquest repte,
  //    restringit a l'scope demanat.
  const submittedUserIds = _submittedUserIdsForScope(objectiveId, scope);

  const totalVotants = submittedUserIds.size;
  if (totalVotants === 0) return empty;

  // 3) Vots d'aquesta foto, només dels votants que han enviat
  const photoVotes = state.votes.filter(
    v => v.photoId === photoId && submittedUserIds.has(String(v.userId))
  );
  if (photoVotes.length === 0) return empty;

  // 4) Mitja per criteri: suma dels vots vàlids / total de votants del repte
  const avgCriterion = (key) => {
    const sum = photoVotes
      .filter(v => v[key] > 0)
      .reduce((acc, v) => acc + v[key], 0);
    return sum / totalVotants;
  };

  const creativity  = avgCriterion('creativity');
  const theme       = avgCriterion('theme');
  const composition = avgCriterion('composition');

  return { creativity, theme, composition, final: (creativity + theme + composition) / 3 };
}

// Fotos que compten per a un repte concret:
//   · repte finalitzat → només les fotos que van concursar (publicades)
//   · repte no finalitzat (actual/inactiu, només visible per l'admin) → totes les
//     fotos pujades, encara que no estiguin publicades, per veure'n l'estat.
function _photoPoolForObjective(objId) {
  const obj = state.objectives.find(o => o.id === objId);
  const isFinished = !!(obj && obj.status === 'finished');
  return isFinished
    ? state.publishedPhotos.filter(p => p.objectiveId === objId)
    : [...state.publishedPhotos, ...state.photos].filter(p => p.objectiveId === objId);
}

// Rànquing detallat d'un repte concret (per id), ordenat per nota final.
// `scope` filtra els votants que compten ('all' | 'expert' | 'socis', vegeu
// getPhotoScoreBreakdown); per defecte 'all' (comportament d'abans).
export function computeRankingForObjective(objId, scope = 'all') {
  return _photoPoolForObjective(objId)
    .map(photo => ({ photo, ...getPhotoScoreBreakdown(photo.id, scope) }))
    .sort((a, b) => b.final - a.final);
}

// Rànquing d'un repte restringit a un scope de votants ('expert' | 'socis' | 'all'),
// amb posició assignada (1-indexada, empats hereten la mateixa posició).
function _rankingForObjectiveScoped(objId, scope) {
  const scored = _photoPoolForObjective(objId)
    .map(photo => ({ photo, ...getPhotoScoreBreakdown(photo.id, scope) }))
    .sort((a, b) => b.final - a.final);

  let lastPosition = 0;
  let previousScore = null;
  scored.forEach(item => {
    item.position = (previousScore !== null && item.final === previousScore)
      ? lastPosition
      : lastPosition + 1;
    lastPosition = item.position;
    previousScore = item.final;
  });
  return scored;
}

// Ordinal català curt per a posicions de rànquing (1r, 2n, 3r, 4t, 5è...).
export function formatPosition(position) {
  if (!position || position < 1) return '—';
  if (position === 1) return '1r';
  if (position === 2) return '2n';
  if (position === 3) return '3r';
  if (position === 4) return '4t';
  return position + 'è';
}

// Desglossament complet per a la cortineta de puntuació del visor de fotos:
// posició + nota (total i per criteri) en els tres blocs Expert/Socis/Tots.
// Retorna null si el repte de la foto no té cap vot d'expert (en aquest cas
// no s'ha de mostrar la cortineta ni el seu disparador).
export function getPhotoResultsBreakdown(photoId) {
  const photo = state.publishedPhotos.find(p => p.id === photoId)
             || state.photos.find(p => p.id === photoId);
  if (!photo || !photo.objectiveId) return null;
  const objectiveId = photo.objectiveId;
  if (!objectiveHasExpertVoting(objectiveId)) return null;

  const scopes = [
    { key: 'expert', labelKey: 'score_curtain_expert' },
    { key: 'socis',  labelKey: 'score_curtain_socis' },
    { key: 'all',    labelKey: 'score_curtain_all' },
  ];
  const blocks = scopes.map(({ key, labelKey }) => {
    const ranked = _rankingForObjectiveScoped(objectiveId, key);
    const entry = ranked.find(r => r.photo.id === photoId);
    return {
      key, labelKey,
      position:    entry ? entry.position    : null,
      creativity:  entry ? entry.creativity  : 0,
      theme:       entry ? entry.theme       : 0,
      composition: entry ? entry.composition : 0,
      final:       entry ? entry.final       : 0,
    };
  });
  return { objectiveId, blocks };
}

// Nom real de l'autor (els reptes finalitzats no són anònims; com a la galeria).
function _authorName(userId) {
  const u = state.users.find(x => x.id === userId);
  return (u && u.name) ? u.name : '—';
}

// Miniatura gran per a la targeta de Resultat Repte (mateixa mida que la
// pàgina original de Resultats, "card-thumb": 240x180 servits en una caixa
// de 120x90 amb object-fit:cover).
function _thumbUrl(url) {
  if (!url) return null;
  return url.replace('/image/upload/', '/image/upload/w_240,h_180,c_fill,q_auto,f_auto/');
}

// Posició densa ("generosa"): fotos empatades comparteixen la mateixa
// posició; la següent puntuació diferent avança exactament 1, encara que
// hi hagi hagut un empat de N fotos (mai es salten posicions). Mateix
// criteri que ja fa servir assignPositionPoints() per als punts de la
// Classificació General — aquí només serveix per pintar el número, no
// assigna punts. `sortedList` ha d'arribar ja ordenat descendent.
function _densePosition(sortedList, scoreOf) {
  let lastPosition = 0;
  let previousScore = null;
  return sortedList.map(item => {
    const score = scoreOf(item);
    const position = (previousScore !== null && score === previousScore)
      ? lastPosition
      : lastPosition + 1;
    lastPosition = position;
    previousScore = score;
    return { ...item, position };
  });
}

// 5 icones ★ amb ompliment parcial (percentual), rèplica del component
// Stars.jsx de la pàgina original de Resultats.
function _starsHtml(score) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (score >= i) {
      stars += `<span class="star full">★</span>`;
    } else if (score > i - 1) {
      const pct = Math.round((score - (i - 1)) * 100);
      stars += `<span class="star partial" style="--pct:${pct}%">★</span>`;
    } else {
      stars += `<span class="star">★</span>`;
    }
  }
  return `<span class="stars">${stars}</span>`;
}

// Pinta el rànquing detallat (nota final + 3 criteris) d'un repte finalitzat.
// Disseny i mides calcats de la pàgina original de Resultats (classes
// .photo-card/.card-pos/.card-thumb/.card-body/.card-criteria/.card-total),
// vegeu _reference-resultats/index.css — només es canvia 'Oswald' per la
// tipografia de capçalera que ja fa servir Foto (var(--font-display)).
export function renderResultatsRepte(objId, listId, scope = 'all') {
  const el = document.getElementById(listId);
  if (!el) return;
  const raw = computeRankingForObjective(objId, scope);
  if (raw.length === 0) {
    const msg = t('no_data_voting');
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>${msg}</p></div>`;
    return;
  }
  const ranked = _densePosition(raw, r => r.final);
  const posClasses = ['top1', 'top2', 'top3'];

  // Llista per al visor a pantalla completa. `resultsMode:true` + `id` és el
  // que activa (a lightbox.js) el disparador ⭐ i la cortineta de puntuació —
  // per això NOMÉS aquesta pantalla (Resultats Repte) construeix la llista així;
  // la Galeria fa servir el mateix openFullscreen() però sense aquests camps.
  window._resultatsPhotosList = ranked.map(({ photo }) => ({
    url: photo.url, fileName: photo.fileName, author: _authorName(photo.userId),
    id: photo.id, resultsMode: true,
  }));

  // `idx` (índex de l'array) és per al visor a pantalla completa; `position`
  // (posició densa, pot repetir-se en empats) és el que es pinta i el que
  // determinaria els punts de la Classificació General.
  const cards = ranked.map(({ photo, creativity, theme, composition, final, position }, idx) => `
    <div class="photo-card">
      <div class="card-pos ${posClasses[position - 1] || ''}">${position}</div>
      <div class="card-thumb" onclick="openResultatsLightbox(${idx})">
        <img src="${_thumbUrl(photo.url)}" alt="" loading="lazy">
        <div class="zoom-icon">🔍</div>
      </div>
      <div class="card-body">
        <div class="card-author">${_authorName(photo.userId)}</div>
        <div class="card-criteria">
          <div class="criterion">
            <div class="criterion-label">${t('creativity')}</div>
            <div class="criterion-row">
              <span class="criterion-val">${formatScore(creativity)}</span>
              ${_starsHtml(creativity)}
            </div>
          </div>
          <div class="criterion">
            <div class="criterion-label">${t('composition')}</div>
            <div class="criterion-row">
              <span class="criterion-val">${formatScore(composition)}</span>
              ${_starsHtml(composition)}
            </div>
          </div>
          <div class="criterion">
            <div class="criterion-label">${t('theme')}</div>
            <div class="criterion-row">
              <span class="criterion-val">${formatScore(theme)}</span>
              ${_starsHtml(theme)}
            </div>
          </div>
        </div>
      </div>
      <div class="card-total">
        <div class="total-label">${t('gen_table_total')}</div>
        <div class="total-stars">${_starsHtml(final)}</div>
        <div class="total-val">${formatScore(final)}</div>
      </div>
    </div>
  `).join('');

  el.innerHTML = `<div class="cards-list">${cards}</div>`;
}

// Obre el visor a pantalla completa des de la pantalla Resultats Repte.
export function openResultatsLightbox(index) {
  const photos = window._resultatsPhotosList || [];
  if (photos.length === 0) return;
  openFullscreen(photos[index].url, photos[index].fileName, photos, index);
}
window.openResultatsLightbox = openResultatsLightbox;

// ═══════════════════════════════════
// VALORACIÓ REPTE (nom de treball, Fase 3 Pas 2) — nova pantalla EN PARAL·LEL
// a Resultat Repte, per comparar el nou sistema de puntuació (1 sola nota,
// valoracio 0-10) amb l'actual (3 criteris) sense tocar res d'existent.
// Reutilitza tota la infraestructura de Resultat Repte (pool de fotos, escala
// de vot per rol, disseny de targeta) — només canvia LA FONT de la nota.
// ═══════════════════════════════════

// Mitjana de `valoracio` (0-10) per a una foto, restringida a l'scope de vot
// triat. Mateixa lògica que getPhotoScoreBreakdown (mateix denominador —
// _submittedUserIdsForScope és agnòstic a l'escala de la nota), però d'un
// sol camp en lloc de 3.
export function getPhotoValoracio(photoId, scope = 'all') {
  const photo = state.publishedPhotos.find(p => p.id === photoId)
             || state.photos.find(p => p.id === photoId);
  if (!photo || !photo.objectiveId) return 0;
  const objectiveId = photo.objectiveId;

  const submittedUserIds = _submittedUserIdsForScope(objectiveId, scope);
  const totalVotants = submittedUserIds.size;
  if (totalVotants === 0) return 0;

  const photoVotes = state.votes.filter(
    v => v.photoId === photoId && submittedUserIds.has(String(v.userId))
  );
  if (photoVotes.length === 0) return 0;

  const sum = photoVotes
    .filter(v => v.valoracio > 0)
    .reduce((acc, v) => acc + v.valoracio, 0);
  // Arrodonit a 2 decimals, que és la nota tal com es mostra a la pantalla.
  // No és cosmètic: és el que fa que aquest motor ordeni igual que el dels 3
  // criteris en els reptes històrics. `valoracio` es desa com
  // round((c+t+comp)*10/15, 2) en una columna numeric(4,2), i aquell
  // arrodoniment deixa un residu de fins a ±0,0033 per vot que NO es cancel·la:
  // trencava els empats exactes del sistema antic i, com que les posicions són
  // denses, empenyia una posició avall tothom qui venia després. Al repte
  // «Escales» de Normal això movia 19 posicions de 23 i l'ordre de la
  // Classificació General. Vegeu docs/PROVES_Fase4.md, Annex A.
  return Math.round((sum / totalVotants) * 100) / 100;
}

// Rànquing d'un repte segons `valoracio`. Mateix pool de fotos que Resultat
// Repte (_photoPoolForObjective, sense tocar) — només canvia la nota.
export function computeValoracioRankingForObjective(objId, scope = 'all') {
  return _photoPoolForObjective(objId)
    .map(photo => ({ photo, valoracio: getPhotoValoracio(photo.id, scope) }))
    .sort((a, b) => b.valoracio - a.valoracio);
}

// Mateix rànquing que computeValoracioRankingForObjective, amb posició
// assignada (empats comparteixen posició) — necessari per al panell de
// puntuació del visor (vegeu getPhotoValoracioBreakdown).
function _valoracioRankingForObjectiveScoped(objId, scope) {
  const scored = _photoPoolForObjective(objId)
    .map(photo => ({ photo, valoracio: getPhotoValoracio(photo.id, scope) }))
    .sort((a, b) => b.valoracio - a.valoracio);

  let lastPosition = 0;
  let previousScore = null;
  scored.forEach(item => {
    item.position = (previousScore !== null && item.valoracio === previousScore)
      ? lastPosition
      : lastPosition + 1;
    lastPosition = item.position;
    previousScore = item.valoracio;
  });
  return scored;
}

// Desglossament per al panell de puntuació del visor a "Valoració Repte":
// una fila per Total Vots / Vots Socis / Vots Experts (columna "Votants",
// és l'àmbit de la fila, no un recompte), amb puntuació (valoracio) i
// posició. Mateixa condició de visibilitat que getPhotoResultsBreakdown
// (només si el repte té vot d'expert) — si no n'hi ha, Total i Socis
// coincideixen i la nota/posició ja s'ha vist a la pantalla de llista, així
// que no cal mostrar el panell.
export function getPhotoValoracioBreakdown(photoId) {
  const photo = state.publishedPhotos.find(p => p.id === photoId)
             || state.photos.find(p => p.id === photoId);
  if (!photo || !photo.objectiveId) return null;
  const objectiveId = photo.objectiveId;
  if (!objectiveHasExpertVoting(objectiveId)) return null;

  const scopes = [
    { key: 'all',    labelKey: 'valoracio_curtain_total' },
    { key: 'socis',  labelKey: 'valoracio_curtain_socis' },
    { key: 'expert', labelKey: 'valoracio_curtain_expert' },
  ];
  const blocks = scopes.map(({ key, labelKey }) => {
    const ranked = _valoracioRankingForObjectiveScoped(objectiveId, key);
    const entry = ranked.find(r => r.photo.id === photoId);
    return {
      key, labelKey,
      valoracio: entry ? entry.valoracio : 0,
      position:  entry ? entry.position  : null,
    };
  });
  return { objectiveId, blocks };
}

// Pinta "Valoració Repte". Mateixa targeta que Resultat Repte (.photo-card)
// però sense el bloc de 3 criteris (ja no n'hi ha, només la nota total),
// i amb una barra de progrés 0-10 en lloc d'estrelles (5 estrelles fixes
// queda forçat per a una escala de 10 punts; vegeu _starsHtml, pensada
// per a escala 0-5, que Resultat Repte sí que continua fent servir).
export function renderValoracioRepte(objId, listId, scope = 'all') {
  const el = document.getElementById(listId);
  if (!el) return;
  const raw = computeValoracioRankingForObjective(objId, scope);
  if (raw.length === 0) {
    const msg = t('no_data_voting');
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>${msg}</p></div>`;
    return;
  }
  const ranked = _densePosition(raw, r => r.valoracio);
  const posClasses = ['top1', 'top2', 'top3'];

  window._valoracioPhotosList = ranked.map(({ photo }) => ({
    url: photo.url, fileName: photo.fileName, author: _authorName(photo.userId),
    id: photo.id, valoracioMode: true,
  }));

  // `idx` (índex de l'array) és per al visor a pantalla completa; `position`
  // (posició densa, pot repetir-se en empats) és el que es pinta.
  const cards = ranked.map(({ photo, valoracio, position }, idx) => {
    const title = photo.caption ? ` - ${photo.caption}` : '';
    const pct = Math.max(0, Math.min(100, (valoracio / 10) * 100));
    return `
    <div class="photo-card">
      <div class="card-pos ${posClasses[position - 1] || ''}">${position}</div>
      <div class="card-thumb" onclick="openValoracioLightbox(${idx})">
        <img src="${_thumbUrl(photo.url)}" alt="" loading="lazy">
        <div class="zoom-icon">🔍</div>
      </div>
      <div class="card-body">
        <div class="card-author">${_authorName(photo.userId)}${title}</div>
        <div class="valoracio-bar-track">
          <div class="valoracio-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="card-total">
        <div class="total-val">${formatScore(valoracio)}</div>
      </div>
    </div>
  `;
  }).join('');

  el.innerHTML = `<div class="cards-list">${cards}</div>`;
}

// Obre el visor a pantalla completa des de Valoració Repte.
export function openValoracioLightbox(index) {
  const photos = window._valoracioPhotosList || [];
  if (photos.length === 0) return;
  openFullscreen(photos[index].url, photos[index].fileName, photos, index);
}
window.openValoracioLightbox = openValoracioLightbox;

// ═══════════════════════════════════
// CLASSIFICACIÓ GENERAL (nativa, recàlcul en viu)
// ═══════════════════════════════════
// A diferència del vell mètode de punts acumulats a state.generalRanking en
// finalitzar cada repte (retirat, pantalla morta — incidència 3.6/4.9 de
// PROVES_Fase4.md), aquesta versió recalcula TOTS els reptes finalitzats cada
// cop, reutilitzant computeRankingForObjective()/
// assignPositionPoints() — no depèn de re-finalitzar un repte si es corregeix
// un vot després. Decisió presa en portar Resultats a nadiu (Fase 2.2): es
// manté així fins que la Fase 3 canviï el sistema de puntuació.
// Ordena de més recent a més antic (end_date si en té, si no start_date) —
// mateix criteri que _resultatsObjectives() (participant.js) per al
// desplegable de Resultat Repte/Valoració Repte. Bug corregit 2026-07-26:
// la consulta a `objectives` no porta cap .order(), així que sense aquest
// sort l'ordre de les miniatures depenia de l'ordre físic (indefinit) de la
// taula a Supabase.
function _byRecentFirst(a, b) {
  return String(b.end_date || b.start_date || '').localeCompare(String(a.end_date || a.start_date || ''));
}

export function computeGeneralRankingLive(scope = 'all') {
  const finished = state.objectives.filter(o => o.status === 'finished').sort(_byRecentFirst);
  const userMap = {}; // userId -> { userId, totalScore, participations, reptes: {objId: {photo,points,position}} }

  finished.forEach(obj => {
    // Ningú del scope triat ha votat aquest repte: no aporta punts a ningú
    // (en lloc de repartir el màxim per un empat fictici a nota 0).
    if (!objectiveHasVotesForScope(obj.id, scope)) return;
    const scored = assignPositionPoints(
      computeRankingForObjective(obj.id, scope).map(r => ({ ...r, score: r.final }))
    );
    scored.forEach(item => {
      const uid = item.photo.userId;
      if (!userMap[uid]) userMap[uid] = { userId: uid, totalScore: 0, participations: 0, reptes: {} };
      userMap[uid].totalScore += item.points;
      userMap[uid].participations += 1;
      userMap[uid].reptes[obj.id] = { photo: item.photo, points: item.points, position: item.position };
    });
  });

  const participants = Object.values(userMap).map(u => ({
    ...u,
    user: state.users.find(x => x.id === u.userId) || { name: t('unknown_user'), id: u.userId },
  }));
  participants.sort((a, b) => b.totalScore - a.totalScore);

  // Posició general (dense: empats al mateix total arrodonit comparteixen
  // posició, mateix criteri que assignPositionPoints/formatPosition de dalt).
  let lastPos = 0, prevDisplay = null;
  participants.forEach(p => {
    p.displayTotal = Math.floor(p.totalScore);
    p.generalPosition = (prevDisplay !== null && p.displayTotal === prevDisplay) ? lastPos : lastPos + 1;
    lastPos = p.generalPosition;
    prevDisplay = p.displayTotal;
  });

  return { finishedObjectives: finished, participants };
}

// Miniatura petita per a la graella de reptes de cada soci (mateixa
// transformació Cloudinary que la resta de l'app, només canvia la mida).
function _thumbSmUrl(url) {
  if (!url) return null;
  return url.replace('/image/upload/', '/image/upload/w_120,h_90,c_fill,q_auto,f_auto/');
}

// Pinta la Classificació General: una fila per soci (posició + nom + total),
// amb una miniatura+punts per cada repte finalitzat on hi ha participat.
export function renderClassificacioGeneral(listId, scope = 'all') {
  const el = document.getElementById(listId);
  if (!el) return;
  const { finishedObjectives, participants } = computeGeneralRankingLive(scope);

  window._classificacioPhotosList = [];

  if (participants.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏅</div><p>${t('no_participations')}</p></div>`;
    return;
  }

  const rankNums = ['gold', 'silver', 'bronze'];

  const rows = participants.map(p => {
    const entries = finishedObjectives.map(obj => {
      const entry = p.reptes[obj.id];
      if (!entry) {
        return `
          <div class="gen-repte-entry gen-repte-absent">
            <div class="gen-repte-top">
              <div class="gen-no-thumb">📷</div>
              <span class="gen-repte-pts-dash">—</span>
            </div>
            <div class="gen-repte-name">${obj.title}</div>
          </div>`;
      }
      const photoIdx = window._classificacioPhotosList.length;
      window._classificacioPhotosList.push({
        url: entry.photo.url,
        fileName: entry.photo.fileName,
        author: `${p.user.name} (${obj.title})`,
      });
      return `
        <div class="gen-repte-entry">
          <div class="gen-repte-top">
            <div class="gen-repte-thumb" onclick="openClassificacioLightbox(${photoIdx})">
              <img src="${_thumbSmUrl(entry.photo.url)}" alt="" loading="lazy">
            </div>
            <span class="gen-repte-pts">${Math.floor(entry.points)}</span>
          </div>
          <div class="gen-repte-name">${obj.title}</div>
        </div>`;
    }).join('');

    return `
      <div class="gen-row">
        <div class="gen-cell-pos"><span class="rank-num ${rankNums[p.generalPosition - 1] || ''}">${p.generalPosition}</span></div>
        <div class="gen-cell-name">${p.user.name}</div>
        <div class="gen-cell-total"><span class="gen-total-badge">${p.displayTotal}</span></div>
        <div class="gen-cell-reptes">${entries}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="gen-table">
      <div class="gen-header">
        <div class="gen-header-pos">${t('gen_table_pos')}</div>
        <div class="gen-header-name">${t('gen_table_member')}</div>
        <div class="gen-header-total">${t('gen_table_total')}</div>
        <div class="gen-header-reptes">${t('objectives')}</div>
      </div>
      ${rows}
    </div>`;
}

// Obre el visor a pantalla completa des de la Classificació General (una
// única foto, sense passar/tornar entre reptes diferents).
export function openClassificacioLightbox(index) {
  const photo = (window._classificacioPhotosList || [])[index];
  if (!photo) return;
  openFullscreen(photo.url, photo.fileName, [photo], 0);
}
window.openClassificacioLightbox = openClassificacioLightbox;

// ═══════════════════════════════════
// TAULA DE CLASSIFICACIÓ (nom de treball, Fase 3 Pas 3) — nova pantalla EN
// PARAL·LEL a Classificació General, per comparar el nou sistema de
// puntuació (valoracio 0-10) amb l'actual (3 criteris) abans de decidir res
// més. Mateix patró que Valoració Repte (Pas 2): es duplica en lloc de
// refactoritzar computeGeneralRankingLive()/renderClassificacioGeneral().
// ═══════════════════════════════════

// Idèntica a computeGeneralRankingLive(), només canvia la font de la nota
// (computeValoracioRankingForObjective en lloc de computeRankingForObjective).
// assignPositionPoints() no distingeix escala de nota, només posició — vegeu
// §3.7/Pas 3 de ANALISI_Fase3_Puntuacio.md.
export function computeValoracioGeneralRankingLive(scope = 'all') {
  // A diferència de computeGeneralRankingLive() (sempre només finalitzats,
  // per a tothom): per a l'admin real també s'hi inclouen els reptes actius
  // (p.ex. "Repte de proves"), mateix criteri que _resultatsObjectives()
  // (participant.js) ja aplica a "Valoració Repte" — acordat amb Enric
  // 2026-07-26 perquè es pugui veure l'efecte d'un repte en curs sense
  // esperar a finalitzar-lo.
  const isRealAdmin = !!(state.currentUser && state.currentUser.role === 'admin');
  const finished = state.objectives
    .filter(o => o.status === 'finished' || (isRealAdmin && o.status === 'active'))
    .sort(_byRecentFirst);
  const userMap = {};

  finished.forEach(obj => {
    if (!objectiveHasVotesForScope(obj.id, scope)) return;
    const scored = assignPositionPoints(
      computeValoracioRankingForObjective(obj.id, scope).map(r => ({ ...r, score: r.valoracio }))
    );
    scored.forEach(item => {
      const uid = item.photo.userId;
      if (!userMap[uid]) userMap[uid] = { userId: uid, totalScore: 0, participations: 0, reptes: {} };
      userMap[uid].totalScore += item.points;
      userMap[uid].participations += 1;
      userMap[uid].reptes[obj.id] = { photo: item.photo, points: item.points, position: item.position };
    });
  });

  const participants = Object.values(userMap).map(u => ({
    ...u,
    user: state.users.find(x => x.id === u.userId) || { name: t('unknown_user'), id: u.userId },
  }));
  participants.sort((a, b) => b.totalScore - a.totalScore);

  let lastPos = 0, prevDisplay = null;
  participants.forEach(p => {
    p.displayTotal = Math.floor(p.totalScore);
    p.generalPosition = (prevDisplay !== null && p.displayTotal === prevDisplay) ? lastPos : lastPos + 1;
    lastPos = p.generalPosition;
    prevDisplay = p.displayTotal;
  });

  return { finishedObjectives: finished, participants };
}

// Idèntica a renderClassificacioGeneral(), només canvia la font de dades.
export function renderTaulaClassificacio(listId, scope = 'all') {
  const el = document.getElementById(listId);
  if (!el) return;
  const { finishedObjectives, participants } = computeValoracioGeneralRankingLive(scope);

  window._taulaClassificacioPhotosList = [];

  if (participants.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏅</div><p>${t('no_participations')}</p></div>`;
    return;
  }

  const rankNums = ['gold', 'silver', 'bronze'];

  const rows = participants.map(p => {
    const entries = finishedObjectives.map(obj => {
      const entry = p.reptes[obj.id];
      if (!entry) {
        return `
          <div class="gen-repte-entry gen-repte-absent">
            <div class="gen-repte-top">
              <div class="gen-no-thumb">📷</div>
              <span class="gen-repte-pts-dash">—</span>
            </div>
            <div class="gen-repte-name">${obj.title}</div>
          </div>`;
      }
      const photoIdx = window._taulaClassificacioPhotosList.length;
      window._taulaClassificacioPhotosList.push({
        url: entry.photo.url,
        fileName: entry.photo.fileName,
        author: `${p.user.name} (${obj.title})`,
      });
      return `
        <div class="gen-repte-entry">
          <div class="gen-repte-top">
            <div class="gen-repte-thumb" onclick="openTaulaClassificacioLightbox(${photoIdx})">
              <img src="${_thumbSmUrl(entry.photo.url)}" alt="" loading="lazy">
            </div>
            <span class="gen-repte-pts">${Math.floor(entry.points)}</span>
          </div>
          <div class="gen-repte-name">${obj.title}</div>
        </div>`;
    }).join('');

    return `
      <div class="gen-row">
        <div class="gen-cell-pos"><span class="rank-num ${rankNums[p.generalPosition - 1] || ''}">${p.generalPosition}</span></div>
        <div class="gen-cell-name">${p.user.name}</div>
        <div class="gen-cell-total"><span class="gen-total-badge">${p.displayTotal}</span></div>
        <div class="gen-cell-reptes">${entries}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="gen-table">
      <div class="gen-header">
        <div class="gen-header-pos">${t('gen_table_pos')}</div>
        <div class="gen-header-name">${t('gen_table_member')}</div>
        <div class="gen-header-total">${t('gen_table_total')}</div>
        <div class="gen-header-reptes">${t('objectives')}</div>
      </div>
      ${rows}
    </div>`;
}

export function openTaulaClassificacioLightbox(index) {
  const photo = (window._taulaClassificacioPhotosList || [])[index];
  if (!photo) return;
  openFullscreen(photo.url, photo.fileName, [photo], 0);
}
window.openTaulaClassificacioLightbox = openTaulaClassificacioLightbox;
