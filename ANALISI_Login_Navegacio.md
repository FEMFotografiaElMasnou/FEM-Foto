# FEM-Foto — Anàlisi: sistema de login/autenticació i navegació de l'app

> Document d'anàlisi previ a qualsevol modificació (mateix format que
> `ANALISI_Fase3_Puntuacio.md`). Objectiu: mapejar l'estat real del codi i la
> BD en aquests dos aspectes transversals de tota l'app, detectar riscos
> concrets i deixar decisions obertes per triar amb Enric abans d'escriure
> cap línia de codi. **Cap fitxer de codi s'ha tocat per fer aquest document.**
> Les dades de seguretat (§1.2) provenen dels advisors reals de Supabase
> (MCP `get_advisors`) consultats el 2026-07-26 sobre els dos projectes
> (Normal `ogqqcgbgcqowvywaolln` i Test `xxydxdsiunfwzkcffdai`), no de
> suposicions sobre el codi.

## 0. Per què ara

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
   **Pas 4b — FET i VERIFICAT a Test (27/07/2026). NO aplicat encara a Normal.**
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
