// ═══════════════════════════════════
// PANTALLA LOGIN — acceso, registro, init, logout y contraseña forzada
// ═══════════════════════════════════
import { state } from '../core/state.js';
import { sb, _dbMode } from '../core/config.js';
import { t, applyTranslations } from '../core/i18n.js';
import { showToast, showLoader, hideLoader } from '../ui/toast.js';
import { openModal, closeModal, confirmAction } from '../ui/modals.js';
import { loadAllData, loadAppTexts } from '../core/data.js';
import { showScreen, showAdminScreen, showParticipantScreen, stopAutoRefresh } from '../core/router.js';

// ═══════════════════════════════════
// PERSISTÈNCIA DE SESSIÓ (sessionStorage)
// ═══════════════════════════════════
// Manté la sessió mentre la pestanya estigui oberta; s'esborra en tancar-la o en
// fer logout. Evita haver de tornar a fer login en recarregar (F5). NO es desa
// mai la contrasenya: només id, name i role (dades no sensibles).
const SESSION_KEY = 'fem_user';
function saveSession(user) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, name: user.name, role: user.role }));
  } catch (_) {}
}
function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; }
}
function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
}

// ═══════════════════════════════════
// INIT
// ═══════════════════════════════════
export async function init() {
  showLoader(t('connecting'));
  try {
    // Dades i textos en paral·lel: loadAppTexts() no bloqueja si triga o falla
    // (es queda amb el diccionari estàtic de i18n.js com a xarxa de seguretat).
    await Promise.all([loadAllData(), loadAppTexts()]);
  } catch(e) {
    console.error('init error:', e);
    showToast(t('supabase_connect_error_short'), 'error');
  }

  hideLoader();

  if (state.users.length === 0) {
    document.getElementById('setup-banner').style.display = 'block';
  }

  // Restaurar sessió guardada (evita re-login en recarregar la pàgina)
  const saved = readSession();
  if (saved && saved.id) {
    // Busquem l'usuari complet a state.users (carregat de Supabase) en lloc de
    // confiar cegament en el desat: si l'admin li ha canviat el rol, es reflecteix.
    const fullUser = state.users.find(u => u.id === saved.id);
    if (fullUser) {
      state.currentUser = fullUser;
      applyTranslations();
      if (fullUser.role === 'admin') showAdminScreen();
      else showParticipantScreen();
      return; // no mostrem la pantalla de login
    }
    clearSession(); // sessió invàlida (l'usuari ja no existeix)
  }

  applyTranslations();
}

export async function initializeDB() {
  const btn = document.getElementById('btn-init');
  btn.innerHTML = '<span class="loader"></span> ' + t('init_db_loader');
  btn.disabled  = true;

  const now = new Date().toISOString();

  // Insert default admin
  const { error } = await sb.from('users').upsert([{
    id:           'u_admin_1',
    display_name: 'Administrador',
    email:        'admin@femrank.cat',
    role:         'admin',
    password:     'admin123',
    created_at:   now,
  }], { onConflict: 'id' });

  // Init settings
  await sb.from('app_settings').upsert([
    { id: 'cfg_uploads',  key: 'uploads_enabled', value: 'true',  updated_at: now, updated_by: 'system' },
    { id: 'cfg_voting',   key: 'voting_enabled',  value: 'false', updated_at: now, updated_by: 'system' },
    { id: 'cfg_revealed', key: 'names_revealed',   value: 'false', updated_at: now, updated_by: 'system' },
  ], { onConflict: 'id' });

  if (!error) {
    await loadAllData();
    document.getElementById('setup-banner').style.display = 'none';
    document.getElementById('login-user').value = 'admin@femrank.cat';
    document.getElementById('login-pass').value  = 'admin123';
    showToast(t('db_initialized'), 'success');
  } else {
    btn.innerHTML = t('init_db_btn');
    btn.disabled  = false;
    showToast(t('sheets_error'), 'error');
  }
}

// ═══════════════════════════════════
// LOGIN
// ═══════════════════════════════════
export async function handleLogin() {
  const username  = document.getElementById('login-user').value.trim();
  const password  = document.getElementById('login-pass').value;
  const errEl     = document.getElementById('login-error');
  const btn       = document.getElementById('login-btn');

  errEl.style.display = 'none';

  if (!username || !password) {
    errEl.style.display   = 'block';
    errEl.textContent     = t('login_fill_fields');
    return;
  }

  btn.innerHTML = '<span class="loader"></span> ' + t('checking_loader');
  btn.disabled  = true;

  // Only reload from Supabase if data is not already in memory (init() already loaded it)
  if (state.users.length === 0) {
    showLoader(t('connecting'));
    try {
      await loadAllData();
    } catch(e) {
      console.error('Login loadAllData error:', e);
    }
    hideLoader();
  }

  btn.innerHTML = t('enter_btn');
  btn.disabled  = false;

  if (state.users.length === 0) {
    document.getElementById('setup-banner').style.display = 'block';
    errEl.style.display = 'block';
    errEl.textContent   = t('no_users_found');
    return;
  }

  // Match by email, username, or display name — case-insensitive
  const input = username.toLowerCase().trim();
  const pass  = String(password).trim();

  // First, find the user by identity (without password check) to detect reset state
  const userByIdentity = state.users.find(u =>
    u.email.toLowerCase().trim() === input ||
    u.username.toLowerCase().trim() === input ||
    u.name.toLowerCase().trim() === input
  );

  // If user exists but password is empty in DB → admin has reset it → force new-password flow.
  if (userByIdentity && String(userByIdentity.password || '').trim() === '') {
    openNewPasswordModal(userByIdentity);
    return;
  }

  const user = state.users.find(u =>
    (u.email.toLowerCase().trim() === input ||
     u.username.toLowerCase().trim() === input ||
     u.name.toLowerCase().trim() === input) &&
    String(u.password).trim() === pass
  );

  if (!user) {
    errEl.style.display = 'block';
    errEl.textContent   = t('login_invalid');
    return;
  }

  state.currentUser = user;
  saveSession(user);
  if (user.role === 'admin') {
    showAdminScreen();
  } else {
    showParticipantScreen();
  }
}

// Entra directament com l'usuari amb aquest email (sense demanar contrasenya).
// L'usem en canviar a mode TEST: qui prem el botó ja és un admin autenticat, així
// que reentrem amb el mateix email a la BD de proves sense re-login. Retorna
// true si ha trobat l'usuari i ha entrat; false si no existeix en aquesta BD.
export function enterAsEmail(email) {
  if (!email) return false;
  const target = String(email).toLowerCase().trim();
  const u = state.users.find(x => String(x.email || '').toLowerCase().trim() === target);
  if (!u) return false;
  state.currentUser = u;
  saveSession(u);
  applyTranslations();
  if (u.role === 'admin') showAdminScreen();
  else showParticipantScreen();
  return true;
}

export function logout() {
  stopAutoRefresh();
  state.currentUser = null;
  clearSession();
  state.adminViewingAsParticipant = false;
  showScreen('login');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value  = '';
  // Show/hide TEST mode banner on login screen
  const testBanner = document.getElementById('login-test-banner');
  if (testBanner) testBanner.style.display = _dbMode === 'test' ? 'block' : 'none';
}

// ═══════════════════════════════════
// FORCED NEW PASSWORD (member, after admin reset)
// ═══════════════════════════════════
let _pendingPasswordUser = null;

export function openNewPasswordModal(user) {
  _pendingPasswordUser = user;
  document.getElementById('new-pwd-input').value = '';
  document.getElementById('new-pwd-repeat-input').value = '';
  document.getElementById('new-pwd-error').style.display = 'none';
  openModal('modal-new-password');
  setTimeout(() => document.getElementById('new-pwd-input').focus(), 100);
}

export async function saveNewPassword() {
  const p1 = document.getElementById('new-pwd-input').value;
  const p2 = document.getElementById('new-pwd-repeat-input').value;
  const errEl = document.getElementById('new-pwd-error');

  if (!p1 || p1.length < 4) {
    errEl.textContent = t('new_pwd_short');
    errEl.style.display = 'block';
    return;
  }
  if (p1 !== p2) {
    errEl.textContent = t('new_pwd_mismatch');
    errEl.style.display = 'block';
    return;
  }
  if (!_pendingPasswordUser) return;

  const { error } = await sb.from('users')
    .update({ password: p1 })
    .eq('id', _pendingPasswordUser.id);

  if (error) {
    errEl.textContent = t('generic_error');
    errEl.style.display = 'block';
    return;
  }

  // Update local state and proceed with login
  _pendingPasswordUser.password = p1;
  state.currentUser = _pendingPasswordUser;
  saveSession(_pendingPasswordUser);
  closeModal('modal-new-password');

  if (_pendingPasswordUser.role === 'admin') {
    showAdminScreen();
  } else {
    showParticipantScreen();
  }
  _pendingPasswordUser = null;
}

// ═══════════════════════════════════
// REGISTER / UNSUBSCRIBE
// ═══════════════════════════════════
export function showLoginTab() {
  document.getElementById('form-login').style.display    = 'block';
  document.getElementById('form-register').style.display = 'none';
  document.getElementById('tab-login').classList.add('active-tab');
  document.getElementById('tab-register').classList.remove('active-tab');
  document.getElementById('login-error').style.display   = 'none';
}

export function showRegisterTab() {
  document.getElementById('form-login').style.display    = 'none';
  document.getElementById('form-register').style.display = 'block';
  document.getElementById('tab-register').classList.add('active-tab');
  document.getElementById('tab-login').classList.remove('active-tab');
  document.getElementById('login-error').style.display   = 'none';
}

export async function handleRegister() {
  const name   = document.getElementById('reg-name').value.trim();
  const email  = document.getElementById('reg-email').value.trim().toLowerCase();
  const pass   = document.getElementById('reg-pass').value;
  const pass2  = document.getElementById('reg-pass2').value;
  const errEl  = document.getElementById('login-error');
  const btn    = document.getElementById('register-btn');

  errEl.style.display = 'none';

  // Validations
  if (!name || !email || !pass || !pass2) {
    errEl.style.display = 'block'; errEl.textContent = t('register_fill_fields'); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.style.display = 'block'; errEl.textContent = t('register_invalid_email'); return;
  }
  if (pass.length < 6) {
    errEl.style.display = 'block'; errEl.textContent = t('register_pass_short'); return;
  }
  if (pass !== pass2) {
    errEl.style.display = 'block'; errEl.textContent = t('register_pass_mismatch'); return;
  }

  btn.innerHTML = '<span class="loader"></span> ' + t('registering_loader');
  btn.disabled  = true;
  showLoader(t('creating_account'));

  const newUser = {
    id:         'u_' + Date.now(),
    name,
    email,
    username:   email,
    password:   pass,
    role:       'participant',
    created_at: new Date().toISOString(),
  };

  // Insert — Supabase UNIQUE constraint on email handles duplicates
  const { error } = await sb.from('users').insert([{
    id:           newUser.id,
    display_name: newUser.name,
    email:        newUser.email,
    role:         newUser.role,
    password:     newUser.password,
    created_at:   newUser.created_at,
  }]);

  if (error && error.code === '23505') {
    // Duplicate email
    hideLoader();
    errEl.style.display = 'block';
    errEl.textContent   = t('register_email_exists');
    btn.innerHTML = t('create_account_btn'); btn.disabled = false; return;
  }

  if (!error) {
    await loadAllData();
    const savedUser = state.users.find(u => u.email.toLowerCase() === newUser.email.toLowerCase());
    state.currentUser = savedUser || newUser;
    saveSession(state.currentUser);
    document.getElementById('reg-name').value  = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-pass').value  = '';
    document.getElementById('reg-pass2').value = '';
    hideLoader();
    showToast(t('account_created') + ', ' + name + ' 🎉', 'success');
    showParticipantScreen();
  } else {
    errEl.style.display = 'block';
    errEl.textContent   = t('register_error');
  }

  hideLoader();
  btn.innerHTML = t('create_account_btn'); btn.disabled = false;
}

export function confirmUnsubscribe() {
  confirmAction(
    t('unsubscribe_title'),
    t('unsubscribe_msg'),
    handleUnsubscribe
  );
}

export async function handleUnsubscribe() {
  if (!state.currentUser) return;
  const uid = state.currentUser.id;

  // CASCADE on FK will auto-delete photos and votes
  await sb.from('users').delete().eq('id', uid);

  showToast(t('account_deleted'), 'info');
  await new Promise(r => setTimeout(r, 1500));
  logout();
}

// Exponer en window las funciones usadas desde onclick del HTML
window.handleLogin = handleLogin;
window.logout = logout;
window.initializeDB = initializeDB;
window.saveNewPassword = saveNewPassword;
window.showLoginTab = showLoginTab;
window.showRegisterTab = showRegisterTab;
window.handleRegister = handleRegister;
window.confirmUnsubscribe = confirmUnsubscribe;
window.init = init;
