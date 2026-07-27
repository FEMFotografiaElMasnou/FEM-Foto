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

  // Pas 4a (ANALISI_Login_Navegacio.md §1.4): l'admin per defecte i les tres
  // files d'app_settings es creen amb una sola RPC (fem_bootstrap_admin), que
  // només accepta executar-se mentre `users` està buida. Dos motius:
  //   · el compte ha d'existir TAMBÉ a auth.users, o el primer admin no podria
  //     establir mai sessió real d'Auth (i, per RLS, no podria escriure res);
  //   · l'ordre antic (crear l'admin i tot seguit inserir app_settings des del
  //     client) ja no funcionaria: la política app_settings_insert_bootstrap
  //     del Pas 3b exigeix que `users` estigui buida, i just abans hem deixat
  //     de complir-ho. Dins l'RPC, les dues coses passen a la mateixa crida.
  const { data: ok, error } = await sb.rpc('fem_bootstrap_admin', {
    p_name:     'Administrador',
    p_email:    'admin@femrank.cat',
    p_password: 'admin123',
  });

  if (!error && ok) {
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

  // Verificació al servidor (fem_login, funció SECURITY DEFINER a Supabase,
  // sql/2026-07-26_login_seguretat_fem_login.sql): el client ja no compara
  // la contrasenya en memòria ni necessita llegir-la — tanca l'exposició
  // detectada a ANALISI_Login_Navegacio.md §1.2 (qualsevol podia llegir-la
  // en clar via l'API pública).
  const { data: rows, error: rpcError } = await sb.rpc('fem_login', {
    p_identity: username,
    p_password: password,
  });

  if (rpcError) {
    console.error('fem_login error', rpcError);
    errEl.style.display = 'block';
    errEl.textContent   = t('generic_error');
    return;
  }

  const result = (rows && rows[0]) || { status: 'invalid' };

  // Contrasenya buida a la BD → admin l'ha reiniciat → força el flux de nova contrasenya.
  if (result.status === 'reset_required') {
    openNewPasswordModal({
      id: result.id, name: result.display_name, email: result.email, role: result.role,
    });
    return;
  }

  if (result.status !== 'ok') {
    errEl.style.display = 'block';
    errEl.textContent   = t('login_invalid');
    return;
  }

  const user = {
    id: result.id, name: result.display_name, email: result.email,
    username: result.email, role: result.role,
  };
  state.currentUser = user;
  saveSession(user);

  // Pas 3a de la migració a Supabase Auth (ANALISI_Login_Navegacio.md §1.4):
  // establim també una sessió real d'Auth EN PARAL·LEL al login existent, que
  // segueix sent l'únic que decideix si l'accés és vàlid (fem_login, més amunt).
  // Purament additiu: si falla (p.ex. l'usuari encara no té compte a auth.users,
  // o la contrasenya d'Auth ha quedat desincronitzada per un reset fet només a
  // public.users), no bloqueja ni altera el login d'avui — només ho registrem
  // per poder-ho diagnosticar durant les proves a Test.
  try {
    const { error: authError } = await sb.auth.signInWithPassword({ email: result.email, password });
    if (authError) console.warn('[Pas 3a] signInWithPassword no ha pogut establir sessió real:', authError.message);
  } catch (e) {
    console.warn('[Pas 3a] signInWithPassword ha fallat inesperadament:', e);
  }

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

  // Pas 3b (ANALISI_Login_Navegacio.md §1.4, decisió D3): un cop la RLS de
  // `users` només permet UPDATE a admins autenticats, aquest usuari (encara
  // sense sessió real d'Auth en aquest punt, ja que la seva contrasenya vella
  // és buida) no pot fer l'UPDATE directe. fem_set_new_password() és una via
  // SECURITY DEFINER que només accepta l'escriptura mentre la contrasenya
  // actual sigui buida (mateix invariant que 'reset_required' a fem_login).
  const { data: ok, error } = await sb.rpc('fem_set_new_password', {
    p_user_id: _pendingPasswordUser.id,
    p_new_password: p1,
  });

  if (error || !ok) {
    errEl.textContent = t('generic_error');
    errEl.style.display = 'block';
    return;
  }

  // Pas 3a: aquest camí (reset forçat) no passa per handleLogin(), així que
  // cal establir la sessió real d'Auth aquí també, ara amb la contrasenya
  // NOVA que l'usuari acaba de triar (l'antiga era buida a auth.users també).
  // Additiu/best-effort igual que a handleLogin: si falla, no bloqueja.
  try {
    const { error: authError } = await sb.auth.signInWithPassword({
      email: _pendingPasswordUser.email, password: p1,
    });
    if (authError) console.warn('[Pas 3a] signInWithPassword (post-reset) no ha pogut establir sessió real:', authError.message);
  } catch (e) {
    console.warn('[Pas 3a] signInWithPassword (post-reset) ha fallat inesperadament:', e);
  }

  // Update local state and proceed with login
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

  // Pas 4a (ANALISI_Login_Navegacio.md §1.4): l'alta ja no és un INSERT directe
  // a public.users. fem_register_account() crea, dins la mateixa transacció, la
  // fila de public.users I el compte d'auth.users — fins ara només es creava la
  // primera, i el soci nou quedava sense poder establir sessió real d'Auth (per
  // tant, sense poder votar ni pujar fotos des del Pas 3b/3c). El rol el fixa el
  // servidor a 'participant': no és un paràmetre, així que ningú pot crear-se un
  // admin cridant l'RPC directament per API.
  const { data: rows, error } = await sb.rpc('fem_register_account', {
    p_name:     name,
    p_email:    email,
    p_password: pass,
  });

  const result = (rows && rows[0]) || { status: 'invalid' };

  if (error || result.status !== 'ok') {
    hideLoader();
    errEl.style.display = 'block';
    errEl.textContent   = result.status === 'email_exists'
      ? t('register_email_exists')
      : t('register_error');
    if (error) console.error('fem_register_account error', error);
    btn.innerHTML = t('create_account_btn'); btn.disabled = false; return;
  }

  // Sessió real d'Auth per al compte acabat de crear (mateix patró que
  // handleLogin, Pas 3a). Sense això el soci nou entraria a l'app però qualsevol
  // escriptura seva (votar, pujar foto) la bloquejaria la RLS.
  try {
    const { error: authError } = await sb.auth.signInWithPassword({ email: result.email, password: pass });
    if (authError) console.warn('[Pas 4a] signInWithPassword (registre) no ha pogut establir sessió real:', authError.message);
  } catch (e) {
    console.warn('[Pas 4a] signInWithPassword (registre) ha fallat inesperadament:', e);
  }

  await loadAllData();
  const savedUser = state.users.find(u => u.email.toLowerCase() === result.email.toLowerCase());
  state.currentUser = savedUser || {
    id: result.id, name: result.display_name, email: result.email,
    username: result.email, role: result.role,
  };
  saveSession(state.currentUser);
  document.getElementById('reg-name').value  = '';
  document.getElementById('reg-email').value = '';
  document.getElementById('reg-pass').value  = '';
  document.getElementById('reg-pass2').value = '';
  hideLoader();
  showToast(t('account_created') + ', ' + name + ' 🎉', 'success');
  showParticipantScreen();

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

  // Pas 4a: la baixa passa per fem_delete_account(), que esborra la fila de
  // public.users I el compte d'auth.users alhora. Abans només s'esborrava la
  // primera, i el compte d'Auth quedava orfe: l'adreça quedava ocupada per
  // sempre i aquella persona no s'hauria pogut tornar a donar d'alta mai.
  // Les fotos i vots segueixen caient per CASCADE des de public.users.
  const { data: ok, error } = await sb.rpc('fem_delete_account', { p_user_id: uid });
  if (error || !ok) {
    console.error('fem_delete_account error', error);
    showToast(t('generic_error'), 'error');
    return;
  }

  // Tanca també la sessió d'Auth del compte acabat d'esborrar (el JWT seguiria
  // viu al navegador fins que caduqués, apuntant a un usuari que ja no existeix).
  try { await sb.auth.signOut(); } catch (_) {}

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
