# FEM-Foto — Autenticació i navegació

> **Com es llegeix aquest document.** Té tres nivells, i probablement només
> necessites el primer:
>
> - **§A Estat actual** — què és veritat avui. Una pantalla.
> - **§B Decisions vives** — el que no s'ha de tornar a discutir, i per què.
> - **§0-§4, la resta** — el **registre cronològic** de com s'hi ha arribat:
>   anàlisi inicial, opcions valorades, cada pas amb les seves proves i els
>   errors trobats pel camí. Valuós mentre un pas està en marxa; consulta
>   puntual un cop tancat. **No cal llegir-lo per treballar al projecte.**

---

## §A Estat actual (actualitzat 02/08/2026)

### Autenticació — migració a Supabase Auth

| Pas | Estat |
|---|---|
| Fase 1.3 · `fem_login()` i revocació de `SELECT` sobre `users.password` | ✅ |
| Pas 1 · columna pont `users.auth_user_id` | ✅ |
| Pas 2 · comptes creats a `auth.users` (Normal 41/41, Test 50/50) | ✅ |
| Pas 3a/3b/3c · sessions reals i RLS basada en `auth.uid()` | ✅ |
| Pas 4a · altes i baixes creen/esborren les dues files | ✅ |
| Pas 4b · Auth decideix l'accés; sessió persistent | ✅ |
| Pas 4c · recuperació per correu i enllaç màgic | ✅ |
| Reset de l'admin · contrasenya temporal (§1.5) | ✅ |
| **Pas 4d · retirada del sistema antic** | ⬜ **Pendent**, bloquejat |

Tot el que està ✅ està aplicat als **dos** projectes, verificat i desplegat.

**Com funciona l'accés avui**: `handleLogin()` valida amb
`supabase.auth.signInWithPassword()`. El camp accepta email **o** nom complet (el nom es
resol contra `state.users`, perquè Auth només entén emails). `fem_login()` queda com a camí
de reserva per a **un** cas legítim: comptes sense parella a `auth.users`. (El segon cas que
cobria —contrasenya reiniciada per un admin— va desaparèixer el 28/07/2026 amb §1.5.) La sessió
és persistent: dura fins que es prem "Sortir".

**Què bloqueja el Pas 4d**: cal comprovar **Zampa** abans de buidar `users.password` i
d'eliminar les polítiques `users_insert_*`/`users_delete_*`. Zampa comparteix la taula `users`
i podria estar comparant la contrasenya en clar des del seu client, o donant altes pel seu
compte. Hi ha una nota de traspàs autònoma escrita al final de §1.4 — **llegir-la sencera
abans de tocar res de Zampa**, no re-derivar el context.

### Filtre d'alta — cens de socis FEM

✅ **Fet i verificat als dos entorns (Test 02/08/2026, Normal 02/08/2026).**

Ningú pot crear-se un compte si el seu email no és a `socis_fem_autoritzats` (taula nova,
admin-only per RLS, independent de `users`). `fem_register_account()` ho comprova abans de
crear cap fila i, si l'email hi és, en pren també el rol per defecte — ja no és sempre
`participant`, es pot pre-autoritzar un Expert abans que s'hagi registrat mai. Gestió
d'altes/baixes/canvi de rol del cens des d'una subpestanya nova, Admin → Socis → **Socis FEM**,
sense RPC pròpia (la mateixa RLS admin-only ja n'hi ha prou). Càrrega inicial: els emails que
ja tenien compte (52 a Test, 41 a Normal); **pendent afegir-hi els socis de la FEM encara no
usuaris de l'app** quan Enric passi la llista. Detall complet, la decisió taula a part vs.
columna a `users`, i la verificació, a §1.6.

### Navegació

✅ **Fet i verificat (02/08/2026).** Opció B de §2.3 implementada: routing per `hash`
(`js/core/navigation.js`), incremental — pantalles principals (`#admin`, `#participant`) i tots
els subpanells de participant (`#participant/voting`, `/gallery`, `/resultats`...). Cada
`showXxx()` ja existent registra la seva ruta i la desa amb `pushState` en navegar-hi de debò
(deduplicat: repintar el mateix panell des del polling no afegeix entrades). Un `popstate`
repinta el panell corresponent en lloc de deixar sortir l'usuari de l'app. Pestanyes internes de
l'admin (`switchTab`) **fora d'abast a propòsit** — es pot ampliar després.

Cas parat especial: `state.adminViewingAsParticipant` ("veure com a participant") només viu en
memòria, mai s'ha persistit. Sense tenir-ho en compte, un admin que refresqués mentre veia un
panell de participant queia sempre al seu panell d'admin encara que el fragment digués on era.
Es reconstrueix a l'arrencada a partir de la pròpia ruta del fragment: si la ruta és de
participant i qui hi entra és un admin real, és que hi era per aquest camí (vegeu
`restoreRouteOrDefault` a `navigation.js`).

---

## §B Decisions vives

**Tota dada d'identitat que visqui a `public.users` i a `auth.users` alhora s'ha d'escriure a
totes dues dins la mateixa transacció.** Nascuda de tres incidents seguits (contrasenya
reiniciada per admin, canvi d'email, reset per correu): les tres vegades, escriure'n només una
deixava el soci fora o —pitjor— deixava la contrasenya antiga vàlida. Si mai s'afegeix un
tercer camp compartit, mateix patró.

**Les contrasenyes existents es preserven; mai un reset massiu forçat.** Pel perfil d'usuari
del club (~65 anys de mitjana), la fricció d'obligar tothom a canviar pesa més que el guany.

**L'auto-registre és obert i immediat**: sense confirmació per correu ni aprovació d'admin
**per a qui ja és al cens de socis FEM** (02/08/2026, §1.6). L'aprovació és prèvia i
col·lectiva —mantenir el cens al dia— no una cua de sol·licituds per revisar una a una; qui no
hi és, no progressa, sense excepcions des de l'RPC.

**Els comptes es creen per RPC, no amb `supabase.auth.signUp()`**: `signUp()` substituiria la
sessió de l'admin per la del soci acabat de crear i forçaria confirmació per correu.

**Mètode d'accés: contrasenya i enllaç màgic**, a triar per l'usuari. L'enllaç màgic és un
botó secundari, no l'opció principal — qui ja té el seu costum no ha de notar cap canvi.

**Les funcions noves porten doble barrera**: comprovació interna *i* `REVOKE EXECUTE ... FROM
anon`. I la comprovació d'identitat s'escriu sempre com a `IF auth.uid() IS NULL THEN RETURN
false`, mai com una comparació — amb `NULL`, una comparació dona `NULL`, que plpgsql tracta
com a fals dins un `IF` i es salta el `RETURN` de denegació. Això va obrir un forat real el
27/07/2026 (§Pas 4a).

**Configuració del tauler de Supabase i inventari de funcions**: a `docs/REFERENCIA_BD.md`.

---

## 0. Per què es va obrir aquest tema

Aprofitant que la integració Reptes+Resultats (Fase 2) i el canvi de sistema
de puntuació (Fase 3) ja estan tancats, Enric vol abordar dos aspectes
pendents a **nivell de tota l'app**, no lligats a cap fase concreta de la
unificació:

1. Sistema de login i autenticació, contrasenyes, gestió d'usuaris.
2. Navegació: comportament en refrescar el navegador i en prémer "enrere".

Aquests dos temes ja apareixien flagued a `FEM-Foto_Unificacio_Pla-desenvolupament.md`
§6 (el camp `users.password` en clar) i a la memòria de sessions anteriors
(manca de routing/history), però mai s'havien analitzat a fons. Aquest
document ho fa.

---

## 1. Sistema de login i autenticació

### 1.1 Estat actual (inventari)

- **Taula `users`** (Supabase, compartida amb Zampa): `id, email (unique),
  display_name, password (text, sense hash), role (admin/participant/expert),
  zampa_role, created_at`. 41 files a Normal.
- **Login** (`js/screens/login.js:110-185`, `handleLogin`): carrega TOTS els
  usuaris a `state.users` (via `loadAllData()`) i compara la contrasenya
  **en JS, al client**: `String(u.password).trim() === pass`. No hi ha cap
  crida servidor que faci la verificació.
- **Registre** (`handleRegister`, línia 291): `INSERT` directe a `users` amb
  la contrasenya tal qual escrita per l'usuari, sense cap transformació.
- **Reset de contrasenya per l'admin** (`socis.js:79-91`,
  `doResetMemberPassword`): posa `password=''`; al següent intent de login
  amb aquella identitat, `handleLogin` detecta el buit i obre el modal de
  "nova contrasenya obligatòria" (`login.js:159-163, 222-270`).
- **Editar soci** (`socis.js:143-158`, `openMemberModal`): el formulari
  **omple el camp de contrasenya amb el valor real desat** (`member-password`,
  `index.html:805` — és `type="password"`, per tant no es veu en clar a la
  pantalla, però qualsevol admin pot llegir-la trivialment amb "mostra la
  contrasenya" del navegador o DevTools).
- **Sessió** (`login.js:12-29`): `sessionStorage` només guarda `{id, name,
  role}` — mai la contrasenya. Es restaura a `init()` per evitar re-login en
  refrescar (F5), buscant l'usuari complet a `state.users` (no es refia cegament
  del que hi ha desat, per si l'admin ha canviat el rol mentrestant). Correcte.
- **Canvi Normal↔Test** (`config.js:56-107`): en anar a Test, auto-login pel
  mateix email sense contrasenya (`enterAsEmail`) — assumpció explícita que
  qui prem el botó ja està autenticat. Tornar a Normal sempre demana login.
  Disseny raonable, no és un forat (Test no té dades sensibles pròpies).
- **Autorització (qui pot fer què)**: totes les proteccions
  ("no pots eliminar-te a tu mateix", "no pots canviar-te el rol a tu mateix",
  botons d'edició/esborrat només visibles per a l'admin) es fan **només al
  client** (`socis.js:14-27, 201-214`). No hi ha cap comprovació al servidor.

### 1.2 Riscos detectats — dades reals dels advisors de Supabase (26/07/2026)

**Confirmat, no suposat**: he consultat `get_advisors(type=security)` i
`list_tables` dels dos projectes. Totes les taules tenen RLS marcat com
`rls_enabled: true`, però **les polítiques reals són permissives fins a
buidar RLS de sentit**:

| Taula | Polítiques trobades |
|---|---|
| `users` | INSERT/UPDATE/DELETE amb `USING/WITH CHECK (true)` per a tothom (Normal); + `allow_anon_write` explícit per al rol `anon` (Test) |
| `votes` | `"Allow all on votes"` per `anon, authenticated` (Normal) + INSERT/UPDATE/DELETE `true` (Test) |
| `seguiment_votacio` | `"Allow all on seguiment_votacio"` per `anon, authenticated` |
| `objectives`, `photo_submissions`, `settings`, `app_settings`, `app_texts`, `reptes_calendari` | Mateix patró: INSERT/UPDATE/DELETE sense restricció real |
| `zampa_*` (taula compartida amb l'altra app del club) | Mateix patró — reforça el risc ja documentat de taula compartida |

A més: 4 vistes `SECURITY DEFINER` (`vista_seguiment_votacio`, `vista_votes`,
`resultats_votacio`, `participacio_per_repte`) — nivell **ERROR** — que
ignoren la RLS de qui consulta; i la funció `fem_apply_calendar()`
(`SECURITY DEFINER`) és cridable directament via RPC per `anon` sense estar
loguejat.

**Conseqüència pràctica, no teòrica**: la clau `anon` de Supabase és pública
per disseny (surt literalment al codi font de `js/core/config.js`, que
qualsevol pot llegir obrint el "veure codi font" del navegador). Amb
aquesta clau, **qualsevol persona d'internet, sense fer login, pot cridar
directament l'API REST de Supabase i llegir la contrasenya en clar de
qualsevol dels 41 usuaris** (`GET .../rest/v1/users?select=*`), i també
pot escriure/esborrar files a `users`, `votes`, `objectives`, etc. sense
passar per la interfície de l'app. Això no és "guardem la contrasenya sense
xifrar" (ja documentat a §6 del pla): és que **avui mateix no hi ha cap
barrera real** entre internet i aquestes dades — el que impedeix que algú ho
faci és només que no se li hagi acudit mirar, no cap mecanisme de seguretat.

Això reforça — amb proves, no amb sospita — el punt que ja teníeu anotat a
`FEM-Foto_Unificacio_Pla-desenvolupament.md` §6 ("El camp `users.password` es
llegeix/escriu en clar... fora de l'abast d'aquesta unificació").

### 1.3 Opcions de millora (graduades)

**A — Mitigació ràpida (hores, sense canviar l'arquitectura ni la UX)**
Estrènyer les polítiques RLS: `SELECT` de `users` limitat a columnes no
sensibles (o cap accés directe des del client), `UPDATE`/`DELETE`/`INSERT`
de `users`/`votes`/etc. eliminats o restringits (per exemple, deixar-ho tot
al backend via funcions `SECURITY DEFINER` ben acotades, no obertes a
`anon`). No arregla que la contrasenya es guardi en clar, però tanca la
porta d'accés directe des d'internet **avui**. No toca cap pantalla ni flux
de login — és 100% treball de BD (SQL, Test primer com sempre).

**B — Hash de contrasenyes** (bcrypt/argon2, o `pgcrypto` a Postgres)
Verificació via una funció `SECURITY DEFINER` (RPC) que rep email+contrasenya
i retorna l'usuari si coincideix, en lloc de comparar en JS al client. Encara
amb la taula `users` i el login propis, però la contrasenya deixa d'estar en
clar a la BD. Requereix A com a base (si no, la funció de verificació seria
igualment cridable per qualsevol sense control).

**C — Migrar a Supabase Auth (GoTrue)** — la solució "de debò"
Sessions reals (JWT), hash i reset de contrasenya gestionats pel propi
Supabase, RLS basada en `auth.uid()` en lloc de confiar en un `user_id` que
envia el client. És la feina més gran: cal reconciliar la taula `users`
actual (rols, `zampa_role`, compartida amb Zampa) amb `auth.users` de
Supabase, migrar els 41 comptes reals, reconstruir login/registre/reset, i
refer les polítiques RLS de ~12 taules — coordinant-ho amb Zampa perquè
comparteix `users`.

**Recomanació**: fer **A ara** (baix cost, tanca el forat obert avui,
independent de qualsevol altra decisió) i decidir B vs C com una fase pròpia
ben acotada més endavant — no barrejar-ho amb aquest sprint.

### FET (2026-07-26) — tros mínim de B, no A

En revisar-ho amb Enric, es va detectar que **A sola no tanca el forat real**:
mentre `handleLogin()` comparés la contrasenya en JS al client, RLS no pot
evitar que sigui llegible, perquè l'app mateixa la necessita llegir. Calia,
com a mínim, moure la verificació al servidor. S'ha implementat i verificat
(Test primer, després Normal — `sql/2026-07-26_login_seguretat_fem_login.sql`):

- Funció `fem_login(identitat, contrasenya)` (`SECURITY DEFINER`) que
  verifica al servidor i retorna `status` (`ok`/`reset_required`/`invalid`)
  + dades no sensibles — mai la contrasenya.
- `REVOKE SELECT` de la taula `users` sencera per a `anon`/`authenticated` +
  `GRANT SELECT` explícit de totes les columnes EXCEPTE `password`
  (verificat amb `has_column_privilege()` als dos projectes). **Nota
  tècnica**: un `REVOKE SELECT (password)` sol NO n'hi ha prou — si el rol ja
  té `SELECT` a nivell de taula, l'accés a la columna ve d'allà i el revoke
  de columna no té cap ACL a sobreescriure. Cal revocar la taula sencera i
  re-concedir columna a columna.
- `js/screens/login.js` (`handleLogin`, `saveNewPassword`), `js/core/data.js`
  (consulta de `loadAllData` i mapeig de `state.users`) i `js/features/socis.js`
  (`openMemberModal`, el camp de contrasenya del modal d'editar soci ara
  sempre comença buit) actualitzats en conseqüència.
- Provat en viu (usuari temporal a Test, esborrat després): login correcte,
  contrasenya incorrecta, i el flux complet de "contrasenya reiniciada per
  l'admin → nova contrasenya" — els tres camins funcionen via el nou RPC.

**Segueix pendent** (fora d'abast d'aquest canvi, decisió explícita d'Enric):
l'enduriment de les polítiques d'escriptura (INSERT/UPDATE/DELETE oberts a
`users`, `votes`, `objectives`, etc. — §1.2) i la decisió B (hash) vs C
(Supabase Auth) per a la resta del sistema d'autenticació.

### 1.4 Migració a Supabase Auth (opció C) — decidida 2026-07-26, pla per passos

**Per què es decideix C i no B**: Enric vol recuperació de contrasenya per
correu i, a més, un mètode d'accés més àgil (magic link) — **totes dues
coses ja venen fetes amb Supabase Auth** (`resetPasswordForEmail()`,
`signInWithOtp()`); construir-les a mà (opció B) exigiria muntar gairebé el
mateix (proveïdor de correu, Edge Function, taula de tokens amb caducitat)
sense cap dels avantatges de tenir-ho ja fet i mantingut. Mètode d'accés:
**tots dos alhora** (contrasenya + magic link, l'usuari tria).

**Verificat 2026-07-26**: el pla és gratuït i no bloqueja cap d'aquestes
funcionalitats (`get_organization` confirma pla `free`; Auth/magic
link/reset no són de pagament).

**SMTP extern: no és opcional, és un requisit dur** (corregit després de
tornar a consultar la documentació real de Supabase — la primera resposta
ho subestimava dient només "best-effort"). El motiu no és el volum: el
servei de correu *integrat* de Supabase **només envia missatges a adreces
que siguin membres de l'equip del projecte a Supabase** (els col·laboradors
amb accés al tauler — un concepte totalment diferent dels usuaris de
l'app). Qualsevol altra adreça rep l'error *"Email address not
authorized"* i no arriba mai. Per tant, encara que fóssim poquíssims
usuaris, **cap dels 41 socis rebria el correu** amb el servei integrat,
perquè les seves adreces no formen part de l'equip del projecte. A més
(ja secundari), el límit d'enviament és baix i no fixat ("pot canviar
sense avís"), i la pròpia documentació ho descriu com a pensat només per
explorar/provar plantilles/projectes de joguina, mai per a usuaris reals.
Cal connectar un proveïdor SMTP extern (Brevo, SendGrid...) — gratuït als
seus propis plans (typ. 100-300 correus/dia, molt per sobre de les
necessitats del club) i configurable des del tauler de Supabase en uns
minuts — abans que el reset per correu o el magic link puguin funcionar
per a cap soci real.

**Decisions ja preses per Enric**:
- **Es mantenen les contrasenyes actuals** (no es força un reset general) —
  el perfil mitjà d'usuari (~65 anys) fa preferible zero fricció a la
  migració. És possible perquè encara tenim els valors en clar a la BD
  (§1.3 FET només en va tancar la lectura des del client, no els va
  esborrar) — un script de migració amb privilegis d'administrador els pot
  llegir i traspassar tal qual a Supabase Auth.
- **Zampa el gestiona el mateix Enric** — no cal coordinar-ho amb ningú
  extern, però cal fer-ho en un moment triat conscientment (vegeu nota
  dedicada al final d'aquesta secció, pensada per obrir-se com a primer punt
  quan s'aborda Zampa).

**Pla per passos proposat** (incremental, Test primer sempre — mateixa
filosofia que la Fase 3):

1. **Columna pont** — afegir `public.users.auth_user_id uuid` (nullable, únic).
   Zero canvi de comportament; no toca cap ID ni clau forana existent
   (`photo_submissions.user_id`, `votes.user_id`, etc. segueixen fent
   servir l'`id` text actual, no l'UUID d'Auth).

   **FET i VERIFICAT (26/07/2026)** —
   `sql/2026-07-26_auth_migracio_pas1_bridge_column.sql` aplicat a Test
   (50 usuaris) i Normal (41 usuaris): columna `auth_user_id uuid`,
   nullable, amb restricció `UNIQUE` i clau forana cap a `auth.users(id)`
   (`ON DELETE SET NULL` — si mai s'esborrés un compte d'Auth, la fila de
   `public.users` i tot el seu historial de fotos/vots es mantenen
   intactes, només es desvincula). Verificat a tots dos: la columna existeix,
   és `uuid`/nullable, i els 0 valors omplerts (esperat, encara no hi ha
   cap compte d'Auth creat). Cap prova addicional a l'app necessària —
   `data.js` mai selecciona `*` de `users` (sempre llista columnes
   explícitament), així que afegir una columna nova és 100% transparent
   per al codi actual.
2. **Script de migració dels comptes reals** — crear a `auth.users` (+
   `auth.identities`) un compte per a cada fila de `public.users`, preservant
   la contrasenya actual, i desar l'UUID a `auth_user_id`.

   **FET i VERIFICAT (26/07/2026)** —
   `sql/2026-07-26_auth_migracio_pas2_crear_comptes.sql`, aplicat a Test
   (50/50) i Normal (41/41). **Canvi respecte al pla original**: es preveia
   que calia l'Admin API amb la clau `service_role` (un script extern,
   Node/Deno). A la pràctica **no ha calgut** — es pot fer directament per
   SQL, inserint a `auth.users`/`auth.identities` amb la contrasenya
   hashejada amb `pgcrypto` (`extensions.crypt(contrasenya,
   extensions.gen_salt('bf'))`, extensió ja activada al projecte), que és
   exactament el format de hash que GoTrue (el servei d'Auth) espera i
   verifica. Abans d'aplicar-ho a tothom es va provar amb un compte
   sintètic d'un sol ús a Test: creat per SQL, login real confirmat via
   `POST /auth/v1/token?grant_type=password` (token vàlid retornat),
   contrasenya incorrecta rebutjada correctament, compte esborrat després.
   Un cop confirmada la tècnica, aplicat a tots els usuaris reals:
   - **Test**: 50/50 usuaris amb `auth_user_id` omplert; comprovació
     criptogràfica en bloc (`crypt(contrasenya_actual, hash_desat) =
     hash_desat`) coincident per als 50; a més, **login real d'extrem a
     extrem provat** amb un usuari de prova ja existent
     (`test.annapuig@fem-foto.test`, la seva contrasenya original), èxit.
   - **Normal**: 41/41 usuaris amb `auth_user_id` omplert; mateixa
     comprovació criptogràfica en bloc, 41/41 coincidents. **No** s'ha fet
     cap login real amb credencials de socis reals (no és necessari — la
     comprovació criptogràfica ja demostra matemàticament que cada
     contrasenya autenticaria correctament, sense haver de fer servir la
     contrasenya real de ningú).
   - Script idempotent (`WHERE auth_user_id IS NULL`), es podria re-executar
     sense duplicar res si mai calgués afegir usuaris nous més endavant.
3. **RLS amb identitat real** — reescriure les polítiques `USING(true)`
   detectades a §1.2 perquè comprovin `auth.uid()` (via `auth_user_id`) en
   lloc de confiar en un `user_id` que envia el client. **Això tanca de
   retruc l'enduriment d'escriptures que havíem deixat pendent** — amb
   sessions reals, RLS ja pot distingir peticions legítimes d'alienes, cosa
   que amb el sistema actual era impossible.

   **Auditoria feta (27/07/2026), abans d'escriure cap SQL — dues troballes
   que obliguen a repensar l'ordre d'aquest pas:**

   **(a) Test i Normal ja NO tenen el mateix conjunt de polítiques.**
   Consulta directa a `pg_policies` (no assumit de memòria) als dos
   projectes: Normal té un grup addicional de polítiques
   (`users_write`/`users_edit`/`users_remove`, `votes_write`,
   `objectives_write`/`obj_edit`/`obj_remove`, `photos_write`/`photos_edit`/
   `photos_remove`, `settings_write`/`settings_edit` a `app_settings`)
   restringides a `auth.role() = 'anon'`, que Test no té. Però com que
   Postgres combina totes les polítiques permissives amb OR, i les
   polítiques originals `"Permetre X" (USING/WITH CHECK true)` segueixen
   actives en paral·lel a totes dues, **aquest intent previ d'enduriment no
   bloqueja res avui** — calen eliminar-les TOTES (no només afegir-hi de
   noves al costat) quan es reescrigui, a tots dos projectes per igual.

   **(b) Bloquejant: l'app no estableix mai una sessió real de Supabase
   Auth avui.** Confirmat per grep exhaustiu de `js/` (agent Explore,
   27/07/2026): el client `sb` es crea sempre amb la clau `anon`
   (`js/core/config.js:31-34`), compartida per tothom; el "login" passa per
   l'RPC propi `fem_login()` (ja fet al §1.3), i la sessió es guarda només
   a `sessionStorage` com `{id, name, role}` (`login.js:18-29`). **Mai es
   crida `supabase.auth.signInWithPassword()` ni cap altra funció d'Auth** —
   per tant `auth.uid()` és sempre `NULL` en qualsevol petició d'avui,
   malgrat que `auth.users`/`auth_user_id` ja estiguin poblats (Pas 1-2).
   **Conseqüència**: aplicar polítiques `auth.uid() = ...` ara, fins i tot
   només a Test, bloquejaria absolutament totes les escriptures de l'app
   (pujar fotos, votar, gestionar socis...) — no és "més estricte", és
   "tothom queda fora", perquè cap petició porta mai una identitat que
   Postgres pugui verificar. **Pas 3 no es pot aplicar de manera útil sense,
   com a mínim, la part de Pas 4 que estableix la sessió real
   (`signInWithPassword()`/`onAuthStateChange()`)** — decisió de seqüenciació
   pendent amb Enric: fusionar Pas 3+4 en un sol cicle (dissenyar ara,
   aplicar quan el client ja generi sessions reals), o fer primer un
   "Pas 3a" mínim que només connecti la sessió i validar `auth.uid()` a
   Test abans d'escriure les polítiques definitives.

   **Mapeig complet d'operacions d'escriptura per taula, fet per preparar
   el disseny de polítiques** (agent Explore, grep de tot `js/`,
   27/07/2026) — patrons detectats, útils quan es reprengui aquest pas:
   - **Escriptures sobre dades pròpies, qualsevol usuari loguejat**:
     `photo_submissions` (insert/update/delete filtrats per
     `user_id=currentUser.id`), `votes` (upsert amb `user_id=currentUser.id`,
     encara que la foto sigui d'un altre), `seguiment_votacio` (upsert/update
     amb `user_id=currentUser.id`), `users.delete` (baixa pròpia),
     `users.update` de contrasenya pròpia (`saveNewPassword`).
   - **Escriptures reservades a `role='admin'`**: tot `objectives`, tot
     `app_settings`, tot `app_texts`, i a `users`/`photo_submissions`/`votes`
     quan és sobre files de tercers (gestió de socis des del panell Socis,
     publicar/eliminar fotos alienes des de Galeria admin).
   - **Rol `expert`**: no té cap camí d'escriptura propi — vota exactament
     igual que un `participant` (`votacio.js`); només es distingeix en
     lectura (filtratge de rànquing). Simplifica el disseny: no cal cap cas
     especial per `expert` a les polítiques d'escriptura.
   - **Escriptures SENSE cap login previ, a decidir explícitament**:
     `initializeDB()` (alta de l'admin per defecte + settings inicials,
     només quan `users` és buida) i `handleRegister()` (auto-registre
     lliure de nous participants) — cap dels dos passa per `fem_login`.
     S'hauran de repensar juntament amb el disseny del nou flux de
     registre de Pas 4 (via `supabase.auth.signUp()`?).
   - **Atenció particular a `SELECT`**: `loadAllData()`
     (`js/core/data.js:72-102`) fa `SELECT *` sense filtre per usuari de
     `users`, `objectives`, `photo_submissions`, `votes`, `app_settings`,
     `seguiment_votacio` — el filtratge "és meu"/"no revelat encara" es fa
     només al client. Les noves polítiques de `SELECT` **han de seguir
     obertes a qualsevol usuari loguejat** (no restringides per
     `auth_user_id`), o es trenca el mosaic de vot, el rànquing i la taula
     de socis.
   - Codi mort detectat de pas (irrellevant per al disseny, no tocar ara):
     `saveUsers()` i les crides a `votes` dins `saveVotes()`
     (`js/core/data.js`) no s'invoquen enlloc.

   **Encara sense aplicar cap canvi de SQL per aquest pas** — aturat aquí
   a l'espera de la decisió de seqüenciació amb Enric.

   **Criteris fixats per Enric (27/07/2026) per triar la seqüència**, en
   lloc d'escollir ell mateix entre opcions tècniques que no se sent
   capacitat per valorar: (1) maximitzar que l'app no quedi mai inoperativa,
   (2) cada canvi ha de ser contrastable que funciona i tenir marxa enrere
   si no, (3) els usuaris actuals han de seguir podent entrar exactament
   igual que ara, (4) qualsevol canvi de gestió d'usuaris/contrasenyes ha de
   ser transparent per als usuaris. Vegeu [[feedback_collaboration_style]]
   — norma general per a decisions de seqüenciació futures, no només per a
   aquest pas.

   **Pla revisat (27/07/2026) aplicant aquests criteris — Pas 3 i Pas 4 es
   fusionen en un sol cicle, esglaonat en 3a/3b/3c:**

   - **Pas 3a — sessions reals d'Auth en paral·lel, sense tocar cap
     política (additiu, risc pràcticament zero).** A `login.js`, un cop
     `fem_login()` confirma `status:'ok'` (mateix camí d'avui, intacte), fer
     també `supabase.auth.signInWithPassword({email, password})` amb les
     mateixes credencials que l'usuari ja ha escrit al mateix formulari de
     sempre. Si aquesta crida falla per qualsevol motiu, l'app continua
     exactament com avui (no bloqueja el login) — és pur afegit, no
     substitueix res encara. Zero canvi visible per l'usuari. Provar
     primer a Test (confirmar via `get_logs`/una consulta de prova que
     `auth.uid()` ja resol l'UUID correcte per usuaris reals), després
     desplegar el mateix a Normal i confirmar amb un login real que tot
     segueix igual — en aquest punt cap RLS ha canviat, així que no hi ha
     risc real de trencar res.
   - **Pas 3b — escriure i provar les polítiques RLS noves, només a
     Test.** Migració SQL: DROP de totes les polítiques permissives
     detectades (incloent les "mig fetes" ja presents a Normal que no fan
     cap efecte real, vegeu (a) més amunt) + CREATE de les noves basades en
     `auth.uid()`/`auth_user_id`/rol, seguint el mapeig d'operacions
     d'aquesta secció. Es guarda alhora un script de rollback (recrear les
     polítiques d'avui) llest per aplicar en segons. Aplicar NOMÉS a Test i
     provar-ho exhaustivament: cada operació d'escriptura mapada (pujar
     foto, votar, Puntuar Repte, enviar votació definitiva, panell Socis
     sencer, Galeria admin, calendari, textos i la seva rèplica a l'altre
     projecte) amb un participant real i un admin real de Test — i
     confirmar explícitament amb una crida `curl` directa amb la clau
     `anon` (sense signIn) que ara SÍ es bloqueja, com a prova positiva que
     el forat es tanca. Si res es trenca: rollback immediat, diagnosticar,
     re-provar. No es passa a Normal fins que tot funcioni igual que abans
     des del punt de vista de l'usuari.
   - **Pas 3c — desplegar a Normal amb finestra de verificació.** Només
     després que 3b hagi passat totes les proves. Aplicar la mateixa
     migració (amb el rollback ja provat) a Normal, fer un mini "smoke
     test" immediat en producció (login real, mosaic de vot, votar, panell
     de Socis com a admin), i mantenir el rollback a mà uns dies per si
     surt algun cas no cobert pels tests.
   - **Pas 4 (resta) — un cop 3a-3c validats**: substituir del tot
     `fem_login()`/`sessionStorage` manual per l'SDK d'Auth complet
     (`onAuthStateChange`), afegir "Has oblidat la contrasenya?" i accés
     per enllaç màgic. **Nou punt detectat avui, a resoldre en aquest
     pas**: els fluxos d'admin que toquen `users.password` directament
     (reset de contrasenya d'un soci, editar-la des del panell Socis) no
     podran seguir escrivint-hi directament un cop RLS de `users` es tanqui
     de veritat — caldrà una funció `SECURITY DEFINER` pròpia (mateix
     patró que `fem_login`) perquè aquests fluxos d'admin no quedin
     trencats. Es dissenya en detall quan s'hi arribi.
   - **Pas 5** — retirar (amagar, no eliminar) el sistema vell, mateix
     criteri "amagar no eliminar" ja aplicat a Fase 3.

   **Pas 3a — FET i VERIFICAT a Test (27/07/2026).** A `handleLogin()`
   (`js/screens/login.js`), just després que `fem_login()` confirmi
   `status:'ok'` (aquest camí no es toca), s'afegeix una crida a
   `sb.auth.signInWithPassword({ email: result.email, password })` dins
   `try/catch` — purament additiva: si falla, només es registra un avís a
   consola (`console.warn('[Pas 3a] ...')`) i el login continua exactament
   com avui. S'usa `result.email` (el retornat per `fem_login`, sempre un
   email vàlid) en lloc del valor cru del camp "Usuari/Email", ja que
   aquest camp accepta indistintament email o nom complet.

   Provat en viu servint l'app en local (`npx serve`) contra Test, amb
   l'usuari sintètic `test.annapuig@fem-foto.test` (contrasenya coneguda,
   ja migrat a `auth.users` al Pas 2): login correcte → cap error/avís a
   consola → confirmat als logs d'Auth de Test (`get_logs`) una petició
   `POST /token` (`grant_type=password`, `status:200`,
   `referer:http://localhost:5510/`, `actor_username:test.annapuig@fem-foto.test`)
   exactament coincident amb la prova — la sessió real d'Auth s'estableix
   correctament. Contrasenya incorrecta: el missatge d'error
   ("Usuari/email o contrasenya incorrectes") i el comportament es
   mantenen idèntics a abans, sense cap error nou a consola (el codi nou
   ni s'executa en aquest camí, ja que només corre després de
   `status:'ok'`). Cap política RLS tocada — encara totes obertes.

   **Pas 3a — FET i VERIFICAT també a Normal (27/07/2026).** Commit
   `5d41e44` desplegat a `fem-foto.vercel.app` (autoritzat per Enric).
   Primer intent d'Enric va fallar amb "no s'han trobat usuaris" — no era
   cap regressió: la seva pestanya tenia carregat en memòria un bundle
   antic (d'abans del Pas 1.3), que encara demanava la columna `password`
   a `loadAllData()` i per això rebia 401 (confirmat als logs `api` de
   Normal: `GET /rest/v1/users?select=...,password,...` → 401 — el codi
   actual del repo ja no la demana des del Pas 1.3). Canviar de mode
   Test↔Normal no recarrega la pàgina, així que un mòdul JS ja carregat es
   queda congelat a la versió amb què es va obrir la pestanya. Després
   d'un refresc complet, login real d'Enric (`enricmr@gmail.com`) confirmat
   als logs d'Auth de Normal: `POST /token` (`grant_type=password`,
   `status:200`, `actor_username:enricmr@gmail.com`) — sessió real
   establerta correctament, cap comportament diferent per l'usuari.

   **Estat**: Pas 3a verificat de cap a cap (Test + Normal, amb un usuari
   real). Següent: Pas 3b — dissenyar i provar les polítiques RLS noves,
   només a Test.

   **Pas 3b — FET i PROVAT A FONS a Test (27/07/2026).** Migració aplicada
   (`sql/2026-07-27_auth_migracio_pas3b_rls_test.sql`, rollback complet a
   `sql/2026-07-27_auth_migracio_pas3b_rollback_test.sql`): DROP de totes les
   polítiques permissives detectades a §1.2 (incloent les "mig fetes" de
   Normal que no feien cap efecte real) + CREATE de polítiques noves basades
   en `auth.uid()`/`auth_user_id`/rol per a `users`, `objectives`,
   `photo_submissions`, `votes`, `seguiment_votacio`, `app_settings`,
   `app_texts`, `settings` i `reptes_calendari` (aquestes dues últimes,
   taules retirades sense cap ús real, tancades per higiene). `zampa_*` fora
   d'abast (Zampa, gestió separada). Verificat via `get_advisors`: tots els
   avisos "RLS Policy Always True" d'aquestes taules han desaparegut.

   Decisions de disseny (documentades al capçal del fitxer SQL, D1-D5):
   auto-registre obert però amb `WITH CHECK (role='participant')` (tanca
   l'escalada de privilegis que abans permetia enviar `role:'admin'` per
   API directa); INSERT de bootstrap (`initializeDB()`, sense sessió) només
   permès quan `users` és buida; UPDATE de `users` restringit a admin, amb
   dues RPCs noves (`fem_set_new_password`, `fem_admin_set_password`) per
   als dos fluxos on un canvi de contrasenya no pot passar per un UPDATE de
   client directe.

   **Dos bugs reals trobats i corregits provant-ho de debò** (no només
   dissenyant sobre paper):
   1. El flux "admin reseteja -> l'usuari tria contrasenya nova"
      (`saveNewPassword()`) no passa per `handleLogin()`, així que li
      faltava la crida `signInWithPassword()` del Pas 3a — sense sessió
      real, la primera votació d'aquell usuari fallava (403). Corregit
      afegint la crida també aquí.
   2. `fem_set_new_password()`/`fem_admin_set_password()` (aquesta última,
      nova) havien de sincronitzar TAMBÉ `auth.users.encrypted_password`
      (amb `pgcrypto`, mateix mecanisme del Pas 2) — si no, `auth.users`
      es queda amb la contrasenya vella per sempre i `signInWithPassword()`
      fallaria silenciosament (sessió real trencada) cada vegada que un
      admin canviï la contrasenya d'algú, ara i quan arribi a Normal. Sense
      aquest fix, hauria estat un trencament silenciós descobert molt més
      tard per un soci real — exactament el tipus de cosa que els teus
      criteris de seguretat (27/07/2026) volien evitar.

   **Provat en viu** (compte admin de prova `u_test_admin_pas3b`, creat i
   esborrat només per aquesta sessió; usuaris de prova ja existents
   `test.annapuig@fem-foto.test` etc.):
   - ✅ Escalada de rol bloquejada (`role:'admin'` via API anònima → 401);
     auto-registre legítim (`role:'participant'`) → 201.
   - ✅ UPDATE anònim a un repte real → 0 files afectades (silent block).
   - ✅ Admin: reset de contrasenya d'un soci, panell Socis → soci pot
     entrar i triar nova contrasenya → vota correctament després (RPC +
     sessió real confirmades).
   - ✅ Participant: vota una foto d'un altre (`votes`), esborrany i
     enviament final de votació (`seguiment_votacio` insert + update).
   - ✅ Admin: canvia mode/data d'un repte (`objectives`).
   - ✅ Admin: actualitza `app_texts`/`app_settings`; participant NO-admin
     bloquejat per les mateixes escriptures (0 files afectades).
   - ✅ Propietari edita el peu de la seva foto (`photo_submissions`);
     bloquejat editant la d'un altre; admin publica la d'un altre amb èxit.
   - **No provat en viu, per temps** (validat per lògica/disseny, mateix
     patró ja confirmat en 3 taules diferents): `votes` DELETE (admin-only),
     `users` DELETE (self-or-admin), l'auto-registre real via formulari
     (només via curl), i el "conegut" trencament esperat del botó
     "Replica a les dues bases" de Textos quan es clica des d'un projecte
     diferent de l'actiu (el client puntual cap a l'ALTRE projecte no té
     sessió real — caldrà revisar-ho a Pas 4 o abans si Enric ho troba a
     faltar).

   Canvis de client fets EN LOCAL, NO desplegats (a `git`, sense `push`
   fins al Pas 3c per no trencar Normal abans que la migració hi arribi):
   `login.js` (`saveNewPassword`) i `socis.js` (`saveMember`) — vegeu nota
   al peu de `sql/2026-07-27_auth_migracio_pas3b_rls_test.sql`.

   **Pas 3c — FET i VERIFICAT a Normal (27/07/2026).** Mateixa migració
   aplicada a Normal (`sql/2026-07-27_auth_migracio_pas3c_rls_normal.sql`,
   adaptada als noms reals de les polítiques de Normal — diferents dels de
   Test, vegeu punt 3(a); rollback complet a
   `sql/2026-07-27_auth_migracio_pas3c_rollback_normal.sql`). Verificat amb
   `get_advisors`: mateix resultat net que a Test. Autoverificat abans de
   tocar res de client, amb un compte admin de prova creat i esborrat només
   per aquesta comprovació (`u_test_admin_pas3c`, mai tocat cap compte
   real): escriptura anònima bloquejada (INSERT `role:'admin'` → 401; UPDATE
   d'un repte real → 0 files), i escriptura admin correcta sobre un repte
   real (canvi i reversió immediata d'`upload_mode`, confirmat i desfet per
   SQL). Commit `c44f859` (`login.js`, `socis.js`, migracions i rollbacks)
   fet `push` a `origin/main` i confirmat desplegat a
   `fem-foto.vercel.app`.

   **Estat**: Pas 3a-3c complets i verificats de cap a cap als dos
   projectes (Test i Normal), incloent la prova real final d'Enric —
   confirmat als logs d'Auth de Normal (`POST /token`, `grant_type=password`,
   `status:200`, `actor_username:enricmr@gmail.com`, 27/07/2026 10:26 UTC).
   Segueix pendent: Pas 4 (client complet — `onAuthStateChange`, oblidat
   contrasenya, magic link, i el flux de registre/alta que encara no crea
   compte a `auth.users`) — sense programar, a l'espera d'Enric.
4. **Client — login/registre/sessió** — substituir `handleLogin`/
   `handleRegister`/`sessionStorage` (`login.js`) per
   `supabase.auth.signInWithPassword()` / `signUp()` /
   `onAuthStateChange()`; `state.currentUser` es compon fent join de la
   sessió d'Auth amb `public.users` (rol, nom, etc. via `auth_user_id`).
   Afegir "Has oblidat la contrasenya?" (`resetPasswordForEmail` + nova
   pantalla "crea nova contrasenya" a partir de l'enllaç rebut) i el botó de
   magic link, tots dos visibles a la pantalla d'accés.

   **Decisions d'Enric (27/07/2026), preses abans de començar:**
   - **Sessió persistent**: qui entra es queda dins fins que prem "Sortir"
     (avui, tancar la pestanya tanca la sessió). Menys fricció, coherent amb
     el perfil d'usuari del club. Efecte secundari acceptat: en un ordinador
     compartit, el segon usuari haurà de prémer "Sortir" abans d'entrar.
   - **L'auto-registre no canvia**: segueix sent obert i immediat, sense
     confirmació per correu ni aprovació d'admin. El Pas 4 només arregla el
     que està trencat, no afegeix passos al flux d'alta.

   **Ordre del Pas 4** (fixat aplicant els criteris de seqüenciació d'Enric):
   4a altes/baixes → 4b Auth decideix l'accés → 4c reset per correu i enllaç
   màgic → 4d retirada del sistema vell. L'ordre no és arbitrari: mentre
   `fem_login()` segueixi decidint l'accés, qualsevol contrasenya canviada des
   d'Auth (reset per correu) deixaria l'usuari fora, i **l'enllaç màgic
   directament no pot funcionar**, perquè no hi ha cap contrasenya per passar a
   `fem_login()`. Per tant 4b ha d'anar abans de 4c.

   **Pas 4a — FET i VERIFICAT a Test (27/07/2026).**
   `sql/2026-07-27_auth_migracio_pas4a_altes_baixes.sql` (rollback a
   `sql/2026-07-27_auth_migracio_pas4a_rollback.sql`). Purament additiu: crea
   quatre funcions, no toca cap política RLS ni cap dada.

   **El forat era més ampli del que teníem anotat** — no eren dos camins sinó
   cinc, i incloïa també les baixes:
   - `handleRegister()` (auto-registre) i `saveMember()` ("Nou Soci" d'admin)
     inserien només a `public.users`: el compte nou podia entrar però **cap
     escriptura seva funcionava** (votar, pujar foto → bloquejat per la RLS del
     Pas 3b/3c, perquè mai podia establir sessió real d'Auth).
   - `initializeDB()` creava el primer admin igual de coix; i, a més, el seu
     ordre ja no funcionava gens: inseria l'admin i tot seguit `app_settings`,
     però la política `app_settings_insert_bootstrap` exigeix que `users`
     estigui buida — cosa que la línia anterior acabava de deixar de complir.
   - `handleUnsubscribe()` (baixa pròpia) i `deleteMember()` (baixa feta per
     l'admin) esborraven la fila de `public.users` i **deixaven el compte
     d'`auth.users` orfe**: aquella adreça quedava ocupada per sempre i la
     persona no s'hauria pogut tornar a donar d'alta mai més.

   Verificat abans de començar que el forat encara no havia afectat ningú
   real: 0 files amb `auth_user_id IS NULL` i 0 comptes orfes, als dos
   projectes (ningú s'ha registrat des del Pas 2 — l'última alta a Normal és
   del 23/07).

   **Solució**: quatre RPC `SECURITY DEFINER` (mateix patró que `fem_login` /
   `fem_admin_set_password`, i la mateixa tècnica de creació de comptes ja
   validada al Pas 2) — `fem_register_account`, `fem_admin_create_member`,
   `fem_delete_account` i `fem_bootstrap_admin` — més un helper intern
   `fem_create_account_row` **no cridable per `anon` ni `authenticated`**
   (verificat amb `has_function_privilege`). Cada alta crea les dues files
   (`public.users` + `auth.users`/`auth.identities`) dins la MATEIXA
   transacció, i cada baixa n'esborra les dues.

   **Per què RPC i no `supabase.auth.signUp()` des del client**: `signUp()`
   substituiria la sessió activa de l'admin per la del soci que acaba de crear,
   i obligaria a confirmació per correu (que Enric ha decidit no introduir).
   Un sol camí serveix per als dos formularis.

   **Error real trobat provant-ho** (no dissenyant sobre paper): la primera
   versió inseria a `public.users` abans que existís la fila d'`auth.users`, i
   la clau forana del Pas 1 es comprova immediatament → `23503`. Ordre
   corregit: primer `auth.users`, després `public.users`.

   **Provat de cap a cap a Test**, primer per API directa (`curl` amb la clau
   `anon`, per verificar els guards) i després **per la interfície real de
   l'app** (servida en local amb `npx serve`, mai `file://`):
   - ✅ `anon` intentant crear un admin (`fem_admin_create_member`) → `forbidden`.
   - ✅ Contrasenya massa curta → `invalid`; email repetit (i amb majúscules)
     → `email_exists`; rol inventat (`superadmin`) → `invalid`.
   - ✅ Auto-registre pel formulari real → compte creat, **sessió real d'Auth
     establerta** (comprovat el token a `localStorage`), i **vot escrit
     correctament a la BD des de la pantalla de votació** — exactament el que
     abans quedava bloquejat.
   - ✅ El mateix compte intentant votar suplantant un altre usuari → 403.
   - ✅ "Nou Soci" des del panell d'admin (modal real) → les dues files creades.
   - ✅ Baixa des del panell d'admin i baixa pròpia del soci (modals reals) →
     les dues files esborrades, vots caiguts per CASCADE.
   - ✅ Després d'una baixa, **es pot tornar a registrar amb el mateix email**
     (abans hauria xocat amb l'orfe d'`auth.users`).
   - ✅ `anon` intentant esborrar un compte aliè → `false`.
   Tots els comptes de prova creats (i un admin de prova temporal) esborrats en
   acabar: Test torna a 50 usuaris / 50 comptes d'Auth, 0 sense parella.

   **Abast deliberadament limitat**: no s'ha tocat cap política RLS. Un cop el
   client només crea/esborra comptes via aquestes RPC, les polítiques
   `users_insert_self_register` / `users_insert_admin` / `users_insert_bootstrap`
   / `users_delete_admin_or_self` es podrien eliminar — tancaria l'últim camí
   d'escriptura anònima que queda a `public.users`. **No es fa encara perquè la
   taula és compartida amb Zampa** i cal comprovar abans si Zampa dona altes pel
   seu compte (vegeu la nota de traspàs al final d'aquesta secció). Apuntat com
   a feina de Pas 4d.

   **Troballa col·lateral, PREEXISTENT (del Pas 3b/3c, no del 4a) — CORREGIDA
   el 27/07/2026 a petició d'Enric, dins el mateix cicle**: l'automatisme de
   calendari (`applyPhaseModes()`, `js/features/calendari.js`) cridava
   `saveObjectives()`/`saveSettings()` des del client de **qualsevol** usuari,
   no només d'un admin — una crida deliberada des de `showParticipantScreen()`
   i de l'auto-refresh (fix del 2026-07-18, perquè cada soci vegi l'estat
   correcte d'AVUI sense dependre que un admin hagi obert l'app abans). Com que
   des del Pas 3b/3c `objectives` i `app_settings` són admin-only, un soci
   normal rebia un 403 (`saveObjectives error`/`saveSettings error` a consola)
   cada cop que l'automatisme detectava un canvi de fase: una escriptura que
   fallava en silenci per als 41 socis de Normal.

   Impacte real baix (cada client recalcula l'estat localment a partir de les
   dates, i el cron diari `fem_apply_calendar()` també el persisteix), però era
   soroll d'error constant. **Correcció**: la persistència només s'intenta si
   `state.currentUser.role === 'admin'`; el recàlcul en memòria segueix
   fent-se per a tothom, intacte.

   Verificat en viu a Test provocant un desajust deliberat a la BD
   (`voting_enabled` posat a `true` a un repte el calendari del qual diu que la
   votació encara no ha començat): amb un soci de prova, **cap error de consola**
   (comprovat amb marcadors explícits abans/després del login, per no confondre
   missatges antics), estat recalculat correctament en memòria
   (`voting_enabled: false`) i BD intacta; amb un admin de prova, l'escriptura
   sí es fa (`saveObjectives()` retorna `true` i la BD queda actualitzada).
   Estat original del repte restaurat i comptes de prova esborrats en acabar.

   **Pas 4a aplicat també a NORMAL (27/07/2026)** — i, verificant-lo allà, s'hi
   va detectar i corregir immediatament **un forat de seguretat real que hi
   havia introduït jo mateix** amb aquesta mateixa migració:

   `fem_delete_account()` comprovava l'autorització amb
   `IF NOT (fem_is_admin() OR v_is_self)`, on
   `v_is_self := (auth_user_id IS NOT NULL AND auth_user_id = auth.uid())`.
   Per a un cridant **anònim**, `auth.uid()` és NULL, així que
   `auth_user_id = auth.uid()` no val `false` sinó **NULL**; llavors
   `NOT (false OR NULL)` també val NULL, i plpgsql tracta un `IF NULL` com a
   fals → el `RETURN false` no s'executava. Resultat: **qualsevol persona amb
   la clau `anon` (pública) podia esborrar el compte de qualsevol soci**, amb
   les seves fotos i vots per CASCADE. Confirmat empíricament a Normal (la
   crida va retornar `true` i va esborrar el compte objectiu).

   **Cap dada real afectada**: el compte esborrat era el temporal creat just
   abans per fer la verificació; comprovat immediatament que Normal seguia amb
   41 usuaris / 41 comptes d'Auth i cap orfe.

   **Per què no ho havia enxampat a Test**: la prova que ho donava per tancat
   feia servir un **id d'usuari inexistent**, així que la funció sortia pel
   `RETURN false` de "no trobat" sense arribar mai a avaluar l'autorització.
   La prova semblava verda i no verificava res. **Lliçó**: una prova negativa
   d'autorització ha de fer-se sempre sobre una fila que existeixi de debò.

   **Correcció** (aplicada a Normal primer, per ser producció, i tot seguit a
   Test): la comparació d'identitat només es fa si hi ha un cridant autenticat
   (`auth.uid() IS NOT NULL`), amb `coalesce(..., false)`, i a més es
   **revoca l'EXECUTE de la funció a `anon`** — defensa doble, ja que les dues
   baixes de l'app sempre es fan des d'una sessió iniciada. Re-verificat als
   dos projectes amb un compte temporal **existent**:
   - ✅ `anon` → `permission denied for function fem_delete_account`, i el
     compte segueix existint després de l'intent.
   - ✅ Un altre usuari autenticat intentant esborrar un compte aliè → `false`.
   - ✅ El propi titular donant-se de baixa → `true`.
   Comptes temporals esborrats: Normal 41/41 i Test 50/50, sense orfes.

   Revisades les altres funcions noves pel mateix patró: `fem_is_admin()`
   retorna un `EXISTS`, que mai és NULL, així que
   `fem_admin_create_member`/`fem_bootstrap_admin` (i les RPC de contrasenya del
   Pas 3b) no tenen aquest problema.

   **Comprovació addicional demanada per Enric: els modes forçats pel
   desplegable (`obert`/`tancat`, independents del calendari) han de seguir
   manant.** La primera prova s'havia fet només sobre un repte en mode
   `calendari`. Repetida sobre un repte amb `voting_mode='obert'` i les dates de
   votació encara per començar (11/09), amb la BD desincronitzada
   (`voting_enabled=false`):
   - ✅ Soci: veu la votació **oberta** (el mode forçat guanya sobre el
     calendari, com sempre), cap error de consola, BD intacta.
   - ✅ Admin (càrrega neta de pàgina): persisteix l'estat forçat correcte.
   - ✅ Desplegable real (`setPhaseMode`, canvi de votació a `tancat`):
     funciona igual que abans — mode i estat desats, i la revelació de noms en
     tancar la votació també.
   La lògica de precedència (`obert` → sempre obert, `tancat` → sempre tancat,
   `calendari` → dates) no s'ha tocat: el canvi només afecta **qui desa**, no
   què es calcula.

   **Nota metodològica** (error propi, útil per a proves futures): en un primer
   intent semblava que l'admin no desava. No era el codi: en canviar de soci a
   admin **a la mateixa pestanya**, `state.objectives` conservava el recàlcul
   que ja havia fet el soci en memòria (`logout()` no reinicia l'estat, a
   diferència de `switchDbMode()`), així que l'admin no detectava cap canvi i no
   tenia res a desar. Amb una càrrega neta de pàgina (cas real: cada usuari al
   seu navegador) funciona correctament. Per provar aquest automatisme cal
   recarregar la pàgina entre usuaris, no només fer logout/login.
   **Pas 4b — FET i VERIFICAT (27/07/2026).** Migració aplicada a Test i després
   a Normal (verificat a Normal que la funció existeix amb la signatura correcta
   i que `anon` no la pot cridar: `permission denied`). Codi de client
   commitejat (`25a270d`) i confirmat desplegat a `fem-foto.vercel.app`.
   Supabase Auth passa a ser qui decideix l'accés; `fem_login()` queda degradat a
   xarxa de seguretat. Canvis a `js/screens/login.js`, `js/core/config.js`,
   `js/features/socis.js` i `js/core/i18n.js`, més una migració petita
   (`sql/2026-07-27_auth_migracio_pas4b_sync_email.sql`).

   **Com decideix l'accés ara** (`handleLogin`): el camp "Usuari / Email" accepta
   email o nom complet, però `signInWithPassword()` només entén emails — si el
   que s'escriu no és un email, es resol el nom contra `state.users` (lectura ja
   permesa, sense contrasenya) per obtenir-lo. Si Auth valida, el perfil (nom,
   rol) es llegeix de `state.users` i s'entra. Si Auth NO valida, es cau al
   camí de reserva `fem_login()`, que cobreix dos casos legítims: (a) contrasenya
   reiniciada per un admin (a `public.users` queda buida, així que Auth no la pot
   validar mai) → obre el modal de nova contrasenya, com sempre; i (b) qualsevol
   compte que per un desajust no tingui parella a `auth.users` → entra, però
   sense sessió real, i queda constància a la consola perquè es pugui
   diagnosticar. Cap usuari es queda fora en cap dels dos casos.

   **Sessió persistent** (decisió d'Enric): la sessió real és la de Supabase
   Auth, que el SDK desa a `localStorage` amb una clau per projecte (Normal i
   Test no es trepitgen). En arrencar, `init()` mira si hi ha sessió d'Auth
   vàlida i entra directament. El `sessionStorage` antic es manté només com a
   xarxa de seguretat del camí de reserva, perquè el comportament no empitjori
   mai respecte d'abans.

   **"Sortir" ara tanca la sessió de debò** — abans `logout()` només esborrava el
   `sessionStorage` i la sessió d'Auth seguia viva al navegador; amb sessió
   persistent això hauria tornat a entrar sol a la recàrrega següent.

   **Sessió caiguda des de fora**: `onAuthStateChange` escolta `SIGNED_OUT`
   (token de refresc invalidat, logout des d'una altra pestanya) i torna a la
   pantalla d'accés amb un avís, en lloc de deixar l'app oberta amb una identitat
   morta i totes les escriptures fallant en silenci. Els nostres propis
   `signOut()` passen per `signOutSilently()` perquè no disparin aquest avís.

   **Canvi Normal↔Test**: abans s'hi entrava sense contrasenya (`enterAsEmail`),
   cosa que no pot generar cap sessió real d'Auth i, des del Pas 3b/3c, deixava
   el mode Test sense poder escriure res. Regla nova: **entrar a NORMAL sempre
   demana login** (es tanca qualsevol sessió que hi hagués, com fins ara), i la
   sessió de TEST es conserva, de manera que la primera vegada cal fer login a
   Test i a partir d'aleshores el canvi torna a ser immediat.

   **Desajust d'email tancat** (`sql/..._pas4b_sync_email.sql`): el panell de
   Socis canviava l'email amb un UPDATE directe a `public.users`, sense tocar
   `auth.users`. Ara que la identitat es resol per email, això hauria deixat
   aquell soci sense poder iniciar sessió real amb l'adreça nova. Nova RPC
   `fem_admin_set_email()` (`SECURITY DEFINER`, admin-only, `REVOKE` a `anon`)
   que escriu a `public.users`, `auth.users` i `auth.identities` alhora — mateix
   patró que ja calia per a les contrasenyes al Pas 3b.

   **Provat en viu a Test** (servint en local, amb dos comptes de prova creats i
   esborrats en acabar):
   - ✅ Login pel **nom complet** (no email) → resolt i amb sessió real d'Auth.
   - ✅ Recàrrega de pàgina → segueix dins; i **també amb el `sessionStorage`
     esborrat** (equivalent a tancar i reobrir la pestanya), que és la prova que
     qui restaura la sessió és Auth i no el mecanisme antic.
   - ✅ "Sortir" → token esborrat del navegador i, en recarregar, pantalla
     d'accés.
   - ✅ Contrasenya incorrecta → mateix missatge d'error de sempre, sense sessió.
   - ✅ Contrasenya reiniciada per l'admin → modal de nova contrasenya i, en
     acabar, sessió real establerta.
   - ✅ Admin canvia l'email d'un soci → les tres taules sincronitzades, i el
     soci entra amb l'adreça nova, amb `auth.uid()` resolent la seva identitat i
     **un vot escrit correctament**.
   - ✅ Sessió tancada des de fora → l'app torna a la pantalla d'accés.
   - ✅ Test→Normal → demana login i conserva la sessió de Test; accés directe a
     Test reaprofitant-la, verificat.
   Test restaurat: 50 usuaris / 50 comptes d'Auth, sense orfes.

   **Nota metodològica**: una primera prova de l'accés directe a Test va donar
   fals negatiu. No era el codi: en canviar de mode sense estar loguejat,
   `switchDbMode()` buida `state.users` i només les recarrega dins la branca
   d'accés directe, així que cridant la funció a mà les dades encara no hi eren.
   Al camí real sí que es carreguen abans.

   **Pas 4c — FET i VERIFICAT als dos projectes (27/07/2026)**, incloent-hi la
   prova amb un correu real de cap a cap. Pendent només el desplegament del codi
   de client (commit + push).
   Migració: `sql/2026-07-27_auth_migracio_pas4c_reset_contrasenya.sql`
   (rollback a `sql/2026-07-27_auth_migracio_pas4c_rollback.sql`). Purament
   additiva: una funció nova, cap política RLS ni cap dada tocada.

   **El forat que calia tancar, i que no era evident**: `resetPasswordForEmail`
   (i `updateUser({password})`) només canvien `auth.users.encrypted_password`. A
   `public.users.password` hi quedaria la contrasenya ANTIGA en clar, i el camí
   de reserva del Pas 4b (`fem_login()`) l'acceptaria perfectament: qui sabés la
   contrasenya vella seguiria entrant a l'app després del reset (sense poder
   escriure, per la RLS del Pas 3b/3c, però veient totes les dades). **Un reset
   que no revoca la contrasenya anterior no és un reset.** És el mateix patró de
   desincronització ja resolt al Pas 3b (contrasenyes) i al Pas 4b (email), amb
   un tercer cas que hi faltava: el propi usuari canviant-se la contrasenya des
   d'una sessió de recuperació.

   **Solució**: RPC `SECURITY DEFINER` `fem_set_own_password(p_new_password)`,
   que escriu les dues taules dins la mateixa transacció. No rep cap id
   d'usuari: la identitat surt EXCLUSIVAMENT d'`auth.uid()` (la sessió que ha
   creat l'enllaç del correu), així que ningú pot canviar la contrasenya d'un
   tercer. Lliçó del Pas 4a aplicada des del primer minut: comprovació
   explícita `IF v_uid IS NULL THEN RETURN false` (no una comparació que amb
   NULL donaria NULL i es colaria), més `REVOKE EXECUTE ... FROM anon` com a
   segona barrera. Verificat a Test: `anon` → `permission denied`.

   **Canvis de client**: `js/screens/login.js` (enllaç "Has oblidat la
   contrasenya?", botó d'enllaç màgic, modal d'accés per correu, detecció de la
   tornada de l'enllaç i mode recuperació del modal de nova contrasenya),
   `index.html`, `css/login.css`, `js/core/i18n.js` (ca+es) i `js/core/config.js`.

   **Tres detalls tècnics que no són obvis i que ja estan resolts:**
   - **El SDK esborra el fragment de la URL de manera asíncrona.** Els enllaços
     tornen amb `#access_token=...&type=recovery`, i supabase-js el processa i
     el neteja en arrencar. Si això passa abans que `init()` hagi enganxat
     `onAuthStateChange`, l'esdeveniment `PASSWORD_RECOVERY` es perd i l'usuari
     entra a l'app sense que ningú li demani la contrasenya nova. Es llegeix el
     fragment sincrònicament en carregar el mòdul (sempre arriba primer) i el
     listener es manté com a segona xarxa; un guard evita obrir el modal dues
     vegades. Verificat que el SDK carregat (2.110.8) fa servir `flowType:
     'implicit'` i `detectSessionInUrl: true`, que és el que fa vàlid aquest
     mecanisme.
   - **Els enllaços porten `?db=normal|test`.** El testimoni només el pot
     validar el client del MATEIX projecte que l'ha emès, i el mode actiu viu a
     `localStorage`: sense això, demanar un enllaç en mode Test i obrir-lo amb
     l'app en mode Normal donaria un error incomprensible. Es llegeix a
     `config.js` abans de crear el client.
   - **Enllaç caducat o ja fet servir**: Supabase no crea sessió i torna l'error
     a la mateixa URL. Es detecta i es mostra un avís, en lloc de deixar
     l'usuari mirant la pantalla d'accés sense entendre per què no ha entrat.

   **Decisions de producte**: l'enllaç màgic va com a botó secundari sota la
   contrasenya, no com a opció principal (qui ja té el seu costum no ha de notar
   cap canvi); `shouldCreateUser:false`, perquè un enllaç màgic no pugui crear
   mai un compte d'Auth sense fila a `public.users`; i si l'email o el nom no
   consten a `state.users` es diu clarament ("No consta cap compte amb aquestes
   dades") en lloc d'un "correu enviat" que no arribaria mai — per a aquest
   públic és molt més útil, i no revela res que la taula d'usuaris no exposi ja.

   **Provat a Test (27/07/2026)**, servint en local (mai `file://`), amb un
   compte d'usar i llençar creat i esborrat per a la prova:
   - ✅ `anon` cridant `fem_set_own_password` → `permission denied`.
   - ✅ Els dos modals, amb els textos correctes i el canvi entre ells.
   - ✅ Email/nom inexistent → avís clar, sense enviar cap correu.
   - ✅ Tornada de l'enllaç de recuperació (simulada amb el fragment exacte que
     emet GoTrue, amb testimonis reals del projecte): l'app **no entra a l'app**
     i obre el modal de contrasenya nova.
   - ✅ Després de desar: `public.users.password` I `auth.users.encrypted_password`
     tots dos actualitzats (comprovació bcrypt de round-trip).
   - ✅ **La contrasenya VELLA queda revocada pels dos camins**: `fem_login` →
     `invalid`, i Auth → `invalid_credentials`. Aquest és el punt crític.
   - ✅ La sessió sobreviu al canvi i **pot escriure**: vot escrit a la BD des de
     la pantalla real de votació.
   - ✅ `?db=normal|test` canvia efectivament de projecte en carregar.
   Test restaurat: 50 usuaris / 50 comptes d'Auth, 0 sense parella, 0 orfes.

   **Nota metodològica (falsa alarma, val la pena recordar-la)**: la primera
   prova de la tornada de l'enllaç semblava fallar — el modal no s'obria. No era
   el codi: navegar d'una URL a la mateixa URL canviant només el `#` és una
   navegació dins el mateix document, i el navegador **no recarrega la pàgina**,
   així que l'app no es reinicialitzava mai. Amb una càrrega completa (el cas
   real: s'arriba des del client de correu) funciona a la primera.

   **Prova amb correu REAL, de cap a cap (27/07/2026, projecte Test)**, un cop
   Enric va configurar el tauler. Compte d'usar i llençar amb l'àlies
   `enricmr+femtest@gmail.com` (arriba a la seva safata però no és cap compte
   real), creat i esborrat per a la prova:
   - ✅ Correu demanat des del formulari real de l'app escrivint el **nom**
     ("TEST Correu 4c"), no l'adreça — queda provat que la resolució nom→email
     també funciona en aquest flux, no només al login.
   - ✅ Registres d'Auth: `POST /recover`, `status:200`,
     `user_recovery_requested`, 16:41:55 UTC, `referer:
     http://localhost:3000/?db=test`.
   - ✅ Correu rebut per Enric, amb la plantilla en català.
   - ✅ Enllaç clicat → l'app s'obre en mode Test, **no entra**, demana la
     contrasenya nova; posada, entra correctament.
   - ✅ Verificació posterior a la BD **sense necessitat de saber la contrasenya
     que va triar**: `crypt(public.users.password, auth.users.encrypted_password)
     = auth.users.encrypted_password` → cert, és a dir les dues taules escriuen
     el mateix secret. I la vella ja no consta enlloc.
   - ✅ Contrasenya VELLA revocada pels dos camins: `fem_login` → `invalid`,
     Auth → `invalid_credentials`.

   **L'enllaç màgic es va provar a part, també amb correu real** — no s'havia de
   donar per bo el Pas 4c havent verificat només la meitat. Segon compte d'usar i
   llençar amb el mateix àlies: correu demanat des de l'app, rebut, i en clicar
   l'enllaç **entra directament a l'app sense demanar cap contrasenya**
   (comportament deliberadament diferent del de recuperació: el `type=magiclink`
   de la URL no dispara el modal, que només reacciona a `type=recovery`).
   Confirmat també a la BD: `auth.users.last_sign_in_at` actualitzat al moment
   del clic.
   Test restaurat: 50 usuaris / 50 comptes d'Auth, 0 sense parella, 0 orfes, cap
   resta dels comptes de prova.

   **Aplicat a NORMAL (27/07/2026)**: mateixa migració, verificada allà amb
   `has_function_privilege` (`anon` → false, `authenticated` → true) i amb la
   crida real per API com a `anon` → `permission denied`. La configuració del
   tauler (Site URL, Redirect URLs, plantilles, caducitat) Enric la va fer als
   dos entorns alhora.

   **Caducitat de l'enllaç: 3600 s, no 86400.** La recomanació inicial de posar-hi
   24 h es va rectificar en veure que l'analitzador de seguretat de Supabase avisa
   sempre que passi d'una hora. Dos motius per fer-li cas: el cas real són minuts
   (s'intenta entrar, es falla, es demana l'enllaç i s'obre el correu tot seguit),
   i si caduca el cost és baix i autoservei (l'avís ja programat diu que se'n
   demani un de nou); en canvi l'avís del panell es quedaria encès per sempre i
   taparia troballes futures. Verificat amb `get_advisors` que ha desaparegut dels
   dos projectes.

   **Deixat expressament com està**: la *Leaked Password Protection*
   (comprovació contra HaveIBeenPwned) segueix desactivada. Rebutjaria
   contrasenyes febles en el registre i en cada reset, i amb la mitjana d'edat
   del club (~65 anys) és fricció que no compensa en aquesta app.

   **Configuració del tauler de Supabase feta per Enric (27/07/2026)** als dos
   projectes:
   - Authentication → URL Configuration → *Site URL*:
     `https://fem-foto.vercel.app`
   - Authentication → URL Configuration → *Redirect URLs*: afegir-hi
     `https://fem-foto.vercel.app/**` i `http://localhost:3000/**` (aquesta
     última per poder provar-ho en local abans de desplegar; es pot treure
     després).
   - Authentication → Providers → Email → *Email OTP Expiration*: **3600 s**
     (vegeu més amunt per què no 86400).
   - Authentication → Emails → Templates: enganxar les plantilles en català de
     més avall (**Reset Password** i **Magic Link**).

   **Plantilles de correu en català** (variable `{{ .ConfirmationURL }}` = enllaç
   generat per Supabase):

   *Reset Password* — assumpte:
   `Recupera la teva contrasenya — FEM Fotografia El Masnou`

   ```html
   <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:520px;">
     <h2 style="font-size:22px;margin:0 0 16px;">Recupera la teva contrasenya</h2>
     <p>Hola,</p>
     <p>Has demanat crear una contrasenya nova per entrar a l'app de FEM Fotografia El Masnou. Prem el botó i te la deixarem canviar:</p>
     <p style="margin:28px 0;">
       <a href="{{ .ConfirmationURL }}" style="background:#1877f2;color:#ffffff;text-decoration:none;font-size:17px;font-weight:bold;padding:14px 28px;border-radius:8px;display:inline-block;">Crear una contrasenya nova</a>
     </p>
     <p>Si el botó no funciona, copia aquesta adreça al navegador:<br>
       <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
     </p>
     <p style="color:#666;">Si no has demanat res, pots ignorar aquest correu: la teva contrasenya no canviarà.</p>
     <p style="color:#666;">FEM Fotografia El Masnou</p>
   </div>
   ```

   *Magic Link* — assumpte:
   `El teu enllaç per entrar — FEM Fotografia El Masnou`

   ```html
   <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:520px;">
     <h2 style="font-size:22px;margin:0 0 16px;">Entra a l'app</h2>
     <p>Hola,</p>
     <p>Prem el botó per entrar a l'app de FEM Fotografia El Masnou. No et cal recordar cap contrasenya:</p>
     <p style="margin:28px 0;">
       <a href="{{ .ConfirmationURL }}" style="background:#1877f2;color:#ffffff;text-decoration:none;font-size:17px;font-weight:bold;padding:14px 28px;border-radius:8px;display:inline-block;">Entrar a l'app</a>
     </p>
     <p>Si el botó no funciona, copia aquesta adreça al navegador:<br>
       <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
     </p>
     <p style="color:#666;">Si no has demanat aquest correu, pots ignorar-lo.</p>
     <p style="color:#666;">FEM Fotografia El Masnou</p>
   </div>
   ```

5. **Configurar SMTP extern i plantilles de correu** — requisit dur, no
   opcional (§1.4 més amunt: el servei integrat no envia a adreces que no
   siguin de l'equip del projecte, no és un tema de volum). **Decidit
   (26/07/2026): es fa servir el domini propi del club**,
   `femfotografiaelmasnou.cat` (registrat a Nominalia, 3 comptes de correu
   ja actius, `info@` inclòs) — millor que un proveïdor extern genèric,
   ja que els socis veuen els correus venint del propi domini del club.
   Paràmetres SMTP de Nominalia (confirmats a la seva documentació):
   servidor `authsmtp.securemail.pro`, port `465`, SSL, usuari = l'adreça
   completa (p. ex. `info@femfotografiaelmasnou.cat`), contrasenya = la
   del compte. Coincideix amb el format que demana el formulari SMTP de
   Supabase (host/port/usuari/contrasenya), port 465 inclòs entre els que
   Supabase admet als seus propis exemples. Volum esperat (uns pocs
   correus/mes per a 50 socis) molt per sota de qualsevol límit raonable
   d'un compte de correu normal. Acció d'Enric al tauler de Supabase
   (Authentication → Emails → SMTP Settings), amb la contrasenya del
   compte — no requereix cap intervenció de codi.

   **FET i VERIFICAT (26/07/2026), per avançat** — Enric ja ho ha
   configurat a Normal i a Test, abans d'arribar als passos 1-4. Provat
   amb una prova de fum al projecte Test: crida a l'endpoint públic
   d'Auth (`/auth/v1/otp`, amb la clau anon, `create_user:true`) per a
   `enricmr@gmail.com`, sense tocar cap taula ni codi de l'app.
   Confirmat als logs d'Auth (`get_logs`) que el límit d'enviament va
   passar de `2/1h` (el valor per defecte del servei integrat) a `30`
   (el valor per defecte quan hi ha SMTP extern actiu) — prova que la
   configuració de Nominalia és efectiva, no només desada. **Correu rebut
   confirmat per Enric**: remitent `FEM Fotografia El Masnou
   <info@femfotografiaelmasnou.cat>`, assumpte "Confirm your email
   address", a la safata d'entrada (no spam). Usuari de prova esborrat
   després (`auth.users`, Test, sense cap rastre a `public.users` ja que
   els passos 1-2 encara no s'han fet). **El circuit de correu (SMTP →
   Auth → safata d'entrada) queda validat de cap a cap abans, fins i tot,
   de començar la migració real.**
6. **Provar a fons a Test, després Normal** — login amb contrasenya
   existent intacta, reset per correu, magic link, i que les polítiques RLS
   noves no bloquegin cap operació legítima de l'app.
7. **Retirada del sistema vell** — `fem_login()` i la gestió manual de
   sessió deixen de fer-se servir (no cal esborrar-los de seguida, mateix
   criteri de "amagar, no eliminar" ja aplicat a Fase 3).

**Nota autònoma per obrir quan s'aborda Zampa** (Enric ha demanat que
quedi redactada aquí, per passar-me-la a mi mateix en una sessió futura
centrada en Zampa, sense haver de re-derivar aquest context):

> Foto ha migrat el seu login de la taula `public.users` (contrasenya en
> clar, comparada al client) a Supabase Auth (`auth.users`, amb una columna
> pont `public.users.auth_user_id uuid` que enllaça amb l'`id` text
> existent, sense tocar cap clau forana). Abans de fer res a Zampa, cal
> comprovar el seu codi font: **si Zampa també fa login comparant
> `public.users.password` en clar (el mateix patró que tenia Foto), cal
> migrar-lo també a Supabase Auth (mateix projecte, mateixos comptes via
> `auth_user_id`)** — si no es fa, Zampa quedaria trencat si mai
> s'arriba a buidar/deixar de mantenir la columna `password`. A més, la
> Fase 1.3/1.4 de Foto ha endurit les polítiques RLS d'algunes taules
> (`users` entre d'altres) — cal revisar si les taules pròpies de Zampa
> (`zampa_projects`, `zampa_photos`, `zampa_editions`, `zampa_user_ranks`,
> totes amb polítiques `USING(true)` igual de permissives, detectades als
> mateixos advisors de seguretat — vegeu §1.2) necessiten el mateix
> tractament (`auth.uid()` en lloc de confiar en el client), ara que ja hi
> ha sessions reals disponibles per a totes dues apps.

---

## 1.5 El Reset de contrasenya de l'admin (28/07/2026)

Fora de la numeració dels passos: no era una peça planificada de la migració, sinó una
conseqüència seva que se'ns havia escapat. Va sortir en repassar què quedava al calaix.

### Què es va comprovar, i com

La sospita era només llegida del codi: `doResetMemberPassword()` (`socis.js:81`) feia
`update({ password: '' })` sobre `public.users` i prou. Es va provar **en viu a Test, amb
comptes que existien de debò** (un admin i una víctima d'un sol ús, esborrats després), perquè
una prova d'autorització amb un id inventat ja ens havia donat un verd fals el 27/07:

| Pas | Resultat |
|---|---|
| Reset fet com el fa l'app (PATCH `/users` amb la sessió real d'un admin) | `204` |
| Estat a la BD | `public.users.password` buida, `auth.users.encrypted_password` **intacte** |
| Login amb la contrasenya **vella**, després del Reset | **`200`, entra amb sessió real** |
| `fem_login()` amb la vella | `reset_required` — però no s'hi arriba mai |

**El Reset no revocava res.** Des del Pas 4b `handleLogin()` valida primer amb
`signInWithPassword()` i, si va bé, entra i retorna: el camí que obria el modal de contrasenya
nova havia quedat inabastable.

### El forat que va sortir provant-ho

Pitjor que el primer. Amb **només la clau anon pública i l'email del soci**, sense cap sessió:

1. `fem_login(email, <qualsevol cosa>)` → `reset_required` **i l'id del soci**, sense comprovar
   cap contrasenya (per disseny: buida = n'ha de triar una).
2. `fem_set_new_password(id, pw)` → estava concedida a `anon` i només comprovava que la
   guardada fos buida. **Cap prova d'identitat en tot el camí.**
3. Login amb la nova → sessió real com aquell soci.

Executat de veritat: va tornar `true` i es va obtenir la sessió. La finestra només era oberta
per als comptes amb contrasenya buida —entre el Reset i el moment que el soci en triava una de
nova— i el dia de la comprovació n'hi havia **0 a Normal (de 41) i 0 a Test (de 50)**.

**Conseqüència d'ordre que això destapa**: el **Pas 4d**, que buida `users.password` per a
tothom, hauria posat els 41 comptes reals en aquell estat de cop. No es podia fer 4d abans
d'això.

### El canvi

Es va descartar pedaçar-ho: un "posa contrasenya a partir d'un id, obert a l'anònim" no es pot
fer segur, perquè en aquell moment el soci no té sessió ni res amb què demostrar qui és. Es
retira el mecanisme de contrasenya buida sencer.

- **`fem_admin_reset_password(user_id)`** (nova, admin-only): genera una contrasenya temporal de
  8 caràcters sense ambigus (O/0, I/l/1 — es dicta per telèfon a socis de ~65 anys) amb
  `gen_random_bytes`, l'escriu a `public.users` **i** `auth.users`, **esborra les sessions
  obertes del soci** (`auth.sessions`/`auth.refresh_tokens`: la sessió és persistent des del Pas
  4b, i sense això qui tingués l'app oberta al mòbil no en sortiria) i la retorna a l'admin.

  ⚠️ **Matís comprovat el 29/07/2026, i important**: esborrar aquelles files **no fa fora a
  l'instant** qui ja tingui l'app oberta. El navegador conserva el testimoni d'accés (JWT) que
  ja tenia, i la RLS el valida per la signatura, sense consultar `auth.sessions`. Mentre aquell
  testimoni no caduqui, aquella finestra segueix llegint **i escrivint**, i recarregar la pàgina
  tampoc no la fa fora (el SDK llegeix el testimoni de `localStorage` i, si no és a prop de
  caducar, no parla amb el servidor). Qui la fa fora és el **primer intent de renovació**: el
  refresh token ja no existeix, el SDK emet `SIGNED_OUT` i `_listenAuthChanges()`
  ([login.js](js/screens/login.js)) torna a la pantalla d'accés. És a dir: la revocació era
  **efectiva però diferida** fins a la caducitat del testimoni, fins a una hora.
  **Resolt el mateix dia**: el sondeig de 30 s de `startAutoRefresh()` (`js/core/router.js`) ara
  valida la sessió contra el servidor i tanca la sessió local si la rebutja — expulsió en 30 s com
  a màxim, verificada a la interfície. Vegeu `docs/PROVES_Fase4.md`, incidència 1.11 i Annex B.
- **`fem_set_new_password`**: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`. No
  s'esborra, es queda sense privilegis (mateix criteri d'amagar i no esborrar).
- **`fem_login`**: una contrasenya buida a la BD retorna `invalid`, no `reset_required`. El
  `IF ... = ''` s'ha de mantenir explícit: sense ell, la comparació de sota faria que una
  contrasenya buida encaixés amb un `p_password` buit i tornés `ok` — i FEM-Reptes decideix
  l'accés amb el resultat d'aquesta funció.
- **Client** (les dues apps): el Reset mostra la temporal en un modal, un sol cop, amb botó de
  copiar. A FEM-Foto el modal de "crea una nova contrasenya" queda només per a la recuperació
  per correu; a FEM-Reptes, que no en té, s'ha retirat del tot.

### Dos paranys trobats pel camí, tots dos ja vistos abans en una altra forma

**1. `REVOKE EXECUTE ... FROM anon` no fa res tot sol.** Tota funció nova neix amb `EXECUTE`
concedit a `PUBLIC`, i `anon` hi arriba per aquí (`=X/postgres` a `pg_proc.proacl`). Cal
`FROM PUBLIC, anon`. És exactament el mateix parany que el `REVOKE` de columna del 26/07, que
tampoc no feia res mentre hi hagués un `GRANT` de taula sencera: **quan el permís ve d'una
concessió més ampla, revocar el cas particular no la sobreescriu.** Detectat perquè es va
comprovar amb `has_function_privilege()` en lloc de donar el `REVOKE` per bo. Les migracions del
Pas 4a-4c ja ho feien bé; la primera versió d'aquesta el va copiar malament.

**2. `app_texts` guanya al diccionari del codi.** Canviar el text del modal de confirmació a
`js/core/i18n.js` no tenia cap efecte: `mergeTranslations()` fusiona el `jsonb` d'`app_texts`
**per sobre** de `TRANSLATIONS`, i aquella clau hi era des del 15/07. Es va veure perquè la
pantalla seguia dient "el soci haurà de crear-ne una de nova" amb el codi nou carregat. El text
va per `UPDATE` a la BD (Part 2 de la migració).

### Estat: tancat als dos entorns (28/07/2026)

Es va aplicar en l'ordre que la BD compartida obliga: **Part 1 a Normal** (additiva, no canvia
el comportament del codi ja desplegat) → **desplegar les dues apps** (commits `0bab336` a
FEM-Foto i `0772b63` a FEM-Reptes, comprovat que els fitxers servits ja portaven el codi nou a
`fem-foto.vercel.app` i a `www.femfotografiaelmasnou.cat`) → **Part 2 a Normal**.

Verificat a **Test** amb comptes d'un sol ús i per la interfície de les dues apps servides en
local; i a **Normal** amb comptes d'un sol ús (mai un soci real):

| Comprovació | Resultat |
|---|---|
| Contrasenya vella després del Reset | rebutjada pels dos camins (`invalid_credentials` / `invalid`) |
| Contrasenya temporal | entra pels dos camins |
| Sessió que el soci ja tenia oberta, **en intentar renovar-la** | `refresh_token_not_found` |
| `anon` cridant `fem_admin_reset_password` | `permission denied` |
| Soci autenticat **no** admin resetejant un **altre compte que existeix** | `null`, no fa res |
| `anon` cridant `fem_set_new_password` | `permission denied` |
| Els 41 socis reals: `public.users` ↔ `auth.users` | 41/41 sincronitzats, 0 amb contrasenya buida |

I finalment **a l'app antiga en viu** (`www.femfotografiaelmasnou.cat`), que és la lliçó del 28/07:
carrega les dades sense error, el Reset des del panell de Socis mostra la temporal, el soci entra
amb ella i **no** amb la vella, i una escriptura al servidor amb aquella sessió funciona
(`fem_set_own_password` → `true`, `fem_current_user_id()` resol) — que era exactament el que
aquell dia fallava en silenci.

Comptes d'un sol ús esborrats de les tres taules. Normal a 41/41 i Test a 50/50, 0 orfes, 0
contrasenyes buides, 1059 vots i 86 fotos intactes.

---

## 1.6 Filtre d'alta — cens de socis FEM autoritzats (02/08/2026)

Fora de la numeració dels passos, com §1.5: no és migració d'Auth pròpiament dita, però hi
encaixa perquè toca la mateixa RPC (`fem_register_account`). Petició d'Enric: l'app no tenia
cap filtre per registrar-se — qualsevol email podia crear-se un compte. Calia restringir-ho al
cens real de socis de la FEM.

### La decisió: taula a part, no columna a `users`

Enric va proposar dues opcions:

- **A — taula separada** (`email` + `rol_per_defecte`).
- **B — columna nova a `users`** (la seva preferència inicial), pre-carregant-hi files per als
  socis de la FEM encara no usuaris de l'app.

Es va descartar B per dos motius, tots dos ja documentats a altres punts d'aquest projecte:

1. **`users` és compartida amb Zampa** (§B, i l'incident del 28/07 — vegeu
   `docs/REFERENCIA_BD.md`). Qualsevol canvi d'esquema aquí s'ha de comprovar contra les dues
   apps.
2. **El propi requisit trenca la invariant de la taula.** El cens ha d'incloure socis que
   *encara no són usuaris de l'app*. Avui una fila de `users` vol dir "compte real":
   `fem_register_account()` en crea l'`auth.users` corresponent a la mateixa transacció
   (§1.4, Pas 4a). Pre-carregar-hi files sense compte real hauria convertit el registre en
   "busca la fila pre-existent i completa-la" en lloc d'un `INSERT` net, i hauria barrejat
   comptes reals amb pendents a la pantalla d'admin de Socis i a qualsevol lectura de Zampa.

Enric hi va estar d'acord i es va tirar per l'opció A.

### El que es va construir

- **Taula `public.socis_fem_autoritzats`** (`sql/2026-08-02_socis_fem_autoritzats.sql`):
  `email` (PK), `rol_per_defecte` (`participant`/`expert`/`admin`), `created_at`. RLS activada,
  4 polítiques, totes `fem_is_admin()` — ni `anon` ni `authenticated` normal hi tenen cap accés
  (ni tan sols lectura: així no es pot fer servir per confirmar si un email concret hi és abans
  de provar-lo a l'auto-registre).
- **Càrrega inicial**: tots els emails que ja tenien compte, amb el seu rol d'avui (52 a Test,
  41 pendents a Normal quan s'apliqui).
- **`fem_register_account()` actualitzada**: abans de crear res, `SELECT rol_per_defecte FROM
  socis_fem_autoritzats WHERE email = v_email`; si no hi és, `RETURN 'not_authorized'`. Si hi
  és, el rol del compte nou surt d'aquí (abans sempre `'participant'`, forçat pel servidor).
  Segueix sense ser un paràmetre de la crida — només un admin pot escriure al cens (RLS de
  dalt), així que no es pot escalar privilegis cridant l'RPC directament per API.
- **Gestió des de l'admin**: subpestanya nova, Admin → Socis → **Socis FEM** (al costat de la
  gestió d'usuaris existent, ara **Usuaris app**). Alta (email + rol), canvi de rol per
  defecte inline, baixa amb confirmació. Sense RPC pròpia: `sb.from('socis_fem_autoritzats')`
  directe des del client, gated només per la RLS admin-only — el mateix patró que ja fan
  servir `objectives`/`photo_submissions` (a diferència de `users`, aquesta taula no necessita
  escriure enlloc més, així que no calia el patró RPC+doble-escriptura de §B).
- **Estil**: els selects de rol (aquí i als d'Usuaris app, `changeRole`/`changeZampaRole`) no
  portaven cap classe i el navegador els pintava amb el desplegable blanc del sistema —
  inconsistent amb la resta de l'app. Classe nova `.field-compact` (`css/admin.css`), mateixa
  recepta que `.obj-mode-select` de Reptes (`color-scheme: dark` + fons fosc + vora): és
  `color-scheme: dark` el que evita el desplegable blanc, no només el color del `<select>`
  tancat.

### Bug trobat i corregit pel camí

`email` és ambigu dins la funció: `RETURNS TABLE (..., email text, ...)` declara una columna de
sortida amb aquest nom, i `WHERE email = v_email` dins el cos xoca amb ella
(`42702: column reference "email" is ambiguous`). Calia qualificar-ho amb un àlies de taula
(`sfa.email`). Trobat perquè es va provar la funció de veritat abans de donar-la per bona, no
donant per fet que compilava (sí que ho fa, `CREATE OR REPLACE` no valida els cossos de les
funcions PL/pgSQL fins que s'executen).

### Verificació (Test, 02/08/2026)

Amb comptes i emails d'un sol ús, esborrats després:

| Comprovació | Resultat |
|---|---|
| Email fora del cens → `fem_register_account` | `not_authorized`, cap fila creada |
| Email al cens amb `rol_per_defecte='expert'` → `fem_register_account` | `ok`, compte creat amb `role='expert'` (no `participant`), `auth_user_id` enllaçat |
| Alta des del panell (Admin → Socis FEM → + Afegir) | Fila nova, toast, reflectida a la taula |
| Canvi de rol per defecte des del panell | `UPDATE` confirmat per SQL |
| Baixa des del panell, amb confirmació | Fila esborrada, toast |
| Canvi d'idioma CA↔ES amb la pestanya oberta | Selects de rol i taula es repinten (calia enganxar `renderSocisFemTable` a `applyTranslations()`, com ja fa `renderMembersTable`) |
| `color-scheme: dark` aplicat de veritat | Confirmat per `getComputedStyle()`, no només visualment |

### Estat: tancat als dos entorns (02/08/2026)

Migració i codi de client aplicats i verificats a **Test** (52 emails carregats) i **Normal**
(41 emails carregats), el mateix dia. A Normal es va verificar només el camí de rebuig
(`not_authorized` amb un email de prova, cap fila creada) — el camí d'acceptació no es va
tornar a provar en producció perquè és exactament el mateix codi ja verificat de cap a cap a
Test, i crear-hi un compte real només per provar-ho hauria estat un risc innecessari.

Falta: carregar-hi els socis de la FEM encara no usuaris de l'app quan Enric passi la llista
— es pot fer per SQL directe, sense esperar cap pantalla ni una altra migració, com ja es va
fer amb la càrrega inicial. `fem_admin_create_member` (l'alta feta per l'admin des del panell)
es queda **sense aquest filtre a propòsit** — decisió d'Enric: l'admin ja és una barrera de
confiança i ha de poder donar d'alta algú puntualment encara que hi hagi un despistat al cens.

### Primera càrrega complementària (03/08/2026)

Enric va passar el cens oficial de la FEM en captures de pantalla (38 emails). Contrastat amb
`socis_fem_autoritzats`: 27 ja hi eren (coincidien amb comptes ja donats d'alta), 11 eren nous.
D'aquests 11, 4 no eren persones noves de debò — el nom coincidia amb un compte ja existent amb
un **email diferent** (Jordi Santmiquel, Eliana Maridueña, Marianne Schiffels, José Antonio
Sancho Pastor). Decisió d'Enric: **no afegir-los al cens**, per no obrir la porta a un segon
autoregistre amb l'altre email — tècnicament inofensiu, però crearia un compte duplicat amb
fotos/vots repartits entre tots dos, un problema real ja viscut (vegeu més avall). Afegits
només els **7 genuïnament nous**: `11937gms@comb.cat`, `alvarezplanas@gmail.com`,
`bdominguezh@gmail.com`, `gloriademimon@gmail.com`, `helena@helenabuira.com`,
`monicasola11@gmail.com`, `sacrigarciaaviles@yahoo.es`. Cens resultant: 48 a Normal (41+7), 58
a Test (52+6, un dels 7 ja hi era per una altra prova).

**El cas Sancho Pastor ja estava resolt.** Enric recordava tenir-lo amb dos comptes actius i
volia identificar quin s'havia de conservar per donar de baixa l'altre. Comprovat: a **Normal**
només existeix `contacto@joseantoniosancho.com` (2 fotos publicades) —
`sql/2026-07-25_merge_duplicate_user_sancho.sql` ja va fusionar-hi `sanchopastor@gmail.com` el
25/07/2026, movent-ne l'única foto i esborrant la fila buida. **A Test sí que hi conviuen
encara tots dos** (`sanchopastor@gmail.com` amb 1 foto, `contacto@joseantoniosancho.com` amb
0) — el mateix fitxer ja deixava constància que a Test no calia tocar-ho perquè no reproduïa el
problema. Cap acció pendent a Normal.

---

## 2. Navegació (refresc de pàgina, botó enrere)

### 2.1 Estat actual (inventari)

Confirmat per grep a tot `js/` i `index.html`: **cap ús** de
`history.pushState`, `replaceState`, `location.hash`, `hashchange` ni
`popstate` enlloc de l'app.

- **Pantalles** (`router.js:37-96`, `showScreen`/`showAdminScreen`/
  `showParticipantScreen`): toggling pur de `classList` sobre `.screen`.
- **Panells dins de "participant"** (`participant.js:20-32`,
  `_hideAllParticipantPanels` + `showParticipantXxx()`): un segon nivell
  d'estat, també pur `classList`, sense relació amb la URL — dashboard,
  votació, rànquing, galeria, resultats, valoració, classificació,
  puntuació... tot viu només en memòria JS.
- **Persistència de sessió** (`sessionStorage`, §1.1): recorda **qui** ha
  fet login, mai **on** és dins l'app.
- Sense manifest ni service worker (app no és PWA instal·lable) — és un únic
  `index.html` servit estàtic (`vercel.json`, sense rewrites rellevants més
  enllà de `/web`).

### 2.2 Conseqüències concretes

- **Refrescar (F5)**: sempre torna al dashboard principal (participant o
  admin) després de restaurar la sessió — es perd qualsevol panell obert
  (votació, galeria...). Molest però no destructiu: els vots ja es desen
  autosave-per-clic (Fase 3), no depenen de "no refrescar".
- **Botó "enrere" del navegador**: no fa **res** conscient de l'app — com no
  hi ha cap entrada a l'historial per a les pantalles internes, prémer
  enrere surt directament de Foto cap a el que hi hagués obert abans
  (una altra pàgina, cercador, o res). Per a un usuari que hi ha entrat
  des d'un enllaç guardat o icona d'inici, pot semblar que "l'app s'ha
  tancat sola".
- **"Endavant"**: tampoc torna a obrir l'app, pel mateix motiu.
- **Enllaços directes**: impossible enviar a un soci un enllaç que obri
  directament, per exemple, el Resultat d'un repte concret — tot arrenca
  sempre des de l'arrel.

### 2.3 Opcions de millora

**A — Mitigació mínima**: avís `beforeunload` només quan hi hagi vots sense
desar (`window._hasUnsavedVotes`, ja existent) — evita el pitjor cas concret
(perdre vots per un refresc/tancament accidental) sense tocar res més.

**B — Routing per hash** (`#participant/voting`, `#admin/socis`...) amb
`pushState`/`popstate` cridant les funcions `showXxx()` ja existents.
Encaixa bé amb l'arquitectura actual (només cal afegir listeners i llegir/
escriure el hash als punts on ja es criden `showParticipantXxx()`/
`showAdminScreen()` etc., sense reescriure res del render). Resultat: F5
torna al mateix panell, enrere/endavant naveguen de veritat per dins
l'app, i els enllaços directes tornen a ser possibles. És la solució
"de debò" i coherent amb el que ja estava flagged com a pendent.

**C — Llibreria de routing de tercers**: descartada — sobredimensionada
per a una app vanilla-JS sense build ni framework; B és assolible a mà amb
el mateix estil que la resta del codi.

**Recomanació**: **B**, fet incremental (començar per les pantalles de
participant, que són les que més es visiten, ampliar a admin després) —
mateixa filosofia "pas a pas" que la Fase 3.

---

## 3. Relació amb la resta del pla

Aquests dos temes són **transversals a tota l'app**, independents de la
numeració de Fases 0-7 de `FEM-Foto_Unificacio_Pla-desenvolupament.md`
(que és sobre la unificació Reptes+Resultats i el canvi de puntuació). No
formen part del tall pendent (§6 d'aquell document) ni el bloquegen — es
poden abordar en paral·lel o abans, com Enric prefereixi.

---

## 4. Preguntes concretes per decidir abans de tocar codi

1. ~~**Prioritat entre els dos temes**: es fa primer l'enduriment RLS (§1.3-A,
   ràpid i urgent per exposició real de dades) i la navegació després, o a
   l'inrevés?~~ **Resolta (26/07/2026)** — es va fer el tros mínim de B
   (§1.3 FET) en lloc d'A sola, en detectar que A no tancava el forat real.
   Navegació encara sense començar.
2. ~~**Abast de l'auth ara mateix**: només fer A, o decidir ja entre B i C?~~
   **Resolta (26/07/2026)** — es tria **C (Supabase Auth)**, vegeu §1.4, per
   obtenir de franc el reset per correu i el magic link que Enric vol.
3. ~~Si s'acaba triant C: quin pla per als 41 comptes existents i per la
   coordinació amb Zampa?~~ **Resolta (26/07/2026)** — es preserven les
   contrasenyes actuals (sense forçar reset general, pel perfil d'usuari);
   Zampa el gestiona el mateix Enric, nota de traspàs pròpia a §1.4 per
   quan s'aborda.
4. Per la **navegació (B)**: es fa per a totes les pantalles de cop, o
   només participant primer (com proposo) i admin en una segona ronda?
   **Encara oberta.**
5. Voleu que aquest treball quedi documentat com una "Fase" pròpia
   (numerada, tipus Fase 4/5...) al pla general, o preferiu mantenir-lo
   com a document independent (aquest) referenciat des d'allà? **Encara
   oberta.**
