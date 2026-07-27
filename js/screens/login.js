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
// PERSISTÈNCIA DE SESSIÓ
// ═══════════════════════════════════
// Pas 4b (ANALISI_Login_Navegacio.md §1.4): la sessió REAL és ara la de Supabase
// Auth, que el propi SDK desa a localStorage amb una clau per projecte (Normal i
// Test no es trepitgen). Per decisió d'Enric (27/07/2026) la sessió és
// PERSISTENT: qui entra hi segueix fins que prem "Sortir" — abans, tancar la
// pestanya tancava la sessió.
//
// El sessionStorage antic es manté NOMÉS com a xarxa de seguretat per al camí
// de reserva (fem_login sense sessió d'Auth, vegeu handleLogin): així, si per
// algun motiu Auth no pogués establir sessió, el comportament no empitjora
// respecte d'abans. Mai s'hi desa la contrasenya: només id, name i role.
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

// Perfil complet de `state.users` a partir de l'email de la sessió d'Auth.
// Es fa per email i no per l'UUID d'Auth perquè el client no té permís de
// lectura sobre `users.auth_user_id` (Fase 1.3: només es concedeix SELECT de
// les columnes no sensibles) — i l'email és únic a la taula igualment.
function _profileByEmail(email) {
  if (!email) return null;
  const target = String(email).toLowerCase().trim();
  return state.users.find(u => String(u.email || '').toLowerCase().trim() === target) || null;
}

// Sessió d'Auth vàlida en aquest navegador per al projecte actiu, si n'hi ha.
async function _authSessionEmail() {
  try {
    const { data } = await sb.auth.getSession();
    return (data && data.session && data.session.user && data.session.user.email) || null;
  } catch (_) {
    return null;
  }
}

// Entra a l'app amb un usuari ja resolt (comú a tots els camins d'accés).
function _enterApp(user) {
  state.currentUser = user;
  saveSession(user);
  applyTranslations();
  if (user.role === 'admin') showAdminScreen();
  else showParticipantScreen();
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

  _listenAuthChanges();

  // Pas 4b: la sessió de Supabase Auth mana. Si n'hi ha una de vàlida en aquest
  // navegador, s'entra directament sense demanar res (sessió persistent). El
  // perfil (nom, rol) es torna a llegir SEMPRE de state.users, mai del que
  // hi hagués desat: si l'admin ha canviat el rol, es reflecteix a l'instant.
  const authEmail = await _authSessionEmail();
  if (authEmail) {
    const fullUser = _profileByEmail(authEmail);
    if (fullUser) {
      _enterApp(fullUser);
      return; // no mostrem la pantalla de login
    }
    // Sessió d'Auth d'algú que ja no té fila a public.users (baixa feta des
    // d'un altre dispositiu): es tanca perquè no quedi una identitat morta.
    await signOutSilently();
    clearSession();
  }

  // Xarxa de seguretat: sessió antiga de sessionStorage (només hi arriba qui ha
  // entrat pel camí de reserva de handleLogin, sense sessió real d'Auth).
  const saved = readSession();
  if (saved && saved.id) {
    const fullUser = state.users.find(u => u.id === saved.id);
    if (fullUser) {
      _enterApp(fullUser);
      return;
    }
    clearSession(); // sessió invàlida (l'usuari ja no existeix)
  }

  applyTranslations();
}

// ═══════════════════════════════════
// CANVIS D'ESTAT DE LA SESSIÓ D'AUTH
// ═══════════════════════════════════
// Pas 4b. Ens interessa un cas concret: que la sessió caduqui o es tanqui
// (token de refresc invalidat, logout fet en una altra pestanya). Sense això
// l'app es quedaria oberta amb una identitat morta i totes les escriptures
// fallarien en silenci per RLS. La resta d'esdeveniments (SIGNED_IN,
// TOKEN_REFRESHED, INITIAL_SESSION) no requereixen fer res: el SDK ja manté
// el token al dia tot sol.
//
// _selfSignOut evita el bucle amb el nostre propi logout(), que ja porta
// l'usuari a la pantalla d'accés pel seu compte.
let _selfSignOut = false;

// Tanca la sessió sense que el listener de sota ho interpreti com una caiguda
// externa. `client` permet actuar sobre un client concret (config.js el fa
// servir en canviar de base de dades, quan `sb` ja apunta a l'altre projecte).
export async function signOutSilently(client) {
  const target = client || sb;
  if (!target || !target.auth) return;
  try {
    _selfSignOut = true;
    await target.auth.signOut();
  } catch (e) {
    console.warn('[Pas 4b] signOut ha fallat:', e);
  } finally {
    _selfSignOut = false;
  }
}

// El client es recrea en canviar de base de dades (switchDbMode), així que el
// listener s'ha de tornar a enganxar al client nou — d'aquí la comparació amb
// el client al qual ja el tenim enganxat, en lloc d'un simple booleà.
let _authListenerClient = null;
export function _listenAuthChanges() {
  if (!sb || !sb.auth || _authListenerClient === sb) return;
  _authListenerClient = sb;
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && !_selfSignOut && state.currentUser) {
      console.warn('[Pas 4b] Sessió d\'Auth tancada externament; es torna a la pantalla d\'accés.');
      _resetToLoginScreen();
      showToast(t('session_expired'), 'error');
    }
    // Pas 4c hi enganxarà aquí l'esdeveniment PASSWORD_RECOVERY (enllaç de
    // "he oblidat la contrasenya") per obrir la pantalla de nova contrasenya.
  });
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

  // ── Pas 4b: Supabase Auth és qui decideix l'accés ──────────────────────────
  // El camp "Usuari / Email" accepta indistintament l'email o el nom complet,
  // però signInWithPassword() només entén emails. Si no és un email, resolem
  // el nom contra state.users (lectura ja permesa, sense la contrasenya).
  let email = username.includes('@') ? username.toLowerCase() : null;
  if (!email) {
    const byName = state.users.find(
      u => String(u.name || '').toLowerCase().trim() === username.toLowerCase()
    );
    if (byName) email = String(byName.email || '').toLowerCase();
  }

  if (email) {
    const { error: authError } = await sb.auth.signInWithPassword({ email, password });
    if (!authError) {
      const profile = _profileByEmail(email);
      if (profile) {
        _enterApp(profile);
        return;
      }
      // Compte d'Auth sense fila a public.users: estat inconsistent, no el
      // deixem entrar a mitges (l'app necessita el perfil per saber-ne el rol).
      await signOutSilently();
      console.error('[Pas 4b] Sessió d\'Auth vàlida però sense perfil a public.users:', email);
      errEl.style.display = 'block';
      errEl.textContent   = t('generic_error');
      return;
    }
  }

  // ── Camí de reserva: fem_login() ──────────────────────────────────────────
  // Cobreix dos casos legítims: (a) la contrasenya reiniciada per un admin
  // (a public.users queda buida, així que Auth no la pot validar mai) — el
  // 'reset_required' de sota obre el modal de nova contrasenya; i (b) qualsevol
  // compte que, per un desajust, encara no tingui parella a auth.users. Si
  // s'hi entra per aquí NO hi ha sessió real d'Auth, i per tant les
  // escriptures fallaran: per això es deixa constància a la consola.
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

  // Hi hem arribat sense sessió real d'Auth: l'usuari entra, però qualsevol
  // escriptura seva serà rebutjada per la RLS (Pas 3b/3c). És un cas que no
  // hauria de passar amb la BD ben sincronitzada; el deixem funcionar per no
  // tancar-li la porta, i el registrem per poder-ho diagnosticar.
  console.warn('[Pas 4b] Accés pel camí de reserva (fem_login): aquest compte no té sessió real d\'Auth i no podrà escriure. Email:', result.email);

  _enterApp({
    id: result.id, name: result.display_name, email: result.email,
    username: result.email, role: result.role,
  });
}

// Entra amb la sessió d'Auth que JA existeixi en aquest navegador per al
// projecte actiu, si correspon a l'email indicat. L'usem en canviar a mode
// TEST: la primera vegada caldrà fer login (abans s'hi entrava sense
// contrasenya, cosa que no pot generar cap sessió real d'Auth i deixava el
// mode Test sense poder escriure); a partir d'aleshores, com que la sessió és
// persistent, el canvi torna a ser immediat. Retorna true si ha pogut entrar.
export async function enterWithExistingAuthSession(email) {
  if (!email) return false;
  const target = String(email).toLowerCase().trim();
  const authEmail = await _authSessionEmail();
  if (!authEmail || authEmail.toLowerCase().trim() !== target) return false;
  const u = _profileByEmail(target);
  if (!u) return false;
  _enterApp(u);
  return true;
}

// Torna a la pantalla d'accés SENSE tocar la sessió d'Auth. Ús intern: el canvi
// de base de dades (config.js) ja gestiona les sessions pel seu compte, i aquí
// només cal reiniciar la interfície.
export function _resetToLoginScreen() {
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

export async function logout() {
  // Pas 4b: tancar la sessió de debò. Abans només s'esborrava el sessionStorage
  // i la sessió d'Auth seguia viva al navegador — amb sessió persistent, això
  // hauria deixat entrar automàticament el mateix usuari a la recàrrega
  // següent, tot i haver premut "Sortir".
  await signOutSilently();
  _resetToLoginScreen();
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
  closeModal('modal-new-password');
  const u = _pendingPasswordUser;
  _pendingPasswordUser = null;
  _enterApp(u);
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
  document.getElementById('reg-name').value  = '';
  document.getElementById('reg-email').value = '';
  document.getElementById('reg-pass').value  = '';
  document.getElementById('reg-pass2').value = '';
  hideLoader();
  showToast(t('account_created') + ', ' + name + ' 🎉', 'success');
  _enterApp(_profileByEmail(result.email) || {
    id: result.id, name: result.display_name, email: result.email,
    username: result.email, role: result.role,
  });

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

  showToast(t('account_deleted'), 'info');
  await new Promise(r => setTimeout(r, 1500));
  // logout() ja tanca la sessió d'Auth del compte acabat d'esborrar (Pas 4b):
  // el JWT seguiria viu al navegador fins a caducar, apuntant a un usuari que
  // ja no existeix.
  await logout();
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
