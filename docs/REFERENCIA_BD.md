# Referència de la base de dades

Estat real dels dos projectes Supabase, llegit directament de Normal
(`ogqqcgbgcqowvywaolln`) el **27/07/2026**. Test (`xxydxdsiunfwzkcffdai`) té la mateixa
estructura; on hi hagi diferències, es diu explícitament.

> Aquest document descriu **què hi ha**. El *per què* de cada decisió és als documents
> d'anàlisi (`ANALISI_Fase3_Puntuacio.md`, `ANALISI_Login_Navegacio.md`).

---

## Taules

### Vives, de FEM-Foto

| Taula | Columnes | Contingut |
|---|---|---|
| `objectives` | 17 | El **repte**. Font única de veritat, calendari inclòs (des del 24/07/2026) |
| `photo_submissions` | 11 | Fotos pujades (`published`, `revealed`, `caption`) |
| `votes` | 9 | Un vot per usuari+foto+repte |
| `seguiment_votacio` | 5 | Marca si un usuari ha enviat el vot definitiu d'un repte (`es_esborrany`) |
| `users` | 9 | Socis. **Compartida amb l'app Zampa** — vegeu l'avís de sota |
| `app_settings` | 5 | Configuració clau/valor + mirall dels punts de la Classificació General |
| `app_texts` | 4 | Textos editables de l'app, per idioma (`jsonb`) |

**`objectives`** — `id`, `name`, `description`, `status` (`active`/`finished`/`inactive`),
`created_by`, `start_date`/`end_date` (creació i finalització del repte, **no** el calendari),
`uploads_enabled`/`voting_enabled`/`names_revealed` (estat efectiu d'avui, el que llegeix la
resta de l'app), `cal_upload_start`/`cal_upload_end`/`cal_voting_start`/`cal_voting_end`
(finestres), `upload_mode`/`voting_mode` (`calendari`/`obert`/`tancat`, per fase),
`cover_image_url`.

`getActiveCalendar(objectiveId)` (`js/features/calendari.js`) és el punt d'accés correcte als
camps de calendari — internament ja llegeix `objectives`, cap altra part de l'app ho ha de saber.

**`votes`** — `creativity`, `theme`, `composition` (sistema antic, 0-5 cadascun) i `valoracio`
(`numeric`, 0-10, sistema nou). `valoracio` la manté sincronitzada el trigger
`fem_sync_valoracio()` a partir dels tres criteris antics (×10/15). Conseqüència pràctica: qui
escrigui `valoracio` directament ha d'escriure **també** els tres criteris amb
`valoracio/2` cadascun, o el trigger li trepitjarà el valor. Vegeu `ANALISI_Fase3_Puntuacio.md`, Pas 4.

**`users`** — `id` (text, `u_...`), `display_name`, `email`, `password`, `role`, `created_at`,
`zampa_role`, `submitted_at`, `auth_user_id` (uuid, pont cap a `auth.users`, afegit al Pas 1
de la migració d'Auth).

> ⚠️ **`users` és compartida amb l'app Zampa** del club (taules `zampa_*`). Qualsevol operació
> en cascada (`TRUNCATE`, `DELETE` massiu) hi esborraria dades. Comprovar-ho **sempre** abans
> de tocar aquesta taula. Hi ha una nota de traspàs per a quan s'abordi Zampa a
> `ANALISI_Login_Navegacio.md` §1.4.

> ⚠️ **`users.password` segueix guardant la contrasenya en clar.** El client ja no la pot
> llegir (revocat a la Fase 1.3) i Supabase Auth ja és qui decideix l'accés (Pas 4b), però la
> columna encara existeix i el camí de reserva `fem_login()` encara la fa servir. Buidar-la
> és feina del **Pas 4d**, pendent de comprovar abans si Zampa en depèn.

> 🔥 **Aquesta revocació va tombar l'app antiga durant dos dies (26→28/07/2026).** FEM-Reptes
> demanava `password` a la seva consulta de `users` i, en no poder-la llegir, li fallava **tota**
> la càrrega (`permission denied for table users`). Ja està arreglada (ara entra per Supabase
> Auth, com aquesta app). Es deixa escrit perquè és el precedent que explica la regla de sota.
>
> **Regla, mentre FEM-Reptes visqui**: tot canvi de **permisos de columna, esquema o RLS** en
> aquesta base de dades s'ha de comprovar contra **les dues apps**, no només contra FEM-Foto.
> Una manera ràpida de saber què fa l'app antiga sense sortir d'aquest repo: el seu codi
> original és el primer commit de FEM-Foto (`3ddb85a`, "Punt de partida: còpia de FEM-Reptes").
> Els candidats immediats són el Pas 4d i qualsevol `REVOKE`/`DROP COLUMN` sobre `users`.

> ⚠️ **`app_texts` guanya sempre al diccionari del codi.** `mergeTranslations()`
> (`js/core/i18n.js`) fusiona el `jsonb` de la BD **per sobre** de `TRANSLATIONS`, i la BD porta
> ~325 claus a `ca` i ~322 a `es`. Conseqüència pràctica, i costa una estona d'entendre-la la
> primera vegada: **canviar un text a `i18n.js` no té cap efecte si la clau ja és a `app_texts`**.
> El codi només és la xarxa de seguretat per a les claus que la BD encara no té. Si un text que
> canvia al codi ha de canviar de debò, cal un `UPDATE` sobre `app_texts` (exemple:
> `sql/2026-07-28_reset_admin_part2_tancament.sql`, punt 3).

> ⚠️ **`auth_user_id` tampoc no és llegible** per `anon`/`authenticated` (mai se li va donar el
> `GRANT` després del `REVOKE` de tota la taula). Conseqüència pràctica: **`select('*')` sobre
> `users` falla** per a qualsevol client. Cal enumerar sempre les columnes.

### Mortes, encara presents

| Taula | Estat |
|---|---|
| `reptes_calendari` | Absorbida per `objectives` el 24/07/2026. **Cap lectura ni escriptura** des de llavors, ni del frontend ni del cron. Es manté per període d'observació. |
| `settings` | Residu d'una etapa anterior. No es llegeix. |

Eliminar-les serà sempre una acció manual a l'editor SQL, mai des del frontend (ADR-015).

### De l'app Zampa (no tocar des d'aquí)

`zampa_projects`, `zampa_photos`, `zampa_editions`, `zampa_user_ranks`. Totes conserven
polítiques RLS permissives (`USING(true)`) — l'enduriment de FEM-Foto no les ha tocat. És
feina de Zampa, no d'aquest projecte.

---

## Funcions RPC (`fem_*`)

Des de la migració a Supabase Auth, aquestes funcions **són la superfície de seguretat de
l'app**: tot el que el client no pot fer directament (per RLS) hi passa pel mig. Totes són
`SECURITY DEFINER` excepte on s'indiqui.

| Funció | Qui la pot cridar | Què fa |
|---|---|---|
| `fem_login(identity, password)` | anon, auth | Valida contrasenya al servidor i retorna dades no sensibles. **Camí de reserva** des del Pas 4b. Una contrasenya buida a la BD retorna `invalid` (abans `reset_required`) |
| `fem_is_admin()` | anon, auth | `true` si `auth.uid()` és d'un admin. Base de les polítiques RLS |
| `fem_current_user_id()` | anon, auth | `users.id` de la sessió actual |
| `fem_register_account(name, email, password)` | anon, auth | Auto-registre. Rol **forçat** a `participant` pel servidor |
| `fem_admin_create_member(name, email, password, role)` | anon*, auth | "Nou Soci" des del panell. Gated per `fem_is_admin()` |
| `fem_delete_account(user_id)` | **auth** | Baixa (admin o un mateix). Esborra `public.users` **i** `auth.users` |
| `fem_bootstrap_admin(name, email, password)` | anon, auth | Primer admin + `app_settings`. Només amb `users` buida |
| `fem_create_account_row(...)` | **ningú** | Helper intern. Sense privilegis per a anon ni authenticated |
| `fem_set_new_password(user_id, password)` | **ningú** | Retirada el 28/07/2026 (vegeu sota). Es manté al catàleg sense privilegis, no s'ha esborrat |
| `fem_admin_reset_password(user_id)` | **auth** | El Reset del panell de Socis. Genera una contrasenya temporal, l'escriu a les dues taules, tanca les sessions obertes del soci i la retorna a l'admin |
| `fem_admin_set_password(user_id, password)` | anon*, auth | Un admin canvia la contrasenya d'un soci |
| `fem_set_own_password(password)` | **auth** | L'usuari es canvia la seva. Identitat **només** per `auth.uid()` |
| `fem_admin_set_email(user_id, email)` | **auth** | Canvi d'email sincronitzat a les tres taules |
| `fem_apply_calendar()` | anon*, auth | Aplica els modes de calendari. La crida el cron diari |
| `fem_sync_valoracio()` | — | Trigger sobre `votes` (no és `SECURITY DEFINER`) |

### La regla que les explica gairebé totes

**Tota dada d'identitat que visqui a `public.users` i a `auth.users` alhora s'ha d'escriure a
totes dues dins la mateixa transacció.** Aquesta regla va néixer de tres incidents seguits
(contrasenya reiniciada per admin al Pas 3b, canvi d'email al Pas 4b, reset per correu al Pas
4c) i el 28/07/2026 en va caçar un **quart** (el Reset del panell de Socis, vegeu sota). Totes
les vegades, escriure'n només una deixava el soci sense poder entrar o, pitjor, deixava la
contrasenya antiga vàlida. Si algun dia s'afegeix un tercer camp compartit, ha de seguir el
mateix patró.

### El Reset de contrasenya de l'admin (canviat el 28/07/2026)

Fins aquell dia, el Reset **buidava** `public.users.password` i el soci en triava una de nova al
pròxim accés (`fem_login` → `reset_required` → `fem_set_new_password`). Comprovat en viu que
aquell disseny tenia dos problemes:

1. **No revocava res.** Buidar `public.users` no toca `auth.users`, i des del Pas 4b el login
   valida primer amb `signInWithPassword()`: el soci seguia entrant amb la contrasenya vella i
   el modal de contrasenya nova no s'obria mai.
2. **Qualsevol podia segrestar un compte reiniciat.** Amb la clau anon pública i l'email del
   soci: `fem_login(email, <qualsevol cosa>)` retornava `reset_required` **i l'id** sense
   comprovar cap contrasenya, i `fem_set_new_password(id, pw)` estava concedida a `anon` i només
   comprovava que la guardada fos buida — cap prova d'identitat. La finestra durava des del
   Reset fins que el soci triava contrasenya.

Ara el Reset crida `fem_admin_reset_password(user_id)`, que genera una **contrasenya temporal**
(8 caràcters, sense els ambigus O/0/I/l/1, amb `gen_random_bytes`), l'escriu a les dues taules,
esborra `auth.sessions`/`auth.refresh_tokens` del soci —la sessió és persistent des del Pas 4b,
sense això un soci amb l'app oberta al mòbil no en sortiria— i la retorna a l'admin, que l'hi fa
arribar.

⚠️ **Esborrar aquelles files no expulsa, tot sol, una finestra ja oberta** (comprovat a la
interfície el 29/07/2026): la RLS valida el testimoni d'accés (JWT) per la signatura, sense
consultar `auth.sessions`, i recarregar la pàgina tampoc no hi fa res. Fins al 29/07 el soci
seguia dins —i escrivint— fins que el testimoni intentava renovar-se, o sigui fins a una hora.
**Resolt des del client**: el sondeig de 30 s de `startAutoRefresh()` (`js/core/router.js`) valida
la sessió contra el servidor i, si la rebutja, tanca la sessió local. Expulsió en 30 s com a
màxim. Detall: `docs/PROVES_Fase4.md`, incidència 1.11 i Annex B. `fem_set_new_password` queda sense privilegis i `fem_login` ja no retorna
`reset_required`.

**Conseqüència per al Pas 4d**: buidar `users.password` per a tothom era, amb el disseny antic,
posar els 41 comptes en estat segrestable de cop. Amb això aplicat ja no ho és — però l'ordre
segueix important: primer aquest canvi, després el 4d.

### Inconsistència detectada (27/07/2026, no corregida)

Les marcades amb **\*** (`fem_admin_create_member`, `fem_admin_set_password`,
`fem_apply_calendar`) segueixen sent executables per `anon`. **No són un forat obert**: les
dues primeres es comproven internament amb `fem_is_admin()`, que retorna un `EXISTS` i mai
`NULL`. Però trenquen el criteri de doble barrera que sí que apliquen les funcions més noves
(`REVOKE EXECUTE ... FROM PUBLIC, anon` a més de la comprovació interna). Val la pena alinear-les —
és un `REVOKE` de tres línies, sense risc. `fem_apply_calendar()` ja estava apuntada com a
observació a `ANALISI_Login_Navegacio.md` §1.2.

⚠️ **Que hi digui `FROM PUBLIC, anon` i no només `FROM anon` no és estètica** (comprovat el
28/07/2026 a Test): tota funció nova neix amb `EXECUTE` concedit a `PUBLIC`, i `anon` hi arriba
per aquí. Un `REVOKE ... FROM anon` tot sol **no fa res** —`has_function_privilege('anon', ...)`
segueix dient `true`— igual que el `REVOKE` de columna del 26/07 no feia res mentre hi hagués un
`GRANT` de taula sencera. Comprovar sempre el resultat, no donar el `REVOKE` per bo.

---

## RLS

Totes les taules tenen RLS activada. Des del Pas 3b/3c (27/07/2026), les polítiques de les
taules de FEM-Foto es basen en `auth.uid()` a través de `users.auth_user_id`, no en
`USING(true)`. Nombre de polítiques per taula: `users` 6, `objectives` 4, `photo_submissions`
4, `votes` 4, `seguiment_votacio` 3, `app_settings` 3, `app_texts` 2.

Pendent (Pas 4d): eliminar `users_insert_*` i `users_delete_*`, que són l'últim camí
d'escriptura anònima a `public.users`. **Bloquejat** fins a comprovar si Zampa dona altes pel
seu compte.

---

## Cron

| Job | Freqüència | Comanda |
|---|---|---|
| `fem-calendar` | `5 0 * * *` (00:05 UTC) | `select public.fem_apply_calendar();` |

⚠️ `fem_apply_calendar()` **referencia els noms de taula com a text dins el cos de la funció**.
Un `RENAME TABLE` no l'actualitza sol (Postgres només ho fa amb les vistes). Si algun dia es fa
el renombrat pendent `objectives` → `reptes`, aquesta funció s'ha de reescriure a mà.

---

## Auth

- `auth.users` i `auth.identities` poblades per als 41 socis de Normal i els 50 de Test.
- Enllaç amb `public.users` per la columna pont `auth_user_id` (uuid, únic, FK amb
  `ON DELETE SET NULL`).
- Es poden crear comptes **per SQL directe**, sense l'Admin API, xifrant la contrasenya amb
  `extensions.crypt(pw, extensions.gen_salt('bf'))` — és exactament el format que GoTrue
  comprova. Validat al Pas 2 i fet servir per totes les RPC d'altes.
- **SMTP**: servidor de correu propi del club (`authsmtp.securemail.pro:465`, SSL,
  `info@femfotografiaelmasnou.cat`), configurat als dos projectes.
- **Configuració del tauler** (als dos projectes): Site URL `https://fem-foto.vercel.app`;
  Redirect URLs `https://fem-foto.vercel.app/**`, `http://localhost:3000/**`,
  `https://www.femfotografiaelmasnou.cat/**` i `https://femfotografiaelmasnou.cat/**` (les dues
  del domini, afegides per avançat el 29/07/2026; inertes fins al tall — vegeu `docs/TALLS.md`);
  Email OTP Expiration **3600 s**; Leaked Password Protection **desactivada a propòsit** (rebutjaria
  contrasenyes febles a cada registre i reset — fricció que no compensa per a aquest públic).
