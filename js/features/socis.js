// ═══════════════════════════════════
// SOCIS — tabla, edición inline, reset de contraseña y CRUD
// ═══════════════════════════════════
import { state } from '../core/state.js';
import { sb } from '../core/config.js';
import { t } from '../core/i18n.js';
import { showToast } from '../ui/toast.js';
import { openModal, closeModal, confirmAction } from '../ui/modals.js';
import { updateUser, loadAllData } from '../core/data.js';
import { renderAdminGallery } from './fotos.js';
import { refreshAdminDashboard } from '../screens/admin.js';

// ── INLINE MEMBER EDITS ──
export async function changeRole(userId, newRole) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  user.role = newRole;
  await updateUser(userId, { role: newRole });
  renderMembersTable();
  showToast(t('role_changed') + ' ✅', 'success');
}

export async function changeZampaRole(userId, newZampaRole) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  user.zampa_role = newZampaRole;
  await updateUser(userId, { zampa_role: newZampaRole });
  renderMembersTable();
  showToast(t('zampa_role_changed'), 'success');
}

export function inlineEditName(userId, el) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  const current = user.name;
  const input = document.createElement('input');
  input.value = current;
  input.style.cssText = 'background:var(--surface2);border:1px solid var(--accent);border-radius:6px;padding:4px 8px;color:var(--text);font-family:var(--font-body);font-size:14px;width:130px;outline:none;';
  el.replaceWith(input);
  input.focus();
  input.select();
  async function save() {
    const newName = input.value.trim();
    if (newName && newName !== current) {
      user.name = newName;
      await updateUser(userId, { display_name: newName });
      showToast(t('name_updated'), 'success');
    }
    renderMembersTable();
  }
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = current; input.blur(); }
  });
}

// ── PASSWORD RESET (admin) ──
export function resetMemberPassword(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;

  const msg = t('member_reset_confirm_msg').replace('{name}', user.name);

  // Reuse generic confirm modal
  document.getElementById('confirm-title').textContent = t('member_reset_confirm_title');
  document.getElementById('confirm-msg').textContent   = msg;
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = t('yes_btn');

  // Replace handler (clone trick to drop previous listeners)
  const newBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newBtn, okBtn);
  newBtn.addEventListener('click', async () => {
    closeModal('modal-confirm');
    await doResetMemberPassword(userId);
  });

  openModal('modal-confirm');
}

// 28/07/2026 — abans això era `update({ password: '' })` directe sobre `users`.
// Es va canviar perquè, comprovat en viu, aquell reset no revocava res i obria
// un forat:
//   · buidar `public.users.password` no toca `auth.users`, i des del Pas 4b
//     handleLogin() valida primer amb signInWithPassword() → la contrasenya
//     VELLA seguia entrant, i el modal de "crea'n una de nova" no s'obria mai;
//   · i mentre la contrasenya era buida, qualsevol amb la clau anon pública i
//     l'email del soci podia posar-n'hi una de nova (fem_set_new_password
//     només comprovava que la guardada fos buida) i entrar-hi.
// Ara el servidor genera una contrasenya temporal i l'escriu a les DUES taules
// alhora, tanca les sessions obertes del soci, i l'admin l'hi fa arribar.
// Vegeu `sql/2026-07-28_reset_admin_contrasenya_temporal.sql`.
export async function doResetMemberPassword(userId) {
  const user = state.users.find(u => u.id === userId);

  const { data: tempPassword, error } = await sb.rpc('fem_admin_reset_password', {
    p_user_id: userId,
  });

  // La RPC retorna NULL si qui la crida no és admin o si el soci no existeix.
  if (error || !tempPassword) {
    if (error) console.error('fem_admin_reset_password error', error);
    showToast(t('member_reset_error'), 'error');
    return;
  }

  renderMembersTable();
  openTempPasswordModal(user ? user.name : '', tempPassword);
}

// La contrasenya temporal es mostra un sol cop, en un modal i no en un toast:
// l'admin l'ha de poder llegir amb calma i copiar-la per enviar-la al soci.
// No queda enlloc més: `state.users` ja no porta contrasenyes (des del 26/07 el
// client no pot llegir la columna) i la BD només en guarda la temporal.
export function openTempPasswordModal(memberName, tempPassword) {
  document.getElementById('temp-pwd-msg').textContent =
    t('temp_pwd_msg').replace('{name}', memberName);
  document.getElementById('temp-pwd-value').textContent = tempPassword;
  const copyBtn = document.getElementById('temp-pwd-copy');
  if (copyBtn) copyBtn.textContent = t('temp_pwd_copy');
  openModal('modal-temp-password');
}

export async function copyTempPassword() {
  const value  = document.getElementById('temp-pwd-value').textContent;
  const btn    = document.getElementById('temp-pwd-copy');
  try {
    await navigator.clipboard.writeText(value);
    if (btn) btn.textContent = t('temp_pwd_copied');
  } catch (e) {
    // Sense permís de porta-retalls (o per http) no és cap error greu: la
    // contrasenya és a la pantalla i es pot seleccionar a mà.
    console.warn('No s\'ha pogut copiar al porta-retalls:', e);
    showToast(t('temp_pwd_copy_failed'), 'error');
  }
}

// ═══════════════════════════════════
// MEMBERS
// ═══════════════════════════════════
// Cercador de la pestanya Socis: un input compartit entre les dues
// subpestanyes (Usuaris app / Socis FEM), amb un terme guardat per cadascuna
// perquè canviar de subpestanya no esborri la cerca de l'altra.
let _activeMembersSubtab = 'appusers';
const _membersSearchTerm = { appusers: '', fem: '' };

function _updateMembersSearchCount(shown, total, term) {
  const countEl = document.getElementById('members-search-count');
  if (countEl) countEl.textContent = term ? `${shown} / ${total}` : '';
}

export function filterMembers(term) {
  _membersSearchTerm[_activeMembersSubtab] = term || '';
  if (_activeMembersSubtab === 'fem') renderSocisFemTable();
  else renderMembersTable();
}

export function renderMembersTable() {
  const tbody = document.getElementById('members-tbody');
  const term  = _membersSearchTerm.appusers.trim().toLowerCase();
  const users = term
    ? state.users.filter(u =>
        (u.name || '').toLowerCase().includes(term) ||
        String(u.email || u.username || '').toLowerCase().includes(term))
    : state.users;

  if (_activeMembersSubtab === 'appusers') _updateMembersSearchCount(users.length, state.users.length, term);
  const countEl = document.getElementById('members-count');
  if (countEl) countEl.textContent = `(${state.users.length})`;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">${t(term ? 'no_members_found' : 'no_members')}</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map((u) => {
    const isSelf = u.id === state.currentUser.id;
    return `
      <tr>
        <td>
          <span
            style="cursor:pointer;border-bottom:1px dashed var(--border);padding-bottom:1px;"
            onclick="inlineEditName('${u.id}', this)"
            title="${t('edit_name_tooltip')}"
          >${u.name}</span>
        </td>
        <td style="font-family:var(--font-mono);font-size:12px;">${u.email || u.username}</td>
        <td>
          <select
            class="field-compact"
            onchange="changeRole('${u.id}', this.value)"
            title="${isSelf ? t('no_change_own_role') : t('edit_role_tooltip')}"
            ${isSelf ? 'disabled' : ''}
          >
            <option value="participant" ${u.role==='participant'?'selected':''}>${t('member_role_option')}</option>
            <option value="expert" ${u.role==='expert'?'selected':''}>${t('expert_role_option')}</option>
            <option value="admin" ${u.role==='admin'?'selected':''}>${t('admin_role_option')}</option>
          </select>
        </td>
        <td>
          <select class="field-compact" onchange="changeZampaRole('${u.id}', this.value)" title="${t('edit_zampa_role_tooltip')}">
            <option value="user" ${u.zampa_role==='user'?'selected':''}>${t('zampa_role_user_option')}</option>
            <option value="editor" ${u.zampa_role==='editor'?'selected':''}>${t('zampa_role_editor_option')}</option>
            <option value="admin" ${u.zampa_role==='admin'?'selected':''}>${t('zampa_role_admin_option')}</option>
          </select>
        </td>
        <td style="display:flex;gap:6px;align-items:center;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="openMemberModal('${u.id}')" title="${t('edit_member_tooltip')}" style="padding:4px 10px;font-size:13px;">✏️</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="resetMemberPassword('${u.id}')" title="${t('reset_pwd_tooltip')}" style="padding:4px 10px;font-size:13px;">🔄 ${t('member_reset_pwd')}</button>
          <button type="button" class="btn btn-danger btn-sm" onclick="deleteMember('${u.id}')">${t("delete_btn")}</button>
        </td>
      </tr>
    `;
  }).join('');
}

export function openMemberModal(id) {
  document.getElementById('member-edit-id').value = id || '';
  if (id) {
    const u = state.users.find(u => u.id === id);
    document.getElementById('member-modal-title').textContent = t('edit_member_title');
    document.getElementById('member-name').value     = u.name;
    document.getElementById('member-username').value = u.email || u.username;
    // Sempre buit (2026-07-26): el client ja no rep la contrasenya real
    // (columna no llegible, vegeu sql/2026-07-26_login_seguretat_fem_login.sql)
    // — buit vol dir "no canviar-la", igual que ja interpreta saveMember().
    document.getElementById('member-password').value = '';
    document.getElementById('member-role').value     = u.role;
  } else {
    document.getElementById('member-modal-title').textContent = t('new_member_btn');
    ['member-name','member-username','member-password'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('member-role').value = 'participant';
  }
  openModal('modal-member');
}

export async function saveMember() {
  const id       = document.getElementById('member-edit-id').value;
  const name     = document.getElementById('member-name').value.trim();
  const email    = document.getElementById('member-username').value.trim();
  const password = document.getElementById('member-password').value;
  const role     = document.getElementById('member-role').value;

  if (!name || !email) { showToast(t('name_email_required'), 'error'); return; }

  if (id) {
    // Edit existing member — single row update
    const prev = state.users.find(u => u.id === id);
    const emailChanged = !prev || String(prev.email || '').toLowerCase() !== email.toLowerCase();

    const { error } = await sb.from('users').update({ display_name: name, role }).eq('id', id);
    if (error) {
      showToast('❌ Error', 'error');
      return;
    }

    // Pas 4b (ANALISI_Login_Navegacio.md §1.4): l'email va per una RPC a part
    // (fem_admin_set_email) perquè també el canviï a auth.users. Ara que
    // l'accés el decideix Supabase Auth i la identitat es resol per email, un
    // UPDATE només a public.users deixaria aquest soci sense poder iniciar
    // sessió real amb la seva adreça nova — i, per RLS, sense poder escriure.
    if (emailChanged) {
      const { data: okEmail, error: emailErr } = await sb.rpc('fem_admin_set_email', {
        p_user_id: id, p_new_email: email,
      });
      if (emailErr || !okEmail) {
        if (emailErr) console.error('fem_admin_set_email error', emailErr);
        showToast(t('email_exists'), 'error');
        return;
      }
    }
    // Pas 3b (ANALISI_Login_Navegacio.md §1.4): la contrasenya, si es canvia,
    // va per una RPC a part (fem_admin_set_password) perquè també sincronitzi
    // auth.users — un UPDATE directe des del client deixaria l'usuari afectat
    // sense poder establir mai més una sessió real d'Auth (Pas 3a).
    if (password) {
      const { data: ok, error: pwErr } = await sb.rpc('fem_admin_set_password', {
        p_user_id: id, p_new_password: password,
      });
      if (pwErr || !ok) {
        showToast('❌ Error canviant la contrasenya', 'error');
        return;
      }
    }
    // Update local state
    const u = state.users.find(u => u.id === id);
    if (u) { u.name = name; u.email = email; u.username = email; u.role = role; if (password) u.password = password; }
  } else {
    // New member — Pas 4a (ANALISI_Login_Navegacio.md §1.4): l'alta ja no és un
    // INSERT directe. fem_admin_create_member() crea la fila de public.users I
    // el compte d'auth.users dins la mateixa transacció; sense la segona, el
    // soci nou no podria establir sessió real d'Auth i la RLS del Pas 3b li
    // bloquejaria qualsevol escriptura (votar, pujar foto).
    // No es fa amb supabase.auth.signUp() a propòsit: signUp() substituiria la
    // sessió de l'admin per la del compte acabat de crear.
    if (!password) { showToast(t('pass_required'), 'error'); return; }
    const { data: rows, error } = await sb.rpc('fem_admin_create_member', {
      p_name: name, p_email: email, p_password: password, p_role: role,
    });
    const created = (rows && rows[0]) || { status: 'invalid' };
    if (error || created.status !== 'ok') {
      if (error) console.error('fem_admin_create_member error', error);
      showToast(created.status === 'email_exists' ? t('email_exists') : '❌ Error', 'error');
      return;
    }
    state.users.push({
      id: created.id, name: created.display_name, email: created.email,
      username: created.email, role: created.role, created_at: created.created_at,
    });
  }

  closeModal('modal-member');
  renderMembersTable();
  showToast(t('member_saved'), 'success');
}

export async function deleteMember(id) {
  if (id === state.currentUser.id) { showToast(t('no_delete_self'), 'error'); return; }
  const user = state.users.find(u => u.id === id);
  const userName = user ? user.name : id;
  confirmAction(t('delete_member'), t('confirm_delete_member').replace('{name}', userName), async () => {
    // Pas 4a: mateixa RPC que la baixa pròpia (handleUnsubscribe) — esborra la
    // fila de public.users I el compte d'auth.users, per no deixar-lo orfe i
    // bloquejar aquella adreça per sempre. Fotos i vots segueixen caient per
    // CASCADE des de public.users.
    const { data: ok, error } = await sb.rpc('fem_delete_account', { p_user_id: id });
    if (error || !ok) {
      console.error('fem_delete_account error', error);
      showToast('❌ Error', 'error');
      return;
    }
    await loadAllData();
    renderMembersTable();
    renderAdminGallery();
    refreshAdminDashboard();
    showToast(t('member_deleted'), 'success');
  });
}

// ═══════════════════════════════════
// SOCIS FEM AUTORITZATS — cens que filtra l'auto-registre
// (sql/2026-08-02_socis_fem_autoritzats.sql)
// ═══════════════════════════════════
// Subpestanya dins "Socis". Els botons commuten .subtab-content (no
// .tab-content: switchTab() de router.js cerca .tab-content per descendents,
// i reutilitzar la mateixa classe aquí faria que canviar de pestanya
// principal desactivés totes dues subpestanyes sense reactivar-ne cap).
export function showMembersSubTab(tab) {
  document.querySelectorAll('#admin-tab-members .subtab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#admin-tab-members .tab-nav .tab-btn').forEach(btn => btn.classList.remove('active'));
  const content = document.getElementById(`members-subtab-${tab}`);
  const btn     = document.getElementById(`members-subtab-btn-${tab}`);
  if (content) content.classList.add('active');
  if (btn) btn.classList.add('active');

  _activeMembersSubtab = tab;
  const searchInput = document.getElementById('members-search');
  if (searchInput) searchInput.value = _membersSearchTerm[tab];

  // Es carrega a demanda, no dins loadAllData(): la RLS només la deixa
  // llegir a un admin, així que per a qualsevol participant seria una
  // consulta buida i inútil en cada auto-refresh.
  if (tab === 'fem') loadSocisFemAutoritzats();
  else renderMembersTable();
}

export async function loadSocisFemAutoritzats() {
  const { data, error } = await sb.from('socis_fem_autoritzats')
    .select('email,rol_per_defecte,created_at')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('loadSocisFemAutoritzats error', error);
    showToast(t('socis_fem_generic_error'), 'error');
    return;
  }
  state.socisAutoritzats = data || [];
  renderSocisFemTable();
}

export function renderSocisFemTable() {
  const tbody = document.getElementById('socis-fem-tbody');
  if (!tbody) return;
  const term = _membersSearchTerm.fem.trim().toLowerCase();
  const rows = term
    ? state.socisAutoritzats.filter(s => (s.email || '').toLowerCase().includes(term))
    : state.socisAutoritzats;

  if (_activeMembersSubtab === 'fem') _updateMembersSearchCount(rows.length, state.socisAutoritzats.length, term);
  const countEl = document.getElementById('socis-fem-count');
  if (countEl) countEl.textContent = `(${state.socisAutoritzats.length})`;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);">${t(term ? 'no_members_found' : 'socis_fem_empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(s => `
    <tr>
      <td style="font-family:var(--font-mono);font-size:12px;">${s.email}</td>
      <td>
        <select class="field-compact" onchange="changeSociFemRole('${s.email}', this.value)">
          <option value="participant" ${s.rol_per_defecte==='participant'?'selected':''}>${t('member_role_option')}</option>
          <option value="expert" ${s.rol_per_defecte==='expert'?'selected':''}>${t('expert_role_option')}</option>
          <option value="admin" ${s.rol_per_defecte==='admin'?'selected':''}>${t('admin_role_option')}</option>
        </select>
      </td>
      <td style="color:var(--text-muted);font-size:12px;">${s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}</td>
      <td><button type="button" class="btn btn-danger btn-sm" onclick="removeSociFemAutoritzat('${s.email}')">${t('delete_btn')}</button></td>
    </tr>
  `).join('');
}

export async function addSociFemAutoritzat() {
  const emailInput = document.getElementById('socis-fem-new-email');
  const roleSelect = document.getElementById('socis-fem-new-role');
  const email = emailInput.value.trim().toLowerCase();
  const role  = roleSelect.value;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast(t('socis_fem_invalid_email'), 'error');
    return;
  }
  if (state.socisAutoritzats.some(s => s.email === email)) {
    showToast(t('socis_fem_duplicate'), 'error');
    return;
  }

  const { error } = await sb.from('socis_fem_autoritzats').insert({ email, rol_per_defecte: role });
  if (error) {
    console.error('addSociFemAutoritzat error', error);
    showToast(t('socis_fem_generic_error'), 'error');
    return;
  }

  emailInput.value = '';
  roleSelect.value = 'participant';
  await loadSocisFemAutoritzats();
  showToast(t('socis_fem_added_toast'), 'success');
}

export async function changeSociFemRole(email, newRole) {
  const { error } = await sb.from('socis_fem_autoritzats').update({ rol_per_defecte: newRole }).eq('email', email);
  if (error) {
    console.error('changeSociFemRole error', error);
    showToast(t('socis_fem_generic_error'), 'error');
    return;
  }
  const row = state.socisAutoritzats.find(s => s.email === email);
  if (row) row.rol_per_defecte = newRole;
  showToast(t('socis_fem_role_changed_toast'), 'success');
}

export function removeSociFemAutoritzat(email) {
  confirmAction(
    t('socis_fem_remove_confirm_title'),
    t('socis_fem_remove_confirm_msg').replace('{email}', email),
    async () => {
      const { error } = await sb.from('socis_fem_autoritzats').delete().eq('email', email);
      if (error) {
        console.error('removeSociFemAutoritzat error', error);
        showToast(t('socis_fem_generic_error'), 'error');
        return;
      }
      await loadSocisFemAutoritzats();
      showToast(t('socis_fem_removed_toast'), 'success');
    }
  );
}

// Exponer en window las funciones usadas desde onclick del HTML
window.showMembersSubTab = showMembersSubTab;
window.filterMembers = filterMembers;
// Exposada perquè applyTranslations() (i18n.js) repinti aquesta taula en
// canviar d'idioma (el select de rol es genera amb t(), no amb data-i18n).
window._refreshSocisFemTable = renderSocisFemTable;
window.addSociFemAutoritzat = addSociFemAutoritzat;
window.changeSociFemRole = changeSociFemRole;
window.removeSociFemAutoritzat = removeSociFemAutoritzat;
window.changeRole = changeRole;
window.changeZampaRole = changeZampaRole;
window.inlineEditName = inlineEditName;
window.resetMemberPassword = resetMemberPassword;
window.copyTempPassword = copyTempPassword;
window.deleteMember = deleteMember;
window.openMemberModal = openMemberModal;
window.saveMember = saveMember;
// Exposada perquè applyTranslations() (i18n.js) repinti la taula de socis en
// canviar d'idioma (el seu contingut es genera dinàmicament amb t()).
window._refreshMembersTable = renderMembersTable;
