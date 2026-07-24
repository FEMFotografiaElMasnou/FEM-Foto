// ═══════════════════════════════════
// VOTACIÓ — render del grid, autosave por clic y envío definitivo
// ═══════════════════════════════════
import { state, _localVoteEdits } from '../core/state.js';
import { sb } from '../core/config.js';
import { t } from '../core/i18n.js';
import { showToast, showLoader, hideLoader } from '../ui/toast.js';
import { confirmAction } from '../ui/modals.js';
import { getActivePublishedPhotos, getParticipantNumber } from '../core/data.js';
import { renderRanking } from './ranking.js';
import { refreshAdminDashboard } from '../screens/admin.js';
import { refreshParticipantDashboard } from '../screens/participant.js';

// ── VOTE HELPERS ──
export function getMyVote(photoId) {
  if (!state.currentUser) return null;
  return state.votes.find(v => v.photoId === photoId && v.userId === state.currentUser.id) || null;
}

export function setVoteCriteria(photoId, criteria, value) {
  if (!state.currentUser) return;
  let vote = state.votes.find(v => v.photoId === photoId && v.userId === state.currentUser.id);
  if (!vote) {
    vote = {
      id:          'v_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      userId:      state.currentUser.id,
      photoId,
      objectiveId: state.currentObjective ? state.currentObjective.id : '',
      creativity:  0,
      theme:       0,
      composition: 0,
      created_at:  new Date().toISOString(),
    };
    state.votes.push(vote);
  }
  vote[criteria] = value;

  // Also store in local edit buffer so loadAllData can restore them
  if (!_localVoteEdits[photoId]) {
    _localVoteEdits[photoId] = { creativity: vote.creativity, theme: vote.theme, composition: vote.composition };
  } else {
    _localVoteEdits[photoId][criteria] = value;
  }
}

// ── AUTOSAVE VOTING — write-on-click to Supabase ──
export function getVotingStatus(userId, objectiveId) {
  if (!userId || !objectiveId) return null;
  const key = `${userId}__${objectiveId}`;
  return state.submittedVoting[key] || null;
}

export function isVotingSubmitted(userId, objectiveId) {
  const st = getVotingStatus(userId, objectiveId);
  return !!(st && st.es_esborrany === false);
}

export async function saveVoteOnClick(photoId, criteria, value) {
  if (!state.currentUser) return false;
  const uid  = state.currentUser.id;
  const objId = state.currentObjective ? state.currentObjective.id : null;
  if (!objId) {
    console.warn('saveVoteOnClick: no active objective');
    return false;
  }

  // Build the full row from memory (preserves the other 2 criteria)
  const myVote = getMyVote(photoId);
  const row = {
    user_id:      uid,
    photo_id:     photoId,
    objective_id: objId,
    creativity:   myVote ? myVote.creativity   : 0,
    theme:        myVote ? myVote.theme        : 0,
    composition:  myVote ? myVote.composition  : 0,
  };
  // Apply the new value for the clicked criterion
  row[criteria] = value;

  // Upsert on the composite key (user_id, photo_id, objective_id)
  const { error: voteErr } = await sb
    .from('votes')
    .upsert(row, { onConflict: 'user_id,photo_id,objective_id' });

  if (voteErr) {
    console.error('saveVoteOnClick upsert error', voteErr);
    return false;
  }

  // Ensure seguiment_votacio record exists with es_esborrany = TRUE
  const key = `${uid}__${objId}`;
  const existingStatus = state.submittedVoting[key];
  if (!existingStatus) {
    const { error: segErr } = await sb
      .from('seguiment_votacio')
      .upsert(
        { user_id: uid, objective_id: objId, es_esborrany: true },
        { onConflict: 'user_id,objective_id' }
      );
    if (segErr) {
      console.error('saveVoteOnClick seguiment_votacio error', segErr);
      // Vote was saved; not critical. Continue.
    } else {
      // Update memory so we don't try to create it again next click
      state.submittedVoting[key] = { es_esborrany: true, submitted_at: null };
    }
  }

  return true;
}

// ═══════════════════════════════════
// VOTING GRID (shared admin + participant)
// ═══════════════════════════════════
export function renderAdminVotingGrid() {
  renderVotingGrid('admin-voting-grid');
}

export function renderVotingGrid(containerId) {
  const grid = document.getElementById(containerId);
  if (!state.currentUser) return;

  // Solo fotos publicadas de la temática activa
  const activePhotos = getActivePublishedPhotos();

  if (activePhotos.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🗳️</div><p>${t('no_photos_to_vote')}</p></div>`;
    return;
  }

  const uid = state.currentUser.id;
  const hasActiveObj = state.objectives.some(o => o.status === 'active');
  const objId = state.currentObjective ? state.currentObjective.id : null;
  const userSubmitted = (uid && objId) ? isVotingSubmitted(uid, objId) : false;
  const votingLocked = !hasActiveObj || !state.settings.voting_enabled || userSubmitted;
  const starStyle = votingLocked ? 'opacity:0.4;cursor:not-allowed;pointer-events:none;' : '';

  // Banner informatiu quan les votacions no estan obertes O l'usuari ja ha enviat
  let lockedBanner = '';
  if (userSubmitted) {
    lockedBanner = `
      <div style="grid-column:1/-1;background:rgba(62,207,142,0.1);border:1px solid rgba(62,207,142,0.3);
                  border-radius:10px;padding:12px 16px;text-align:center;
                  color:var(--success);font-size:13px;margin-bottom:4px;">
        ✅ ${t('already_voted_locked_msg')}
      </div>`;
  } else if (!hasActiveObj || !state.settings.voting_enabled) {
    lockedBanner = `
      <div style="grid-column:1/-1;background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.3);
                  border-radius:10px;padding:12px 16px;text-align:center;
                  color:var(--accent);font-size:13px;margin-bottom:4px;">
        🔒 ${t('voting_not_open_msg')}
      </div>`;
  }

  grid.innerHTML = lockedBanner + activePhotos.map(photo => {
    const isOwn = photo.userId === uid;
    const myVote = getMyVote(photo.id);
    const num    = getParticipantNumber(photo.userId);

    // Etiqueta del criteri (Creativitat/Temàtica/Composició): abans 11px
    // inline, il·legible — classe .vote-criteria-label (participant.css,
    // v0.1.30) puja mida i contrast per als socis.
    const starRow = (criteria, label) => {
      const val = myVote ? myVote[criteria] : 0;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <span class="vote-criteria-label">${label}</span>
          <div class="vote-stars" style="${starStyle}">
            ${[1,2,3,4,5].map(s => `<span class="star ${val>=s?'active':''}" onclick="handleStar('${photo.id}','${criteria}',${s},'${containerId}')" title="${s}">★</span>`).join('')}
          </div>
        </div>
      `;
    };

    return `
      <div class="vote-card ${myVote ? 'voted' : ''}" data-photo="${photo.id}">
        <img src="${photo.url}" alt="Foto ${num}" loading="lazy" onclick="openFullscreen('${photo.url}')" style="cursor:zoom-in;width:100%;display:block;max-height:280px;object-fit:contain;background:var(--surface);">
        <div class="vote-card-footer" style="flex-direction:column;align-items:stretch;gap:6px;">
          <div style="display:flex;justify-content:flex-end;align-items:center;min-height:16px;">
            ${myVote ? `<span style="font-size:11px;color:var(--success);">${t('voted_label')}</span>` : ''}
          </div>
          ${isOwn
            ? `<div style="font-size:12px;color:var(--accent);text-align:center;padding:6px 0;font-weight:600;">${t('your_photo')}</div>`
            : starRow('creativity',t('creativity')) + starRow('theme',t('theme')) + starRow('composition',t('composition'))
          }
        </div>
      </div>
    `;
  }).join('');
}

export async function handleStar(photoId, criteria, value, containerId) {
  // Block if voting closed or no active objective
  const hasActiveObj = state.objectives.some(o => o.status === 'active');
  if (!hasActiveObj || !state.settings.voting_enabled) {
    showToast(t('voting_closed_error'), 'error');
    return;
  }

  // Block if user has already submitted final voting for this objective
  const uid = state.currentUser ? state.currentUser.id : null;
  const objId = state.currentObjective ? state.currentObjective.id : null;
  if (uid && objId && isVotingSubmitted(uid, objId)) {
    showToast(t('already_voted_error'), 'error');
    return;
  }

  const myVote = getMyVote(photoId);
  const newVal = (myVote && myVote[criteria] === value) ? 0 : value;

  // 1) Update memory immediately (UI feels instant)
  setVoteCriteria(photoId, criteria, newVal);
  window._hasUnsavedVotes = true;

  // 2) Flash the clicked star BEFORE re-render
  const clickedStar = (typeof event !== 'undefined' && event && event.target) ? event.target : null;

  // 3) Re-render so the UI reflects the new value
  renderVotingGrid(containerId);

  // 4) Persist to Supabase in the background (autosave)
  const ok = await saveVoteOnClick(photoId, criteria, newVal);
  if (!ok) {
    showToast(t('vote_save_error'), 'error');
    return;
  }

  // 5) Apply flash animation to the matching star in the new DOM
  const card = document.querySelector(`.vote-card[data-photo="${photoId}"]`);
  if (card) {
    const rows = card.querySelectorAll('.vote-stars');
    const star = card.querySelector(`.star[onclick*="'${criteria}',${newVal}"]`);
    if (star) {
      star.classList.add('flash');
      setTimeout(() => star.classList.remove('flash'), 800);
    }
  }
}

export async function saveAdminVotes() {
  await submitFinalVoting('btn-save-admin-votes', () => {
    refreshAdminDashboard();
    renderAdminVotingGrid();
    renderRanking('ranking-current-list', 'ranking-general-list');
  });
}

export async function saveParticipantVotes() {
  await submitFinalVoting('btn-save-participant-votes', () => {
    renderRanking('p-ranking-current-list', 'p-ranking-general-list');
    renderVotingGrid('participant-voting-grid');
    refreshParticipantDashboard();
  });
}

// ═══════════════════════════════════
// FINAL SUBMIT — sets es_esborrany = FALSE in seguiment_votacio
// ═══════════════════════════════════
export async function submitFinalVoting(btnId, refreshCallback) {
  if (!state.currentUser || !state.currentObjective) return;
  const uid   = state.currentUser.id;
  const objId = state.currentObjective.id;

  // Guard: already submitted
  if (isVotingSubmitted(uid, objId)) {
    showToast(t('already_voted_error'), 'error');
    return;
  }

  // Count photos with NO stars in ANY criterion (excluding own photo)
  const activePhotos = getActivePublishedPhotos();
  let unvotedCount = 0;
  for (const photo of activePhotos) {
    if (photo.userId === uid) continue; // skip own photo
    const myVote = getMyVote(photo.id);
    const hasAnyStar = myVote && (myVote.creativity > 0 || myVote.theme > 0 || myVote.composition > 0);
    if (!hasAnyStar) unvotedCount++;
  }

  // Build modal message
  const title = t('confirm_send_vote_title');
  let msg;
  if (unvotedCount > 0) {
    msg = t('unvoted_photos_warning').replace('{count}', unvotedCount);
  } else {
    msg = t('confirm_send_vote_msg');
  }

  // Open confirm modal — reuses generic confirmAction
  confirmAction(title, msg, async () => {
    await doSubmitFinalVoting(btnId, uid, objId, refreshCallback);
  });
}

// Performs the actual UPDATE and UI lock
export async function doSubmitFinalVoting(btnId, uid, objId, refreshCallback) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.innerHTML = '<span class="loader"></span>'; btn.disabled = true; }
  showLoader(t('sending_vote_loader'));

  // 1 UPDATE — set es_esborrany = false for this user/objective
  const { error } = await sb
    .from('seguiment_votacio')
    .update({ es_esborrany: false, submitted_at: new Date().toISOString() })
    .eq('user_id', uid)
    .eq('objective_id', objId);

  hideLoader();

  if (error) {
    console.error('submitFinalVoting error', error);
    if (btn) { btn.innerHTML = t('save_votes_btn'); btn.disabled = false; }
    showToast(t('send_vote_error'), 'error');
    return;
  }

  // Update local state so the grid lock kicks in immediately (no extra fetch)
  const key = `${uid}__${objId}`;
  state.submittedVoting[key] = { es_esborrany: false, submitted_at: new Date().toISOString() };

  // Mark button green/locked
  markVoteButtonSaved(btn);

  // Re-render the appropriate panels
  if (typeof refreshCallback === 'function') refreshCallback();

  showToast(t('vote_sent_ok'), 'success');
}

// Mark a vote button as "saved" (green, permanent)
export function markVoteButtonSaved(btn) {
  if (!btn) return;
  btn.innerHTML = t('votes_sent_btn');
  btn.style.background = 'rgba(62,207,142,0.2)';
  btn.style.borderColor = 'var(--success)';
  btn.style.color = 'var(--success)';
  btn.disabled = true;
}

// Reset vote buttons to original state
export function resetVoteButtons() {
  const adminBtn = document.getElementById('btn-save-admin-votes');
  const partBtn  = document.getElementById('btn-save-participant-votes');
  [adminBtn, partBtn].forEach(btn => {
    if (!btn) return;
    btn.innerHTML = t('save_votes_btn');
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.color = '';
    btn.disabled = false;
  });
  updateVoteButtonsState();
}

// ── VOTE BUTTONS STATE — disable when objective finalized or voting closed ──
// Rèplica de l'estat de la capçalera (renderVotingHeader): si l'usuari ja ha
// enviat la votació per al repte actiu, el botó del peu ha de quedar amb el
// mateix aspecte i missatge que el banner superior (bloquejat, verd,
// "Vots Enviats"), no simplement "habilitat" com si encara pogués votar.
export function updateVoteButtonsState() {
  const hasActiveObj = state.objectives.some(o => o.status === 'active');
  const votingOpen = state.settings.voting_enabled;
  const uid = state.currentUser ? state.currentUser.id : null;
  const objId = state.currentObjective ? state.currentObjective.id : null;
  const submitted = (uid && objId) ? isVotingSubmitted(uid, objId) : false;
  const canVote = hasActiveObj && votingOpen && !submitted;

  // Admin save votes button
  const adminBtn = document.getElementById('btn-save-admin-votes');
  if (adminBtn) {
    if (submitted) {
      markVoteButtonSaved(adminBtn);
    } else {
      adminBtn.innerHTML = t('save_votes_btn');
      adminBtn.style.background = '';
      adminBtn.style.borderColor = '';
      adminBtn.style.color = '';
      adminBtn.disabled = !canVote;
      adminBtn.style.opacity = canVote ? '1' : '0.4';
      adminBtn.style.cursor = canVote ? 'pointer' : 'not-allowed';
    }
  }

  // Participant save votes button
  const partBtn = document.getElementById('btn-save-participant-votes');
  if (partBtn) {
    if (submitted) {
      markVoteButtonSaved(partBtn);
    } else {
      partBtn.innerHTML = t('save_votes_btn');
      partBtn.style.background = '';
      partBtn.style.borderColor = '';
      partBtn.style.color = '';
      partBtn.disabled = !canVote;
      partBtn.style.opacity = canVote ? '1' : '0.4';
      partBtn.style.cursor = canVote ? 'pointer' : 'not-allowed';
    }
  }
}

// Exponer en window las funciones usadas desde onclick del HTML
window.handleStar = handleStar;
window.saveAdminVotes = saveAdminVotes;
window.saveParticipantVotes = saveParticipantVotes;
// Exposada perquè applyTranslations() (i18n.js) repinti els mosaics de votació
// en canviar d'idioma (contingut dinàmic generat amb t()).
window._refreshVotingGrids = function () {
  renderAdminVotingGrid();
  renderVotingGrid('participant-voting-grid');
  // Capçalera de la pantalla de votació (v0.1.30, participant.js): repte,
  // estat d'enviament i recompte — també generada amb t(), també cal repintar.
  if (typeof window.renderVotingHeader === 'function') window.renderVotingHeader();
};
