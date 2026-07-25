// ═══════════════════════════════════
// RANKING — cálculo client-side y render
// ═══════════════════════════════════
import { state, actingAsAdmin } from '../core/state.js';
import { t } from '../core/i18n.js';
import { getActivePublishedPhotos, getDisplayName } from '../core/data.js';
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

export function getPhotoScore(photoId) {
  // Puntuació final d'una fotografia dins del repte (mitja de les 3 mitges de criteri).
  return getPhotoScoreBreakdown(photoId).final;
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
  const ranked = computeRankingForObjective(objId, scope);
  if (ranked.length === 0) {
    const msg = t('no_data_voting');
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>${msg}</p></div>`;
    return;
  }
  const posClasses = ['top1', 'top2', 'top3'];

  // Llista per al visor a pantalla completa. `resultsMode:true` + `id` és el
  // que activa (a lightbox.js) el disparador ⭐ i la cortineta de puntuació —
  // per això NOMÉS aquesta pantalla (Resultats Repte) construeix la llista així;
  // la Galeria fa servir el mateix openFullscreen() però sense aquests camps.
  window._resultatsPhotosList = ranked.map(({ photo }) => ({
    url: photo.url, fileName: photo.fileName, author: _authorName(photo.userId),
    id: photo.id, resultsMode: true,
  }));

  const cards = ranked.map(({ photo, creativity, theme, composition, final }, idx) => `
    <div class="photo-card">
      <div class="card-pos ${posClasses[idx] || ''}">${idx + 1}</div>
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
// CLASSIFICACIÓ GENERAL (nativa, recàlcul en viu)
// ═══════════════════════════════════
// A diferència de computeGeneralRanking() de sota (punts acumulats a
// state.generalRanking en finalitzar cada repte — mètode antic, encara usat
// pel Ranking General de l'admin), aquesta versió recalcula TOTS els reptes
// finalitzats cada cop, reutilitzant computeRankingForObjective()/
// assignPositionPoints() — no depèn de re-finalitzar un repte si es corregeix
// un vot després. Decisió presa en portar Resultats a nadiu (Fase 2.2): es
// manté així fins que la Fase 3 canviï el sistema de puntuació.
export function computeGeneralRankingLive(scope = 'all') {
  const finished = state.objectives.filter(o => o.status === 'finished');
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

export function computeCurrentRanking() {
  // Solo fotos de la temática activa
  return getActivePublishedPhotos().map(photo => ({
    photo,
    score: getPhotoScore(photo.id),
  })).sort((a, b) => b.score - a.score);
}

export function computeGeneralRanking() {
  // El rànquing global només mostra punts ja acumulats al finalitzar reptes.
  return Object.entries(state.generalRanking)
    .map(([userId, data]) => {
      const user = state.users.find(u => u.id === userId);
      return {
        user: user || { name: t('unknown_user'), id: userId },
        participations: data.participations || 0,
        totalScore: data.totalScore || 0,
      };
    })
    .filter(g => g.participations > 0)
    .sort((a, b) => b.totalScore - a.totalScore);
}

export function renderRanking(currentListId, generalListId) {
  const rankNums = ['gold','silver','bronze'];
  const isAdmin = actingAsAdmin();

  // Current
  const ranked   = computeCurrentRanking();
  const currentEl = document.getElementById(currentListId);
  if (currentEl) {
    if (!isAdmin && !state.settings.namesRevealed) {
      currentEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><p>${t('ranking_locked_msg')}</p></div>`;
    } else if (ranked.length === 0) {
      currentEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>${t('no_data_voting')}</p></div>`;
    } else {
      currentEl.innerHTML = ranked.map(({ photo, score }, idx) => `
        <div class="rank-item">
          <div class="rank-num ${rankNums[idx]||''}">${idx+1}</div>
          <img class="rank-thumb" src="${photo.url}" alt="">
          <div class="rank-info">
            <div class="rank-name">${getDisplayName(photo.userId)}</div>
            <div class="rank-meta">${formatScore(score)} ${t('points_label')}</div>
          </div>
          <div class="rank-score">${formatScore(score)}</div>
        </div>
      `).join('');
    }
  }

  // General — ocultar a participantes si rankingHidden está activo
  const general   = computeGeneralRanking();
  const generalEl = document.getElementById(generalListId);
  if (generalEl) {
    // Si no es admin y el ranking está oculto, mostrar mensaje
    if (!isAdmin && state.settings.rankingHidden) {
      generalEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><p>${t('general_ranking_hidden_msg')}</p></div>`;
    } else {
      const active = general.filter(g => g.participations > 0);
      if (active.length === 0) {
        generalEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🏅</div><p>${t('no_participations')}</p></div>`;
      } else {
        generalEl.innerHTML = active.map(({ user, participations, totalScore }, idx) => `
          <div class="rank-item">
            <div class="rank-num ${rankNums[idx]||''}">${idx+1}</div>
            <div class="rank-info">
              <div class="rank-name">${user.name}</div>
              <div class="rank-meta">${participations} ${t('participations')}</div>
            </div>
            <div class="rank-score">${Math.trunc(totalScore)}</div>
          </div>
        `).join('');
      }
    }
  }
}

window.renderRanking = renderRanking;
