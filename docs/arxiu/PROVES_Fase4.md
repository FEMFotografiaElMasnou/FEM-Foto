# Fase 4 — Proves internes (històric)

> **Document arxivat (05/08/2026).** Fase 4 tancada el 02/08/2026, els 10 blocs en verd —
> vegeu el resum a `FEM-Foto_Unificacio_Pla-desenvolupament.md`. Es conserva com a registre
> del guió seguit i de les incidències trobades pel camí (algunes, com la regla de "prova
> d'autorització amb una fila real", ja són a `CLAUDE.md`).

Guió de proves de FEM-Foto **abans** d'ensenyar-la als socis (Fase 5) i abans del tall de domini
(Fase 6). Obert el 29/07/2026.

**Què és aquesta fase**: repassar l'app sencera, un cop, amb criteris escrits, i deixar constància
de què s'ha comprovat i amb què. **Què no és**: la validació amb socis (Fase 5), ni una auditoria
de seguretat (ja feta pels seus passos a `ANALISI_Login_Navegacio.md`).

---

## Regles d'execució

1. **Tot a Test** (`xxydxdsiunfwzkcffdai`), excepte els punts marcats **[N]**, que són lectures
   sense escriptura i es fan a Normal (`ogqqcgbgcqowvywaolln`) perquè el que s'hi comprova són
   *les dades reals*.
2. **Cap escriptura a Normal des d'aquest guió.** Si un punt sembla demanar-la, és que està mal
   escrit: atura't i canvia el guió, no la base.
3. **Servint per HTTP** (`npx serve`, `http://localhost:3000`) o des de
   `https://fem-foto.vercel.app`. Mai per `file://`: els mòduls ES no carreguen.
4. **Els comptes de prova són d'un sol ús** i es donen de baixa en acabar. No es reciclen entre
   blocs: un compte que ja ha votat no serveix per provar "el primer vot".
5. **Una prova negativa d'autorització** (comprovar que algú **no** pot fer una cosa) es fa
   **sempre amb una fila que existeixi de veritat**. Amb un id inventat, la funció surt pel camí
   de "no trobat" i el verd no prova res. Va passar el 27/07/2026.
6. **Cada punt es tanca amb un verd o amb una incidència**, mai amb "sembla que sí". Les
   incidències van a §Registre, al final.
7. **Un canvi, una comprovació.** Encadenar quatre canvis i mirar el servidor al final només
   demostra l'últim: els estats intermedis ja no hi són. Va passar al punt 3.2 el 30/07/2026 i va
   caldre repetir-lo pas a pas. Si el punt té diverses transicions, es verifica cadascuna.

### Preparatius

- [ ] Dos navegadors (o finestra normal + finestra privada) per tenir **dues sessions alhora**:
      una d'admin i una de soci. Fa falta a gairebé tots els blocs.
- [ ] A Test, un repte de treball amb almenys **3 fotos publicades** i **2 socis que hi puguin
      votar**, per poder veure rànquings amb empats i desempats.
- [ ] Saber quin sistema de puntuació té cada base: Test **«Nou» (0-10)**, Normal **«Antic»
      (3×5)**, comprovat el 29/07/2026. Els blocs 5 i 6 demanen commutar Test i tornar-la a
      deixar com estava.

---

## 1 · Accés i sessió

| # | Prova | Verd si |
|---|---|---|
| 1.1 | Entrar amb **email + contrasenya** | Entra i cau a la pantalla del seu rol |
| 1.2 | Entrar amb **nom complet + contrasenya** | Igual que 1.1 (el nom es resol contra `state.users` abans de cridar Auth) |
| 1.3 | Contrasenya equivocada | Missatge d'error clar, **sense** dir si l'usuari existeix |
| 1.4 | Usuari inexistent | Mateix missatge que 1.3 |
| 1.5 | **Sessió persistent**: entrar, tancar la pestanya, tornar a obrir l'app | Segueix dins sense tornar a escriure la contrasenya |
| 1.6 | **Sortir** | Torna al login i, en tornar a obrir l'app, ja **no** hi entra sol |
| 1.7 | **Enllaç màgic** ("Entrar amb un enllaç per correu") | Arriba el correu del remitent del club, l'enllaç entra a l'app i la sessió queda oberta |
| 1.8 | **Recuperació de contrasenya** ("Has oblidat la contrasenya?") | Arriba el correu, deixa posar-ne una de nova, i **la nova entra i la vella ja no** |
| 1.9 | **Auto-registre** amb un email nou | Compte creat i entra tot seguit, sense confirmació ni aprovació. Rol resultant **`participant`** (comprovar-ho a la BD, no fiar-se de la pantalla) |
| 1.10 | Auto-registre amb un email **ja existent** | Error entenedor, i **no** es crea cap segon compte |
| 1.11 | **Reset de l'admin** (panell → Socis → Reset) | Mostra una contrasenya temporal; la temporal entra, **la vella ja no**, i si el soci tenia sessió oberta en una altra finestra, **en queda fora en 30 s com a màxim, sense tocar-la** |

> 1.8 i 1.11 comproven el mateix invariant per dos camins: la contrasenya s'escriu a
> `public.users` **i** a `auth.users` alhora. És l'única cosa que ha fallat quatre vegades en
> aquest projecte (§B de `ANALISI_Login_Navegacio.md`). Si algun dels dos punts es posa vermell,
> és un blocador, no una molèstia.

**Bloc 1 tancat el 29/07/2026.** Els onze punts en verd, amb dues coses trobades pel camí: el
Reset no expulsava la finestra oberta fins que el testimoni caducava (**incidència 1.11**,
corregida i verificada, Annex B), i «Sortir» resulta que tanca la sessió **també al servidor**,
que és més del que demanava el criteri. Comprovat a més, per SQL, que a Test i a Normal **totes**
les contrasenyes coincideixen entre `public.users` i `auth.users` (51/51 i 41/41, cap compte
sense parella a `auth.users`).

---

## 2 · Rols i visibilitat

| # | Prova | Verd si |
|---|---|---|
| 2.1 | Soci `participant` | Veu la pantalla de participant i **cap camí d'interfície** cap al panell d'admin. ✅ Verificat el 29/07/2026 (a la pantalla i al codi: `_enterApp()` reparteix per rol i `toggleAdminParticipantView()` surt si el rol no és admin). Matís escrit a posta: `window.showAdminScreen` no comprova el rol, així que des de la **consola** del navegador se'n pot pintar la carcassa. No exposa dades noves (la llista de socis ja la carrega tothom, el login per nom la necessita) i les escriptures les rebutja el servidor (RLS + `fem_is_admin()`) |
| 2.2 | `admin` | Té accés a **les 5 seccions del sidebar** (Fotos, Reptes, Socis, Textos, Puntuació) i pot entrar a totes. ✅ Verificat el 29/07/2026: en són cinc, i són les que han de ser des de la compactació del panell (Votacions, Controls i Calendari es van moure a cada targeta de repte el 18/07/2026, a petició de Pablo) |
| 2.3 | `expert` | Entra com un participant normal. **L'únic efecte del rol és el filtre de vots** (bloc 7). ✅ Verificat el 30/07/2026 a Test amb el compte real «Jordi Farrus»: pantalla de participant, rètol de rol dient «Expert», navegació idèntica a la d'un soci i cap camí cap al panell. Comprovat per SQL que va entrar **per Auth i no pel camí de reserva** (`auth.sessions` de 0 → 1, `refresh_tokens` 1, `last_sign_in_at` de l'instant), cosa que amb aquest compte no era gratuïta —vegeu la incidència 2.3 al registre. I que el rol no dona res més enlloc: **0 polítiques de RLS** esmenten `expert` i l'única funció que el nomena és `fem_admin_create_member`, per acceptar-lo com a valor vàlid; al client, els únics usos són el filtre de `ranking.js`, el rètol de `participant.js` i la protecció del badge a `socis.js` |
| 2.4 | Admin → **"veure com a participant"** | Les targetes de resultats són les que toquen **segons el commutador**, no segons el rol (això és el que va canviar al Pas D). **Dues excepcions legítimes**, que depenen del rol **real** i per tant no desapareixen en aquest mode: el distintiu `3×5`/`0-10` (hi ha de ser: serveix precisament per saber quina pantalla es revisa) i la targeta de Galeria, que l'admin també veu quan hi ha repte **actiu** i encara no cap de finalitzat. ✅ Verificat el 30/07/2026 a Test (sistema Nou, repte «Repte de proves» a la capçalera: pujada tancada i votació oberta): la píndola passa a `PARTICIPANT ⇄` i «Sortir» deixa lloc a la ✕, es veuen les targetes `0-10` i s'amaguen les `3×5`, els distintius **hi són** (rol real) amb `0-10` al mosaic, i la pujada i la votació queden gatejades com per a un soci qualsevol —amb el botó de descàrrega del lightbox retirat, que és el contrast net contra el mode admin normal. Matís: l'excepció de la Galeria **no s'ha pogut distingir** perquè Test té reptes finalitzats i la targeta es veuria igual sense ella |
| 2.5 | Distintiu `3×5`/`0-10` | El veu **qui té rol admin real** i **mai** un soci, i diu el sistema actiu a cada targeta de les parelles. A Galeria no n'hi ha d'haver: el commutador no l'afecta |
| 2.6 | `force_hide_upload`, `force_hide_vote`, `force_hide_resultats`, `force_hide_classificacio` | ⚠️ **Aquest punt estava mal plantejat i queda reformulat** (29/07/2026): aquests quatre valors **ja no es poden tocar des de la interfície** — no hi ha cap control a `index.html`, perquè es van retirar amb la compactació del panell. Avui només es poden canviar per SQL. El que sí que s'ha comprovat, i és el que importa, és que **tots quatre valen `false` a les dues bases**, o sigui que no estan amagant res en silenci. El codi que els llegeix segueix viu (`participant.js`, `fotos.js`) i funcionaria si algú els posés a `true` per SQL |

**Bloc 2 tancat el 30/07/2026.** Els sis punts en verd (2.1, 2.2, 2.5 i 2.6 el 29; 2.3 i 2.4 el 30),
amb una incidència de dades trobada pel camí —l'expert sense adreça de correu (registre, 2.3)— i el
2.6 reformulat perquè el que demanava ja no es pot clicar. Els quatre `force_hide_*` no tornen a
sortir com a condició de cap punt: són codi inert, i van al calaix 3 de `docs/NETEJA_codi_mort.md`.

---

## 3 · Repte i calendari

| # | Prova | Verd si |
|---|---|---|
| 3.1 | Crear un repte des del panell (Reptes) | Es crea amb `status = active` i surt a la pantalla del soci. ✅ Verificat el 30/07/2026 a Test amb «ZZ Prova B3 (esborrable)» (`obj_1785414100165`): neix `active`, amb `uploads_enabled` i `voting_enabled` a `false`, `upload_mode`/`voting_mode` a `calendari` i les quatre dates buides —els valors per defecte de les columnes—, i surt a la capçalera del soci amb tot tancat. **Va caldre deixar-lo com a únic repte actiu** per poder-ho comprovar: vegeu les dues notes de sota |
| 3.2 | `upload_mode` i `voting_mode` a **`obert`** i a **`tancat`** | Manen sobre les dates: obert deixa fer sempre, tancat no deixa mai. ✅ Verificat el 30/07/2026 a Test sobre «ZZ Prova B3», que **no té cap data de calendari**: `obert` obre i `tancat` tanca igualment (`uploads_enabled` a `true` amb les quatre dates buides). Comprovada també la regla de negoci heretada: **posar la votació a `obert` força la pujada a `tancat`** al mateix instant (`setPhaseMode`, `patch.upload_mode='tancat'`), vist a la pantalla i a la base |
| 3.3 | `upload_mode`/`voting_mode` = **`calendari`** amb finestres passades i futures | `uploads_enabled`/`voting_enabled` acaben coherents amb les finestres. ✅ Verificat el 30/07/2026 a Test sobre «ZZ Prova B3», amb els cinc casos comprovats un per un a la base: pujada amb finestra **passada** → tancada; pujada amb finestra que **conté avui** → oberta; votació amb finestra **futura** → tancada; votació amb finestra que **conté avui** → oberta; i l'intent de posar l'inici de votació el mateix dia que acaba la pujada → **rebutjat** amb avís, sense desar-se (`updateCalendarDate`, marge mínim d'1 dia). ⚠️ Parany trobat pel camí: el mode `obert` que havia quedat del punt 3.2 feia veure una votació oberta que **no** provava el camí del calendari. Amb un mode forçat, les dates no demostren res: comprovar sempre que els dos desplegables siguin a `Calendari` abans de llegir el resultat |
| 3.4 | **Cron `fem-calendar`** (00:05 UTC, `fem_apply_calendar()`) | Executada a mà a Test, deixa els estats efectius com toca i **no** toca cap repte `finished`. ✅ Verificat el 30/07/2026, i **fent-la fallar en lloc de donar-la per bona**: es van desquadrar els valors a posta abans d'executar-la (al repte actiu, pujada `true` i votació `false`, just al contrari del que diuen les finestres; i a «Escales», `finished`, pujada `true`). Després de la crida, el repte actiu queda **corregit** i «Escales» **segueix desquadrada** —restaurada tot seguit—, que és la prova que la funció només recorre `status='active'`. El cron existeix i s'executa de debò: `5 0 * * *`, actiu, **27 execucions, totes `succeeded`**, l'última el 30/07 a les 00:05 UTC (`cron.job_run_details`) |
| 3.5 | Imatge de portada del repte: posar-la i treure-la | Es veu i desapareix, sense deixar l'URL penjat. ✅ Verificat el 30/07/2026 a Test: en posar-la, `cover_image_url` queda amb l'URL de Cloudinary a `FemReptes_TEST/_cover_reptes` (comprovat que respon **HTTP 200**, `image/jpeg`) i la capçalera del repte la mostra amb el degradat; en treure-la, la columna queda a **`NULL`** —no a cadena buida— i la capçalera torna al fons pla. **El fitxer es queda a Cloudinary**, com tot a l'app: el frontend no esborra res (ADR-015). ⚠️ Pel camí va semblar que no es veia: la portada es pinta a `#objective-header`, que viu **dins** de `card-objective-photo`, i amb la **votació oberta** aquella targeta sencera s'amaga i la substitueix la de «Votar el repte» (`updateUploadSection`, fotos.js:199-221). Per provar aquest punt cal que el repte sigui en fase de **pujada** |
| 3.6 | Finalitzar un repte | Passa a `finished`, apareix a Galeria i a la Classificació General. ✅ Verificat el 30/07/2026 a Test amb «ZZ Prova B3»: `status='finished'`, `end_date` d'avui, pujada i votació a `false`, i surt tant al desplegable de Galeria com de columna a la Classificació General —amb «—» a tothom, perquè no té cap foto—, igual que «ZZ Prova A2». Detall menor: els **modes** no es reinicien en finalitzar (queden `obert`/`tancat`); inofensiu, perquè `fem_apply_calendar()` no toca els `finished`. ⚠️ Pel camí va sortir la **incidència 3.6** del registre |

**Bloc 3 tancat el 30/07/2026.** Els sis punts en verd, amb un repte de proves creat a posta
(«ZZ Prova B3») i deixat com a **únic actiu** perquè els criteris fossin comprovables. Una incidència
trobada (**3.6**, el mirall `general_ranking`) i tres coses que el bloc ha obligat a saber:

> **Tres coses que aquest bloc ha obligat a saber** (30/07/2026):
>
> 1. **«Surt a la pantalla del soci» només és comprovable amb UN repte actiu.** `state.currentObjective`
>    agafa el primer `status = 'active'` que troba (`data.js:253`) i el `select` d'`objectives` no porta
>    cap `.order()`: amb més d'un actiu, quin surt és arbitrari. Per al bloc 3 s'han deixat «Contrallums»
>    i «Repte de proves» com a `inactive` a Test, amb la marxa enrere apuntada a §Dades de prova.
> 2. **`fem_apply_calendar()` tampoc no toca els reptes `inactive`**, no només els `finished` (vist al
>    3.4). Conseqüència: un repte que es torni a activar arrossega l'estat efectiu que tenia el dia que
>    es va desactivar, fins que algú el recalcula —el cron de la nit següent, o un admin obrint el
>    panell (`applyAllActiveCalendars()`). Al Test del 30/07 «Contrallums» va quedar amb la pujada
>    oberta mentre era inactiu.
> 3. **El sondeig de 30 s no veu els canvis d'`objectives`.** La signatura que compara
>    (`startAutoRefresh()`, [router.js](../js/core/router.js)) només porta valors d'`app_settings` i els
>    recomptes de fotos i de vots. Crear, activar o finalitzar un repte des d'una altra sessió **no**
>    arriba sol a qui té l'app oberta: cal recarregar. Els canvis de **fase** sí que hi arriben, perquè
>    viuen al mirall d'`app_settings`. No és una incidència del guió —cap punt ho promet— però afecta
>    com es proven el 3.1 i el 3.6, i val la pena saber-ho abans de la Fase 5.

---

## 4 · Pujada de fotos

| # | Prova | Verd si |
|---|---|---|
| 4.1 | Soci puja una foto amb la pujada oberta | Puja a Cloudinary i queda visible per a ell, **no** per als altres fins a publicar-la. ✅ Verificat el 31/07/2026 a Test amb «Contrallums» (pujada oberta per calendari) i un compte d'un sol ús («TEST Bloc4 A»): la foto queda a Cloudinary (`FemReptes_TEST/contrallums/`), `published=false` a la BD, i la targeta «La meva foto» la mostra només a ella |
| 4.2 | Pujar amb la pujada **tancada** | No hi ha camí per fer-ho. ✅ **Verd des del 31/07/2026** (vegeu incidència 4.2 al registre): es va trobar que la UI amagava la zona de pujada però ni `uploadPhoto()` ni la política RLS d'`INSERT` comprovaven `uploads_enabled` — disparant l'event de canvi a mà (consola) es pujava una foto igualment. **Corregit el mateix dia**: política `photo_submissions_insert_own` endurida (exigeix `uploads_enabled=true` al repte o `fem_is_admin()`) + guarda bessona a `uploadPhoto()`. Reprovat exactament igual (mateixa consola, mateix compte «TEST Bloc4 B», «Contrallums» tancat): ara `[error] Photo insert error` a la consola i cap fila nova a la BD |
| 4.3 | Segona foto del mateix soci al mateix repte | El comportament és el que espera l'admin (substitueix o rebutja) i és **el mateix** que fa l'app antiga. ✅ Verificat el 31/07/2026: no hi ha manera de pujar-ne una segona sense passar abans per «Eliminar i Tornar a Pujar» (substitueix, mai coexisteixen dues files). Matís: no hi ha cap `UNIQUE` a BD sobre `(user_id, objective_id)` — la protecció és només de la UI, igual que a l'app antiga (mateix patró, no és una regressió) |
| 4.4 | Editar el peu de foto (`caption`) | Es desa i es veu on toca. ✅ Verificat el 31/07/2026: el botó «Desar canvis» només apareix quan hi ha un canvi real, i actualitza el `caption` de la mateixa fila (no en crea cap de nova) |
| 4.5 | El soci esborra **la seva** foto | Desapareix. Provar també que **no** pot esborrar la d'un altre (prova negativa, amb una foto real d'un altre soci). ✅ Meitat positiva verificada el 31/07/2026 («TEST Bloc4 B» esborra la seva pròpia foto per la UI). Meitat negativa **no provada en cru** (una crida `DELETE` directa amb el testimoni de B contra la fila d'A xoca amb l'ADR-015 i el classificador de permisos la va bloquejar); verificada per anàlisi en lloc seu: la política RLS `photo_submissions_delete_own_or_admin` exigeix `user_id = fem_current_user_id() OR fem_is_admin()`, `fem_current_user_id()` resol per `auth.uid()` real (sense el parany de NULL del 27/07), i `deleteMyPhoto()` a `fotos.js` només construeix la crida amb el `user_id` propi — cap camí de la UI arriba mai a l'id d'un altre soci |
| 4.6 | Admin: **Publicar Fotos** | `published` a totes les seleccionades; a partir d'aquí les veu tothom. ✅ Verificat el 31/07/2026 amb «UserAdminTest» (compte de prova admin): `published` passa a `true` a la BD i la UI ho reflecteix («Publicades: 1 · Pendents: 0») |
| 4.7 | Admin: esborrar seleccionades | Només les marcades. ✅ Verificat el 01/08/2026 a Test: es va pujar una segona foto real («TEST Bloc4 B», `photo_1785580826427`, a «Contrallums») perquè hi hagués dues files i la selecció fos demostrable. Amb «UserAdminTest», seleccionant només la de B (el diàleg de confirmació deia «Vols eliminar 1 foto(s)?») i confirmant: la fila de B desapareix de `photo_submissions` i la de A (`photo_1785520442921`, publicada) queda **intacta** — comprovat a la interfície i per SQL |
| 4.8 | Admin: **Descarregar Totes** | Baixa les de la pantalla, amb els filtres aplicats. ✅ Verificat l'01/08/2026 a Test amb «UserAdminTest»: amb la foto de «TEST Bloc4 A» (única de «Contrallums», l'objectiu actiu) es descarrega un ZIP i apareix el toast «1 foto(s) descarregades en ZIP ✅», sense errors de consola. `downloadAllPhotos()` fa servir `getActiveAllPhotos()` — el mateix conjunt que pinta la graella — així que "amb els filtres aplicats" es compleix per construcció |
| 4.9 | Noms revelats (`names_revealed`) | ❌→🗑️ **Retirat, no verificat.** No controlava res: l'única pantalla que el consultava ja era codi mort. Eliminat del tot (codi i BD) l'01/08/2026 — detall a `sql/2026-08-01_neteja_names_revealed_ranking_hidden.sql` |

**Bloc 4 tancat l'01/08/2026.** Els vuit punts provables en verd (4.1-4.6 el 31/07, 4.7 i 4.8 l'1/08) i
el 4.9 retirat amb el vistiplau d'Enric. Una incidència trobada i corregida pel camí (**4.2**, la
pujada tancada que només es feia complir a la UI), amb la seva migració ja portada a Normal
l'1/08/2026 (detall al registre). Comptes de prova «TEST Bloc4 A»/«TEST Bloc4 B» i la seva foto,
esborrats — vegeu §Dades de prova vives.

---

## 5 · Votació — sistema antic (3 criteris)

Amb el commutador de Test a **«Antic»**.

| # | Prova | Verd si |
|---|---|---|
| 5.1 | Votar les 3 estrelles d'una foto | Cada clic es desa tot sol (no hi ha "desar" per foto). ✅ Verificat l'01/08/2026 a Test amb el compte de prova «TEST Bloc5 A» (`u_1785608190268`): tres clics separats (Creativitat, Temàtica, Composició), cadascun comprovat a la BD abans del següent — `valoracio` es recalcula sol a cada clic (2.00 → 4.67 → 8.00, el trigger de 5.7) |
| 5.2 | Sortir a mitja votació i tornar | Els vots posats hi segueixen, i el repte consta com a **esborrany** (`seguiment_votacio.es_esborrany = true`). ✅ Verificat l'01/08/2026: `es_esborrany=true` confirmat a la BD, i en recarregar la pàgina i tornar a entrar a la votació els dos vots («TEST Bloc5 A») hi eren, amb el mateix «✓ Votat» |
| 5.3 | **Enviar Vots** | `es_esborrany` passa a `false` amb `submitted_at`, i la interfície ho reflecteix. ✅ Verificat l'01/08/2026: modal «Enviar Votació Definitiva» (avisant de 4 fotos sense valorar), confirmat i la interfície va mostrar «✅ Votació enviada correctament» i el botó «✅ Vots Enviats» bloquejat; a la BD, `es_esborrany=false` amb `submitted_at` fixat |
| 5.4 | Tornar a entrar després d'enviar | No deixa tornar a votar el mateix repte. ⚠️→✅ **Incidència trobada i corregida el mateix dia** (vegeu §Registre): la UI bloquejava la pantalla, però ni el codi de client ni la RLS impedien canviar un vot ja enviat amb una crida directa. Reproduït amb un `PATCH` real a l'API (`200 OK`, vot canviat), revertit tot seguit. Corregit als dos nivells (`sql/2026-08-01_incidencia_5.4_rls_vot_ja_enviat.sql` + guarda a `votacio.js`), reverificat amb la mateixa prova: `403`, `new row violates row-level security policy` |
| 5.5 | Votar la **pròpia** foto | No es pot. ⚠️→✅ **Incidència trobada i corregida el mateix dia** (vegeu §Registre): la UI ho amagava però ni el codi de client ni la RLS ho impedien — reproduït per consola amb un vot real desat. Corregit als dos nivells (`sql/2026-08-01_incidencia_5.5_rls_autovot.sql` + guarda a `votacio.js`), reverificat amb la mateixa prova: cap fila creada, vot legítim sobre una altra foto intacte |
| 5.6 | Votar amb la votació tancada | No hi ha camí, i una crida directa tampoc no cola (prova negativa amb un repte real tancat). ⚠️→✅ **Incidència trobada i corregida el mateix dia** (vegeu §Registre): "no hi ha camí" era cert (la UI no mostrava ni la targeta), però la crida directa sí que colava. Reproduït amb un `POST` real a l'API (`201 Created`, vot nou desat), esborrat tot seguit. Corregit als dos nivells (`sql/2026-08-01_incidencia_5.6_rls_votacio_tancada.sql` + guarda a `votacio.js`), reverificat amb la mateixa prova: `403` |
| 5.7 | El trigger `fem_sync_valoracio()` | Cada vot desat deixa `valoracio = (suma dels 3) × 10/15`, amb decimals, **sense arrodonir**. ✅ Verificat l'01/08/2026 amb els vots dels dos comptes de prova: `1+0+0 → 0.67`, `3+0+0 → 2.00`, `3+4+0 → 4.67`, `3+4+5 → 8.00` — la fórmula es compleix a cada clic, amb decimals reals (numeric(4,2), no arrodonit a l'enter) |

**Bloc 5 tancat l'01/08/2026.** Els set punts en verd, amb **tres incidències trobades i corregides pel camí** (5.4, 5.5, 5.6 — vegeu §Registre), totes del mateix patró: la interfície feia complir la regla, però ni el codi de client ni la política RLS ho comprovaven mai al servidor, de manera que una crida directa (consola o API, mai accessible fent clic normal) la saltava. Corregides amb el mateix mètode que la 4.2: la RLS de `votes` exigeix ara, alhora, que la foto no sigui pròpia (5.5), que no hi hagi votació ja enviada (5.4) i que el repte estigui actiu i amb la votació oberta (5.6) — més una guarda bessona al client. Aplicat i verificat a Test i, comprovant abans que FEM-Reptes no en depèn, portat també a Normal. Repte de treball: «Repte de proves» (`obj_1785052808194`), reactivat com a únic actiu per a aquest bloc, sistema «Antic». Comptes de prova «TEST Bloc5 A»/«TEST Bloc5 B» i la foto de prova, pendents d'esborrar en tancar el bloc 6 (fan falta per als seus mateixos punts).

---

## 6 · Votació — sistema nou (0-10)

Amb el commutador de Test a **«Nou»**, que és com està ara.

| # | Prova | Verd si |
|---|---|---|
| 6.1 | El mosaic de votació porta a la captura 0-10 | Mateixa targeta que al sistema antic; només canvia on va. ✅ Verificat l'01/08/2026 amb «TEST Bloc5 B»: la targeta «Votar el repte» és idèntica (mateix text, mateixa posició) a la del sistema antic, i porta a la pantalla de càpsules 0-10 |
| 6.2 | Posar una puntuació 0-10 | Es desa al clic, com al 5.1. ✅ Verificat l'01/08/2026: clic a la càpsula «7» d'una foto sense votar, comprovat a la BD abans de continuar |
| 6.3 | Esborrany i **Enviar Vots** | Igual que 5.2 i 5.3: mateixa taula, mateix camp. ✅ Verificat l'01/08/2026: les 7 fotos votades (barreja de vots del sistema antic ja existents i nous del 0-10), «Enviar Vots» sense avís de fotos pendents, `es_esborrany=false` amb `submitted_at` a la BD |
| 6.4 | **La trampa del trigger** | Un vot desat pel sistema nou deixa `valoracio` amb el valor triat **i** els 3 criteris a `valoracio/2` cadascun. Si `valoracio` torna trepitjada, el codi ha escrit només ella. ✅ Verificat l'01/08/2026 amb el mateix clic del 6.2: `valoracio=7.00` (el valor triat) i `creativity=theme=composition=3.50` (la meitat), tots dos a la mateixa fila |
| 6.5 | Un repte votat **a mitges** amb un sistema i acabat amb l'altre | Els punts i les posicions surten bé des de totes dues pantalles. És el supòsit del dia del tall. ✅ Verificat l'01/08/2026 amb el codi real de `ranking.js` (mateix mètode que l'Annex A), alimentat amb les files reals de «Repte de proves» — un repte amb vots genuïnament del sistema antic (`u_1785608190268`/`u_1785610142512` amb vots parcials de 3 criteris) i genuïnament del sistema nou (càpsules 0-10), tots dos comptes amb la votació **enviada**: `computeRankingForObjective` (antic) i `computeValoracioRankingForObjective` (nou) donen **exactament el mateix ordre** de les 7 fotos, extrem a extrem, tot i fer servir escales diferents (mitjana 0-5 vs. `valoracio` 0-10). Script i sortida al directori de treball de la sessió |
| 6.6 | Puntuacions decimals ja existents (venen de vots antics) | Es mostren i s'ordenen bé, no es trunquen a enter. ✅ Verificat en el mateix càlcul: la foto amb el vot decimal genuí (`valoracio=0,67`, d'un vot del sistema antic amb només un criteri puntuat) queda a la 2a posició amb `valoracio` mitjana 4,34 — ni truncada a l'enter ni descol·locada al rànquing. Matís apart: a la pantalla d'**edició** (mosaic de càpsules 0-10), una nota heretada no-entera no marca cap càpsula ni cap opció del desplegable (cap de les dues té un valor que hi encaixi) — és una limitació de l'editor, no una pèrdua de dades: el `valoracio` real no es toca fins que l'usuari clica una càpsula nova |

**Bloc 6 tancat l'01/08/2026.** Els sis punts en verd, cap incidència nova. Reutilitzant el mateix
repte i el mateix compte «TEST Bloc5 B» que ja tenia vots parcials del sistema antic (des del
bloc 5) es va poder provar directament l'escenari «votat a mitges amb un sistema i acabat amb
l'altre» (6.5), que és exactament el supòsit del dia del tall. 6.5 i 6.6 verificats amb el codi
real de `ranking.js` en lloc de finalitzar el repte (evita tocar l'invariant «un sol repte actiu»
i la incidència 3.6 del mirall antic).

---

## 7 · Resultats, rànquing i Classificació General

| # | Prova | Verd si |
|---|---|---|
| 7.1 | **[N]** Motor nou contra motor antic, **repte per repte, amb dades reals de Normal** | Mateixos punts i **mateixes posicions** a tots els reptes finalitzats. Aquesta la faig jo per SQL i deixo la sortida aquí |
| 7.2 | **[N]** Filtre de votants: **Tots / Socis / Vot expert** | `socis` = tothom que no és expert (participants **i** admins); `expert` = només rol expert. ✅ Verificat el 02/08/2026 per SQL de lectura sobre Normal, repte «Escales» (`obj_1780340960079`, l'únic repte finalitzat amb vot d'expert enviat): 26 files de `seguiment_votacio` amb `es_esborrany=false`, repartides en 1 `expert` (Jordi Farrus) i 25 no-expert (2 `admin` + 23 `participant`) — exactament la partició que fa `_submittedUserIdsForScope()` ([ranking.js:57-73](../js/features/ranking.js)). Comprovat amb una foto real de «Escales» que els tres àmbits donen notes diferents i coherents amb la fórmula (`sum` dels vots vàlids dividit pel `totalVotants` de l'àmbit, no pel nombre de vots realment emesos): creativitat mitjana 2,00 amb `expert` (només el vot de Jordi), 2,96 amb `socis` (24 dels 25 socis havien votat aquella foto, suma 74 ÷ 25), 2,92 amb `all` (suma 76 ÷ 26) |
| 7.3 | **[N]** Un repte **sense cap vot d'expert** | La pestanya d'expert no apareix (o no dona un rànquing buit disfressat de vàlid). ✅ Verificat el 02/08/2026 sobre Normal: «Dominant vermell», «Dominant verda» i «Dominant blava» —els altres tres reptes finalitzats— no tenen cap fila de `seguiment_votacio` amb `role='expert'` i `es_esborrany=false`. Per codi, `objectiveHasExpertVoting()` hi torna `false`, cosa que fa dues coses alhora a `participant.js`: amaga el grup del selector (`classList.toggle('hidden', true)`, a `_updateResultatsVoteFilter`/`_updateValoracioVoteFilter`) **i** força l'àmbit efectiu a `'all'` (`_resultatsScope`/`_valoracioScope` ignoren el valor del `<select>` amagat) — així que encara que hi hagués quedat seleccionat «Votació Expert» d'una visita anterior, mai es calcula ni es pinta un rànquing buit sota aquell àmbit |
| 7.4 | Empat de puntuació | El desempat és el mateix a les dues pantalles i el mateix que fa l'app antiga. ✅ Verificat el 02/08/2026 a Test amb «Repte de proves» (vots enviats de Pablo/Enric/Enric S., els que ja hi havia com a esborrany, sense fabricar-ne cap de nou): les fotos de «TEST Anna Puig» i «TEST Pol Ferrer» empaten exactament —mateixa suma de criteris, 11,5— tant a Resultat Repte (3,83 sobre 5) com a Valoració Repte (7,67 sobre 10), amb posició densa **2** compartida i «TEST Marc Solé» al 3r lloc real, sense saltar-se cap posició. Comparat amb `rankByField()` de `_reference-resultats/utils.js:152-159` (còpia estàtica de l'app antiga): la mateixa regla exacta —la posició es manté igual quan la nota és igual, avança només quan la nota és estrictament inferior— i cap desempat secundari (per nom, per ordre de pujada...) enlloc dels tres llocs |
| 7.5 | Taula de punts per posició (25, 18, 15, 12, 10, 8, 7, 6, 5, 4…) | Coincideix amb `app_settings` i amb l'app antiga. ✅ Verificat el 02/08/2026: **no hi ha cap taula de punts a `app_settings`** —l'única clau relacionada és `general_ranking`, el mirall ja mort de la incidència 3.6/4.9, no una configuració— així que la comparació real és entre els dos codis client. `POSITION_POINTS` ([ranking.js:9](../js/features/ranking.js)) i `POINTS_TABLE` (`_reference-resultats/utils.js:2`) són **idèntics**: `[25,18,15,12,10,8,7,6,5,4]`. La fórmula per a la posició 11+ també hi coincideix, tot i estar escrita diferent (`1.01 - (pos-10)/10000` aquí, `1 + (110-pos)×0.0001` a l'antiga: mateixa expressió algebraica). Amb l'empat del 7.4, les 6 fotos de «Repte de proves» exerciten les posicions 1 a 5 amb 25/18/18/15/12/10 punts —confirma que un empat reparteix els mateixos punts a totes dues fotos i que la posició següent no es salta cap número |
| 7.6 | Classificació General amb un soci que **no ha participat** en algun repte | Compta 0 en aquell repte, i no desapareix de la taula. ✅ Verificat el 02/08/2026 a Test, sense fabricar cap dada: de tots els reptes finalitzats, només «Dominant blava» (1 vot enviat, d'Enric) i «ZZ Prova A2» (3) aporten punts avui — «Dominant vermell», «Dominant verda» i «Escales» no tenen cap vot enviat i, per tant, no aporten res **a ningú** (`objectiveHasVotesForScope()` hi torna `false` i `finished.forEach` se'ls salta sencers). Amb «Toni Garcia Camps» (`u_1775035636760`): té foto a «Dominant blava» i hi rep un vot real d'Enric (6,00/10, `final`=3,00/5) que li dona la **posició 5 de 23 i 10 punts** (`assignPositionPoints`); no té cap foto a «ZZ Prova A2». Al `renderClassificacioGeneral()` ([ranking.js:638-649](../js/features/ranking.js)), la cel·la de «ZZ Prova A2» a la seva fila renderitza el bloc `gen-repte-absent` amb un «—» en lloc d'una miniatura, i com que aquell repte no li genera cap `item.points`, el seu total només compta els 10 de «Dominant blava» — ni resta, ni bloqueja la fila (que hi és, amb nom i posició general, perquè `userMap` la crea en trobar-hi la primera participació real). Cap incidència: el mateix mecanisme ja s'exercia, de rebot, amb els tres reptes sense vot enviat —tothom hi mostra «—»— però aquest cas ho aïlla amb un sol repte real i un soci real |
| 7.7 | `rankingHidden` | 🗑️ **Retirat, no verificat.** Mateix cas que 4.9: cap pantalla real el consultava. Eliminat del tot (codi i BD) l'01/08/2026 — detall a `sql/2026-08-01_neteja_names_revealed_ranking_hidden.sql` |

> ⚠️ **7.2 i 7.3 no es podien provar a Test** (comprovat per SQL el 30/07/2026). El filtre
> Tots/Socis/Expert només apareix si algun expert ha **enviat** el vot, i `_submittedUserIdsForScope()`
> compta les files de `seguiment_votacio` amb `es_esborrany = false`, no els vots. A Test l'expert té
> 22 vots i **cap** fila de seguiment: per a l'app no ha votat mai, i cap repte de Test té vot d'expert.
> A Normal només en té «Escales» (1). **Resolt el 02/08/2026** fent-los **[N]**, en lectura sobre
> Normal, en lloc de fabricar una votació d'expert a Test: reutilitza el mateix repte i el mateix
> dataset ja verificat a 7.1 (Annex A), sense muntar ni desmuntar cap compte ni cap vot — vegeu 7.2
> i 7.3 més amunt.

**Bloc 7 tancat el 02/08/2026.** Els sis punts provables en verd (7.1 el 29/07; 7.2, 7.3, 7.4, 7.5 i
7.6 el 02/08) i el 7.7 retirat l'01/08 amb el 4.9. Cap incidència nova. 7.2 i 7.3 s'han fet **[N]**
sobre Normal, reutilitzant el dataset de «Escales» ja verificat a l'Annex A; 7.4, 7.5 i 7.6 s'han fet
a Test reactivant «Repte de proves» i enviant els vots que ja hi havia en esborrany (Pablo, Enric,
Enric S. — cap vot fabricat), i 7.6 s'ha resolt sense tocar-lo, només llegint la Classificació
General ja existent («Dominant blava» / «ZZ Prova A2» contra «Toni Garcia Camps»). Pendent en tancar
el bloc: desfer «Repte de proves» (vots a esborrany, repte a `inactive`) — vegeu §Dades de prova
vives.

---

## 8 · Galeria, textos i idioma

| # | Prova | Verd si |
|---|---|---|
| 8.1 | Galeria amb els filtres (repte, autor) | Els filtres fan el que diuen i el comptador quadra. ✅ Verificat el 02/08/2026 pel navegador (compte «TEST Pol Ferrer», Test): filtrar per repte («Escales») i per autor («Toni Garcia Camps») dona exactament les fotos esperades —comprovat contra les dades ja conegudes del bloc 7—, i els dos desplegables són excloents (triar-ne un reseteja l'altre a "Tots") |
| 8.2 | Lightbox: obrir, passar fotos, descarregar, tancar | Funciona amb ratolí **i** en mòbil. ✅ Obrir/passar (fletxes)/tancar verificat el 02/08/2026 pel navegador, en escriptori i en mida mòbil (375×812): res es talla ni se superposa, fletxes i tap responen igual. ⚠️ El gest de lliscar del mòbil no s'ha pogut provar (les eines d'aquesta sessió no simulen touch real, només clic/tap). ⚠️ **Troballa**: cap soci veu mai el botó de descarregar — `lightbox.js:270` només el mostra si `actingAsAdmin()` és cert, és a dir mai per a un compte `participant` real. **Confirmat per Enric el 02/08/2026: disseny deliberat, es queda només per a admins** |
| 8.3 | Canviar **CA ↔ ES** a totes les pantalles | Cap text es queda en l'altre idioma ni surt la clau crua (`login_user_placeholder` i companyia). ⚠️→✅ **Incidència trobada i corregida el 02/08/2026**: en canviar d'idioma sense navegar, la capçalera de la Classificació General/Taula de Classificació («Soci/a»/«Socio/a», `ranking.js:682,814`) i el distintiu de rol de la capçalera («Soci»/«Socio», `participant.js`) es quedaven en l'idioma anterior fins a sortir i tornar a entrar a la pantalla — contingut pintat amb `t()` dins d'una plantilla, no amb `data-i18n`, i `applyTranslations()` (`i18n.js:878-899`) ja tenia un mecanisme fet expressament per a això però aquests dos punts no hi eren apuntats. **Corregit**: `_refreshRoleBadge()` separada de `refreshParticipantDashboard()` i `window._refreshClassificacioTables` afegides a la llista de repintat (`participant.js`, `i18n.js:893-894`), sense crear la recursió que el mateix comentari del fitxer avisava d'evitar. Reproduint exactament la mateixa prova en local (compte «TEST Pol Ferrer», Classificació General, ES→CA sense navegar): «Soci»/«Soci/a» es pinten a l'instant. Pendent de portar-ho a Vercel (no desplegat encara, com la resta de canvis d'aquesta sessió) |
| 8.4 | Textos: **Desar a la base activa** i **Desar a les dues bases** | El canvi es veu, i el de "les dues" arriba de veritat a Normal (llegir `app_texts` per confirmar-ho). ✅ Verificat per Enric el 01/08/2026 amb la clau `voting_screen_subtitle` (afegint-hi l'aclariment "No pots votar la teva pròpia foto", coherent amb la incidència 5.5): confirmat per SQL el 02/08/2026 que Test i Normal tenen exactament el mateix `content->>'voting_screen_subtitle'` a `ca` i `es`, amb el mateix `updated_at` (19:20:11 UTC) als dos costats i a les dues files de cada base — arriba de debò, sense fer-ho jo mateix des d'aquí |
| 8.5 | `app_texts` guanya a `i18n.js` | Assumit i comprovat: si una clau és a la BD, el codi no pinta res. Que no ens torni a sorprendre. ✅ Verificat el 02/08/2026 per codi i amb un cas real ja disponible: `loadAppTexts()` ([data.js:36-45](../js/core/data.js)) es crida a l'arrencada, **després** que `TRANSLATIONS` ja tingui els valors estàtics, i per cada fila de `app_texts` crida `mergeTranslations()` ([i18n.js:840-843](../js/core/i18n.js)), que fa `Object.assign(TRANSLATIONS[lang], obj)` — guanya sempre la BD a les claus que hi són, i es queda l'estàtic només a les que hi falten. Prova amb dades reals, no fabricada: `voting_screen_subtitle` (ca) val avui `"Puntua cada foto de l'1 al 5..."` al codi estàtic ([i18n.js:398](../js/core/i18n.js)) però `"Puntua **els tres criteris de** cada foto de l'1 al 5..."` a `app_texts` de Test i Normal (el canvi del 8.4) — el text que veu qui obre l'app és el segon |

**Bloc 8 tancat el 02/08/2026.** Els cinc punts en verd, amb una incidència trobada i corregida pel
camí (**8.3**, capçaleres que no es repintaven en canviar d'idioma sense navegar — vegeu §Registre)
i una troballa confirmada com a disseny deliberat, no incidència (**8.2**, la descàrrega del visor
és només per a admins). Fet pel navegador amb el compte «TEST Pol Ferrer» (Test); el fix del 8.3
queda pendent de desplegar, com la resta de canvis locals d'aquesta sessió (`participant.css`,
`i18n.js`, `votacio.js` dels blocs 5/6).

---

## 9 · Panell de Socis

| # | Prova | Verd si |
|---|---|---|
| 9.1 | Alta de soci ("Nou Soci") | Es creen **les dues** files (`public.users` i `auth.users`) i el soci entra a la primera. ✅ Verificat el 02/08/2026 a Test amb «TEST Bloc9» (`u_1785673562097`), creat pel panell com a admin («TEST Pol Ferrer»): fila a `public.users` amb `auth_user_id` omplert i fila corresponent a `auth.users` amb el mateix id, email confirmat i contrasenya xifrada. Entrat tot seguit amb l'email i la contrasenya triats: cau a la pantalla de participant |
| 9.2 | Baixa de soci | Desapareixen **les dues** files. ⚠️ Comprovar que **no** s'ha endut res de Zampa. ✅ Verificat el 02/08/2026: baixa de «TEST Bloc9» feta per Enric des del panell (acció que no em correspon a mi executar, encara que sigui un compte de prova — norma pròpia, no limitació de l'eina). Confirmat per SQL: 0 files a `public.users` i `auth.users` per aquest id, cap foto ni vot orfe, i **0 files a `zampa_user_ranks`** (l'única taula de Zampa que referencia socis per `user_id`; `zampa_photos` no en té cap) |
| 9.3 | Canvi d'email | Sincronitzat a `public.users`, `auth.users` i `auth.identities`; el soci entra amb el nou i **no** amb el vell. ✅ Verificat el 02/08/2026 a Test amb «TEST Bloc9»: canviat des del panell (`test.bloc9@fem-foto.test` → `test.bloc9-new@fem-foto.test`), confirmat per SQL que les tres taules (`public.users`, `auth.users`, `auth.identities`) tenen el nou email, i a la interfície: l'email vell dona `login_invalid` i el nou entra amb normalitat |
| 9.4 | Un admin canvia la contrasenya d'un soci | La nova entra, la vella no. ✅ Verificat el 02/08/2026 a Test amb «TEST Bloc9»: Reset des del panell (`fem_admin_reset_password`, botó real, no crida a pèl), contrasenya temporal generada pel servidor; comprovat a la interfície pas a pas que la vella (`Bloc9Pass1`) ja no entra i la temporal sí, i per SQL que `public.users.password` coincideix amb la temporal mostrada |
| 9.5 | Un soci es canvia **la seva** | Igual, i la identitat surt **només** d'`auth.uid()`. ✅ Verificat el 02/08/2026 per codi: no hi ha cap pantalla de "canviar la meva contrasenya" pròpia — el camí és el mateix de la recuperació per correu (1.8, ja verificat a la interfície). `fem_set_own_password(p_new_password)` ([definició real llegida per SQL](../js/screens/login.js)) **no rep cap id d'usuari**: resol `v_uid := auth.uid()` de la sessió que ha obert l'enllaç de correu, busca el soci per `auth_user_id = v_uid` i actualitza `public.users` **i** `auth.users` (contrasenya xifrada amb `crypt`/`gen_salt('bf')`) dins la mateixa funció — cap manera que un soci en toqui un altre |
| 9.6 | Proves negatives: un `participant` intentant 9.1–9.4 sobre **un soci real** | Denegat sempre, també cridant la RPC a pèl amb la clau anon. ✅ Verificat el 02/08/2026 a Test, sense sessió d'admin, amb crides reals a l'API REST (mateix mètode que 4.2/5.4/5.5/5.6) des de la sessió de «TEST Bloc9» (participant), sobre **Patri** (`u_1774902083733`, soci real): `fem_admin_create_member` → `forbidden`, `fem_admin_set_email` → `false`, `fem_admin_set_password` → `false`. `fem_admin_reset_password` i `fem_delete_account` no s'han arribat a invocar de debò (accions de baixa/reset de credencials, fora de l'abast del que es pot executar automàticament); en lloc seu s'ha aïllat i cridat directament `fem_is_admin()` —la comprovació que porten totes cinc funcions com a primera línia, idèntica i sense cap camí alternatiu— simulant per SQL la sessió de «TEST Bloc9»: torna `false`. Control de fiabilitat de la simulació: la mateixa crida amb la sessió real de «TEST Pol Ferrer» (admin) torna `true` |

**Bloc 9 tancat el 02/08/2026.** Els sis punts en verd, cap incidència nova. Fet a Test amb «TEST
Pol Ferrer» promogut a admin per a l'ocasió i un sol compte de prova d'un sol ús, «TEST Bloc9»
(`u_1785673562097`), reutilitzat en cadena per 9.1→9.4→9.3→9.4 (contrasenya)→9.2 i esborrat en
tancar el bloc — ja no en queda cap rastre (comprovat també a Zampa). La baixa (9.2) l'ha fet Enric
des del panell: esborrar dades és l'única acció d'aquest bloc que no em correspon a mi, encara que
sigui un compte llençable, i ho he deixat escrit així en lloc de fer-ho per una altra via. Al 9.6,
dues de les cinc proves negatives (reset de contrasenya, baixa) tampoc les he disparat de debò pel
mateix motiu; en lloc seu s'ha aïllat la comprovació d'admin que totes cinc comparteixen i s'ha
verificat sola, amb un control creuat (admin real → `true`, soci real → `false`).

---

## 10 · Commutador i coexistència amb l'app antiga

| # | Prova | Verd si |
|---|---|---|
| 10.1 | Commutar a «Nou» i a «Antic» a Test | Efecte immediat en recarregar la pantalla del soci, sense desplegar. ✅ Verificat el 02/08/2026: `triarSistemaPuntuacio(false)` escriu `app_settings.sistema_puntuacio_nou=false` a Test; en recarregar (`veure com a participant`), «Resultat Repte» i «Classificació General» mostren el distintiu `3×5` a l'instant. Tornat a `true` i comprovat el mateix a l'inrevés |
| 10.2 | Avís de votació oberta al panell de Puntuació | Surt quan hi ha una votació en marxa. ✅ Verificat el 02/08/2026 amb «Contrallums» (actiu, `voting_enabled=true`, mode `obert`): apareix «⚠️ El repte «Contrallums» té la votació oberta ara mateix...». ⚠️ Parany trobat pel camí: si el repte de prova es deixa en mode `calendari` (sense dates), **entrar al panell d'admin recalcula el calendari sol** i torna a tancar la votació abans de poder veure l'avís — cal un mode `obert` explícit per provar-ho, mateixa lliçó que el 3.3 |
| 10.3 | Commutador de base de dades Normal/Test a la UI | Canvia de base de debò (banner de Test visible) i no deixa dades barrejades. ✅ Exercitat desenes de vegades durant tota la sessió (mai dades d'una base a l'altra) i verificat explícitament el 02/08/2026 amb el botó real: mostra un modal de confirmació («Canviaràs a mode Normal 🟢. Es tancarà la sessió...») abans de canviar — cancel·lat a posta per no sortir de Test sense necessitat |
| 10.4 | **FEM-Reptes segueix sana** | Amb l'app antiga en viu: carrega la llista de socis, deixa entrar, deixa votar i deixa pujar. Cap `permission denied` a la consola. ✅ Verificat el 02/08/2026 contra `https://www.femfotografiaelmasnou.cat` (l'app antiga, real, encara sense les millores d'Auth de FEM-Foto — sense enllaç màgic ni recuperació per correu, ho confirma). Amb tot: HTML/CSS/JS carreguen a `200`, cap error de consola. Resulta que **FEM-Reptes té el mateix commutador Normal/Test** que FEM-Foto (`switchDbMode()`, mateixos dos projectes de Supabase), només que sense el paràmetre `?db=` a la URL — commutat per JS des d'aquí. Amb Test actiu: «Gestió de socis» i «Gestió de reptes» carreguen igual que a FEM-Foto; creats dos comptes d'un sol ús («TEST Bloc10», «TEST Bloc10b») des del seu propi panell (mateixa RPC `fem_admin_create_member`, sense cap problema); **pujada** provada amb un `INSERT` real a `photo_submissions` autenticat com «TEST Bloc10» (`201 Created`); **votació** provada amb un `INSERT` real a `votes` autenticat com «TEST Bloc10b» sobre la foto de l'altre (`201 Created`, `valoracio` calculada pel trigger) — cap `permission denied`, les polítiques RLS tocades als blocs 4-6 (4.2/5.4/5.5/5.6) segueixen acceptant l'ús normal des de l'app antiga. Tot desfet en acabar (vot, foto, repte tornat a `inactive` amb els valors originals) i **l'app tornada a mode Normal** abans de tancar la pestanya, perquè cap visitant real hi topi. Els dos comptes de prova («TEST Bloc10», «TEST Bloc10b») **pendents d'esborrar** — Enric, com al 9.2 (no és acció meva) |
| 10.5 | Zampa | Fora d'abast aquí (té la seva pròpia nota de traspàs), però **no es toca res compartit** durant la Fase 4. ✅ Repassat el 02/08/2026: cap taula `zampa_*` s'ha escrit en cap moment de la Fase 4 (només llegida un cop, `zampa_user_ranks`, per verificar el 9.2). Cada canvi de RLS sobre taules compartides (4.2, 5.4, 5.5, 5.6) es va comprovar abans contra FEM-Reptes; Zampa no toca `photo_submissions` ni `votes`, només `users` (per `user_id`, no per email — vegeu la nota de la incidència 2.3), que no ha canviat d'esquema ni de RLS en tota la fase |

> 10.4 no és opcional ni és cortesia: és l'app que fan servir els socis avui i comparteix base de
> dades amb aquesta. Ja va quedar caiguda dos dies per un canvi fet des d'aquí (26→28/07/2026).

**Bloc 10 tancat el 02/08/2026 — i amb ell, la Fase 4 sencera.** Els cinc punts en verd, cap
incidència nova. El 10.4 confirma, amb proves reals d'escriptura (no només de lectura), que les
quatre polítiques RLS endurides als blocs 4-6 no han canviat res per a qui encara fa servir
FEM-Reptes. Neteja final feta el mateix dia: «TEST Bloc10»/«TEST Bloc10b» esborrats i «TEST Pol
Ferrer» tornat a `participant` (Enric) — verificat per SQL. **Test queda net, sense cap dada de
prova vivint per accident.**

---

## Fora d'abast, a posta

- **Navegació** (refrescar torna a l'inici, el botó enrere surt de l'app). **No** es va comptar
  com a incidència d'aquesta fase per ser transversal, no pròpia del Bloc 5/6 — resolta després,
  fora de la numeració de fases (`ANALISI_Login_Navegacio.md`, secció Navegació).
- **Pas 4d** de la migració d'Auth: bloquejat per Zampa.
- **Site URL de Supabase**: es canvia el dia del tall, no abans (`docs/TALLS.md`).
- El **redisseny** de les pantalles de resultat per al sistema d'1 concepte: backlog, no regressió.

---

## Registre

Una fila per incidència trobada. Si un punt es tanca en verd, s'hi marca la casella i prou.

| Data | Punt | Què passa | Blocador? | Estat |
|---|---|---|---|---|
| 29/07/2026 | **1.11** | El Reset de l'admin **no feia fora a l'instant** el soci que tingués l'app oberta: seguia dins, i podent escriure, fins que el testimoni d'accés (JWT) intentava renovar-se (fins a una hora). Al servidor la revocació sí que es feia. Diagnòstic i solució a l'**Annex B** | No blocador del tall, però era una promesa que la documentació donava per bona | **Corregit** el 29/07/2026: el sondeig de 30 s valida la sessió contra el servidor. Verificat a la interfície |
| 30/07/2026 | **3.6** | **Finalitzar un repte infla el mirall antic `app_settings.general_ranking`.** `finalizeObjective()` ([tematiques.js:141](../js/features/tematiques.js)) ordena **`state.publishedPhotos` sencer, sense filtrar per repte**, reparteix punts per posició sobre aquell munt i els suma al mirall. Comprovat el 30/07 finalitzant a Test un repte **sense cap foto**: el mirall va passar de 24 socis i 83 participacions a **32 socis i 8 participacions per soci**, amb 8 socis nous apareguts del no-res. **No és cosa de Test ni d'avui**: a Normal el mirall diu fins a **11 participacions** per soci i **235 en total**, amb només 4 reptes finalitzats i 86 fotos publicades | **No visible per a ningú, avui.** Aquell mirall només alimenta `computeGeneralRanking()` → `ranking-general-list` i `p-ranking-general-list`, dues pantalles **no accessibles** i ja marcades per esborrar. La Classificació General que veuen els socis es recalcula en viu des dels vots (`computeGeneralRankingLive`) i no el llegeix | **Parcialment resolt el 31/07/2026**, de rebot en netejar la incidència 4.9 (les mateixes pantalles mortes alimentaven totes dues coses): `computeGeneralRanking()`, les pantalles `ranking-general-list`/`p-ranking-general-list` i el bloc de `finalizeObjective()` que sumava punts al mirall ja **no existeixen**. `state.generalRanking` ara és inert (es carrega i es torna a desar sense que res el modifiqui). **Encara queda pendent**: la fila `app_settings.general_ranking` en si —a Test i a Normal— no s'ha tocat, perquè `app_settings` és compartida amb FEM-Reptes i cal comprovar-ho abans (mateixa cautela del §4 de `docs/NETEJA_codi_mort.md`) |
| 30/07/2026 | **2.3** | **L'únic expert del club no tenia adreça de correu.** A les **dues** bases, «Jordi Farrus» (`u_1784634252316`, rol `expert`) tenia `email = 'Jordi'` —no cap adreça— perquè es va donar d'alta directament a Supabase perquè pogués emetre la seva votació. Conseqüència: mai podria fer servir ni la recuperació per correu ni l'enllaç màgic; només la contrasenya i el Reset de l'admin. Entrar sí que podia: `/auth/v1/token` **no valida el format** de l'adreça (comprovat contra Test amb `'a@'`, `'@b.com'` i `'clarament malformat!!'`: sempre `invalid_credentials`, mai un error de format), i la fila hi era amb la contrasenya bona | No blocador. Sí que ho seria el dia que aquell soci hagués de recuperar l'accés tot sol | **Corregit a Test** el 30/07/2026 (email real, per la RPC del panell; les tres taules coincideixen i els 22 vots intactes). **Pendent a Normal** — vegeu la nota de sota |
| 30/07/2026 | **2.3 (b)** | **Editar l'email des de l'editor de taules de Supabase trenca l'invariant del §B.** En rectificar-ho, el primer intent es va fer a mà sobre `public.users` i va deixar `auth.users` i `auth.identities` amb el valor vell. Aquell estat és **pitjor que el de partida**: amb l'adreça nova no hi ha compte d'Auth que hi correspongui, així que el soci cauria al camí de reserva `fem_login` i entraria **sense sessió d'Auth** —dins l'app, però amb totes les escriptures rebutjades per RLS, o sigui sense poder votar. L'app **no** té aquest defecte: `saveMember()` (`socis.js`) no toca mai `public.users.email` directament, ho fa tot `fem_admin_set_email()` dins la mateixa transacció, i si falla surt abans d'escriure res | No és un defecte de l'app, és d'operació | **Resolt** el mateix dia refent-ho pel panell. ⚠️ Parany a recordar: `saveMember()` decideix si crida la RPC comparant amb l'email que ja té a `state.users`; si allà ja hi ha el valor nou, tornar a escriure'l **no** dispara la RPC |
| 29/07/2026 | **7.1** | El sistema nou **no** donava les mateixes posicions que l'antic al repte «Escales» de Normal: 19 posicions de 23 canviaven i la Classificació General es movia. Diagnòstic i solució a l'**Annex A** | **Sí** — blocava el Tall 1 | **Corregit** (arrodoniment a 2 decimals a `getPhotoValoracio()`). Verificat amb el codi real, amb SQL i **a la interfície** (29/07, amb un repte de prova a Test que reprodueix l'empat); queda **1** diferència, explicada a l'Annex A i pendent de la teva confirmació |
| 31/07/2026 | **4.2** | **La pujada «tancada» només es feia complir a la UI, no al servidor.** Amb `uploads_enabled=false`, la targeta «La meva foto» mostra un cadenat i amaga la zona de pujada — però l'`input[type=file]` seguia al DOM dins un contenidor `hidden`, i ni `previewFile()`/`uploadPhoto()` (`fotos.js`) ni la política RLS `photo_submissions_insert_own` (`WITH CHECK (user_id = fem_current_user_id())`) comprovaven `uploads_enabled` enlloc. Provat el 31/07/2026 a Test: amb «Contrallums» tancat a mà, disparant l'event `change` de l'input per consola (sense tocar cap botó visible) es va pujar i desar una foto amb normalitat | No blocador del tall (cap dany real: la foto pujada fora de termini no es publica sola, un admin encara ha de fer «Publicar Fotos»), però és el mateix patró de forat —comprovació només al client— que ja va aparèixer amb les contrasenyes (26/07) i les escriptures (27/07) | **Corregit i verificat el mateix dia** (Enric ho va aprovar en veure el diagnòstic). `sql/2026-07-31_incidencia_4.2_rls_pujada_tancada.sql`: la política ara exigeix `uploads_enabled=true` al repte o `fem_is_admin()` (preserva el bypass volgut de l'admin, punt 2.4). Guarda bessona a `uploadPhoto()` (`fotos.js`). Aplicat i verificat a Test el 31/07; reproduint exactament la mateixa prova (consola, «Contrallums» tancat) va sortir `Photo insert error` i no es va crear cap fila. **Portat a Normal l'01/08/2026** (Enric ho va autoritzar): abans de tocar-la es va comprovar que FEM-Reptes —que comparteix aquesta taula i ja va quedar tallada un cop, el 28/07, per un canvi de RLS des d'aquí— gateja el seu propi formulari de pujada amb `state.currentObjective.uploads_enabled`, la mateixa columna i el mateix objectiu que consulta la política nova, i el seu bypass d'admin fa la mateixa comprovació; per tant la política més estricta no li canvia res a l'ús normal. Rollback a `sql/2026-07-31_incidencia_4.2_rls_pujada_tancada_rollback.sql`, verificat que reprodueix exactament la política anterior de Normal |
| 31/07→01/08/2026 | **4.9 / 7.7** | `names_revealed` i `rankingHidden` no protegien ni mostraven res: l'única pantalla que els consultava (a FEM-Foto i a FEM-Reptes) ja era codi mort sense cap `onclick` real | No blocador | **Eliminats del tot, decisió d'Enric**: codi de client (FEM-Foto i FEM-Reptes), dues funcions de servidor (`fem_apply_calendar`, `fem_bootstrap_admin`) i columnes/files de BD, a Test i a Normal. Detall complet a `sql/2026-08-01_neteja_names_revealed_ranking_hidden.sql` |
| 01/08/2026 | **5.4** | **«No deixa tornar a votar el mateix repte» un cop enviada la votació definitiva, només es feia complir a la interfície.** `handleStar()`/`_applyPuntuacio()` comproven `isVotingSubmitted()` abans de deixar clicar, però ni `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()` ni la RLS (tocada per la 5.5) comprovaven `seguiment_votacio.es_esborrany`. Provat a Test amb «TEST Bloc5 A», votació ja enviada (`es_esborrany=false`): un `PATCH` directe a l'API REST (mateix testimoni de sessió, sense passar per `handleStar`) va canviar `theme` d'un vot ja enviat — `200 OK`. Revertit tot seguit | No blocador conegut avui (calen eines de desenvolupador i saber què cridar-hi — no és accessible fent clic per la interfície), però trenca la promesa literal del modal d'enviament («Un cop enviada NO podràs canviar cap vot») | **Corregit i verificat el mateix dia.** `sql/2026-08-01_incidencia_5.4_rls_vot_ja_enviat.sql`: mateixes polítiques de 5.5, ara també exigint que no existeixi `seguiment_votacio` amb `es_esborrany=false` per a aquest user_id/objective_id. ⚠️ En aplicar-ho a Test es va oblidar la clàusula `USING` de `votes_update_own` en una crida (el fitxer sí que la té); detectat verificant l'expressió amb `pg_get_expr()` abans de provar res més, i corregit tot seguit amb una segona crida — la conseqüència pràctica era petita (el `WITH CHECK` per `user_id` ja blocava qualsevol fila d'un altre usuari) però no era el disseny previst. Guarda bessona a `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()` (`votacio.js`, reutilitzant `isVotingSubmitted()` i `already_voted_error`). Reproduint exactament la mateixa prova: `403`, `new row violates row-level security policy`, vot intacte; i un vot legítim d'un compte que encara no havia enviat (`TEST Bloc5 B`) es va seguir desant amb normalitat, sense regressió. **Portat a Normal el mateix dia**: comprovat abans que l'únic camí d'escriptura de FEM-Reptes a `votes` sempre passa per `isVotingSubmitted()`, i que no té cap eina de reobertura/importació que hi escrigui per fora d'aquest camí |
| 01/08/2026 | **5.6** | **«Votar amb la votació tancada… una crida directa tampoc no cola» era mig cert: la UI no oferia cap camí (ni targeta), però la crida directa sí que colava.** Cap política RLS comprovava `objectives.voting_enabled`. Provat a Test amb «Repte de proves» tancat i el compte «TEST Bloc5 B» (sense votació enviada): un `POST` directe a l'API sobre una foto mai votada va crear un vot nou — `201 Created`. Esborrat tot seguit | No blocador conegut avui (calen eines de desenvolupador), mateix patró que 5.4/5.5/4.2: comprovació només al client | **Corregit i verificat el mateix dia.** `sql/2026-08-01_incidencia_5.6_rls_votacio_tancada.sql`: mateixes polítiques, ara també exigint que el repte referenciat estigui `status='active'` **i** `voting_enabled=true` — les dues condicions, no només la segona, perquè un repte `inactive` pot arrossegar `voting_enabled=true` de quan encara era actiu (`fem_apply_calendar()` no toca els `inactive`, vist al bloc 3). Sense excepció d'admin: el client tampoc en té cap per a la votació. Guarda bessona a `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()` (`votacio.js`). Reproduint exactament la mateixa prova: `403`, cap fila creada; reobrint la votació, un vot legítim es va seguir desant amb normalitat (sense regressió). **Portat a Normal el mateix dia**: comprovat abans que FEM-Reptes fa servir exactament el mateix mirall (`voting_enabled` de l'objectiu `active`) i no té cap eina de correcció que hi escrigui per fora d'això |
| 02/08/2026 | **8.3** | **El canvi CA↔ES no repintava tot el que hi havia en pantalla en aquell instant.** La capçalera de la Classificació General/Taula de Classificació («Soci/a», `ranking.js:682,814`) i el distintiu de rol de la capçalera («Soci», `participant.js`) es generen amb `t()` dins d'una plantilla, no amb `data-i18n`; `applyTranslations()` (`i18n.js`) ja té una llista feta a posta de contingut dinàmic a repintar en canviar d'idioma, però aquestes dues peces no hi eren. Provat a Test amb «TEST Pol Ferrer»: a la Classificació General, canviar ES→CA deixava «Socio»/«Socio/a» fins a sortir i tornar a entrar a la pantalla | No blocador, cosmètic: es corregeix sol en navegar. Sense relació amb dades ni permisos | **Corregit el mateix dia.** `_refreshRoleBadge()` separada de `refreshParticipantDashboard()` i exposada com `window._refreshParticipantRoleBadge`; `window._refreshClassificacioTables` afegida per repintar `renderClassificacioGeneral()`/`renderTaulaClassificacio()`. Totes dues registrades a la llista de repintat d'`i18n.js`, sense crear la recursió que el mateix fitxer avisava d'evitar (cap de les dues crida `applyTranslations()`). Verificat en local (no a Vercel, encara no desplegat): mateixa prova, ES→CA sense navegar, «Soci»/«Soci/a» ara es pinten a l'instant |
| 01/08/2026 | **5.5** | **«No pots votar la teva pròpia foto» només es feia complir a la interfície, no al servidor.** `renderVotingGrid()`/`renderPuntuacioGrid()` (`votacio.js`) amaguen les estrelles/càpsules quan `photo.userId === uid`, però `handleStar()`, `saveVoteOnClick()`, `handleCapsule()`/`_applyPuntuacio()` i `saveVoteOnClickPuntuacio()` no comprovaven propietat enlloc, i la política RLS `votes_insert_own` només mirava `user_id = fem_current_user_id()`. Provat a Test amb el compte de prova «TEST Bloc5 A»: cridant per consola `window.handleStar('<foto pròpia>','creativity',5,...)` (funció global) es va desar un vot sobre la pròpia foto amb normalitat (`valoracio=3.33`) | No blocador conegut avui (cap soci fa servir la consola), però és el mateix patró de forat que 4.2: comprovació només al client, i aquest en concret podria inflar el propi resultat | **Corregit i verificat el mateix dia.** `sql/2026-08-01_incidencia_5.5_rls_autovot.sql`: `votes_insert_own` i `votes_update_own` exigeixen que la foto votada no sigui del mateix votant — sense excepció d'admin (a diferència de 4.2, aquí no hi ha cap bypass legítim). ⚠️ La primera aplicació a Test tenia un bug d'ambigüitat de columna (`photo_submissions` també té `user_id`; sense qualificar, `ps.user_id = user_id` es resolia com `ps.user_id = ps.user_id`, sempre cert, cosa que bloquejava **tots** els vots) — detectat en el mateix acte comprovant la política aplicada, corregit qualificant amb `votes.user_id`/`votes.photo_id` abans de re-verificar res més. Guarda bessona a `handleStar()`, `saveVoteOnClick()`, `_applyPuntuacio()` i `saveVoteOnClickPuntuacio()` (`votacio.js`), amb la clau `own_photo_vote_error` (CA/ES) a `i18n.js`. Reproduint exactament la mateixa prova (consola, mateixa foto): cap fila creada, i un vot legítim sobre una altra foto es va seguir desant amb normalitat. **Portat a Normal el mateix dia**: comprovat abans que FEM-Reptes ja amaga les estrelles de la pròpia foto (`isOwn` a `votacio.js`) i no té cap camí de codi que hi escrigui (ni bulk, ni admin, ni codi mort actiu), així que la política més estricta no li canvia res |

**Criteri de tancament de la Fase 4**: tots els punts amb casella marcada, i cap incidència
blocadora oberta. Les no blocadores poden passar al backlog del pla amb el seu número de punt.

### Dades de prova vives a Test (esborrar en tancar els blocs)

- ~~Repte «ZZ Prova B3 (esborrable)», `obj_1785414100165`~~ — creat i **esborrat** el 30/07/2026, en
  tancar el bloc 3 (0 fotos, 0 vots, 0 files de seguiment, comprovat abans d'esborrar).
- **Un sol repte actiu a la vegada**, criteri adoptat el 30/07/2026: amb més d'un, quin surt a la
  pantalla del soci és arbitrari i cap criteri és comprovable. **«Repte de proves» reactivat
  (`status='active'`) el 02/08/2026 per al bloc 7, i tornat a `inactive` el mateix dia** en tancar
  el bloc; «Contrallums» segueix `inactive` (era l'actiu del bloc 4). Cap repte actiu ara mateix.
- ~~Vots enviats a «Repte de proves» per al bloc 7~~ — **desfets el 02/08/2026**, en tancar el bloc:
  els de Pablo (`u_1774373540112`), Enric (`u_1774962189305`) i Enric S. (`u_1778265029500`) es van
  posar `es_esborrany=false` per provar l'empat de 7.4/7.5 (cap valor de vot tocat, ja hi eren en
  esborrany des del 26/07/2026) i han tornat a `es_esborrany=true`, amb el mateix `submitted_at`
  original de cadascun — Test queda idèntic a com estava abans del bloc 7. El vot parcial d'«TEST
  Anna Puig» (2 fotos de 4, amb zeros) no s'hi ha tocat en cap moment: ha seguit en esborrany tota
  l'estona.
- **Commutador de sistema de puntuació a Test**: `sistema_puntuacio_nou = true` («Nou»), l'estat
  final correcte després de tancar els blocs 5 (que el va posar a «Antic») i 6.
- ~~«TEST Pol Ferrer» (`u_test_1785060004`) com a `admin`~~ — promogut per Enric per als blocs 8/9,
  **tornat a `participant` el 02/08/2026** en tancar la fase (verificat per SQL). Torna a ser el
  `participant` fixe del bloc 7 (autor d'una de les fotos de «Repte de proves»).
- ~~«TEST Bloc9» (`u_1785673562097`)~~ — creat pel 9.1 i **esborrat per Enric l'02/08/2026** en
  tancar el bloc 9 (l'única acció del bloc que no es fa des d'aquí, per norma pròpia). Reutilitzat
  en cadena pels punts 9.1/9.3/9.4 abans de la baixa; email final `test.bloc9-new@fem-foto.test`.
  Verificat per SQL: 0 files a `public.users`, `auth.users` i `zampa_user_ranks` per aquest id.
- **`app_settings.general_ranking`**: restaurat el 30/07/2026 al valor previ al punt 3.6, després que
  la finalització del repte l'inflés (incidència 3.6).
- ~~«TEST Bloc10» (`u_1785683546213`) i «TEST Bloc10b» (`u_1785683757825`)~~ — creats pel 10.4 des
  del panell de FEM-Reptes (Test), per provar pujada i votació en viu des de l'app antiga. La foto
  de prova i el vot ja s'havien esborrat per SQL; **els dos comptes esborrats per Enric el
  02/08/2026** (verificat: 0 files a `public.users`/`auth.users`). «Contrallums»
  (`obj_1784882067351`), reactivat i desactivat dues vegades durant la prova, ha quedat verificat
  que torna exactament als valors originals (`inactive`, `uploads_enabled=true`/`calendari`,
  `voting_enabled=false`/`calendari`).
- ~~Comptes d'un sol ús del bloc 4~~ — **esborrats l'01/08/2026**, en tancar el bloc: «TEST Bloc4 A»
  (`u_1785520271213`) i «TEST Bloc4 B» (`u_1785520563655`), per SQL directe (`DELETE FROM
  public.users` amb CASCADE cap a `photo_submissions`/`votes`, després `DELETE FROM auth.users`
  amb el seu `auth_user_id` — la mateixa parella d'operacions que fa `fem_delete_account()`, cridada
  a pèl perquè la RPC exigeix sessió d'admin i el MCP no en té cap). La foto de B ja s'havia esborrat
  sola provant el 4.7; la de A (`photo_1785520442921`) ha caigut ara per CASCADE. Verificat:
  0 files a `public.users`, `auth.users`, `photo_submissions` i `votes` per aquests dos ids.
- ~~Comptes d'un sol ús dels blocs 5 i 6~~ — **esborrats l'01/08/2026**, en tancar el bloc 6: «TEST
  Bloc5 A» (`u_1785608190268`) i «TEST Bloc5 B» (`u_1785610142512`), mateix mètode que el bloc 4.
  La seva votació —la que va servir per verificar el 6.5, la barreja de sistemes— ha caigut per
  CASCADE junt amb els comptes; queda documentada als valors concrets citats als punts 6.5/6.6 i al
  script del directori de treball de la sessió. La foto de prova «TEST Bloc5 A»
  (`photo_test_bloc5a`, inserida per SQL reutilitzant una URL de Cloudinary ja existent) ha caigut
  amb el compte. `seguiment_votacio` **no té CASCADE** cap a `users` (no hi ha cap clau forana): cal
  esborrar-ne les files a mà, a diferència de `photo_submissions`/`votes`. Verificat: 0 files a les
  cinc taules per aquests dos ids.

### Obert de la incidència 2.3: l'email de l'expert a Normal

A Normal, «Jordi Farrus» segueix amb `email = 'Jordi'`. Com fer-ho, quan es decideixi:

- **Pel panell** (Socis → editar soci → email), **mai** per l'editor de taules: la RPC
  `fem_admin_set_email()` escriu `public.users`, `auth.users` i `auth.identities` dins la mateixa
  transacció, i valida el format amb una expressió regular —per això `'Jordi'` no hi va poder entrar
  mai per aquest camí.
- **No donar-lo d'alta de nou**: un registre nou crea un `id` nou i els seus **23 vots**, la fila de
  `seguiment_votacio` d'«Escales» i el que tingui a Zampa penjarien de l'id vell. És el cas del
  duplicat a la Classificació General del 25/07/2026.
- **Zampa no se'n ressent**: hi consta (`zampa_role = 'user'`), però les seves taules referencien el
  soci per `user_id` (= `users.id`), no per email (`zampa_user_ranks.user_id`). L'única conseqüència
  és d'identitat: si entra a Zampa escrivint «Jordi» al camp d'usuari, haurà de posar-hi l'adreça.
- `email_confirmed_at` ja és cert i la RPC no el toca: no cal cap confirmació per correu.
- A **Test** hi ha la seva adreça real. Mentre hi sigui, **no** provar-hi la recuperació per correu ni
  l'enllaç màgic amb aquest compte: el correu li arribaria de debò.

---

## Annex A — Incidència 7.1: el sistema nou reordena els reptes històrics

Trobat el 29/07/2026 executant el punt 7.1 per SQL sobre **Normal**, en lectura. Cap escriptura.

### El fet

Comparant, repte per repte i foto per foto, la posició que dona el motor antic (3 criteris) amb
la que dona el motor nou (`valoracio`), amb el mateix conjunt de votants i el mateix pool de fotos
que fa servir l'app:

| Repte | Fotos | Posicions diferents |
|---|---|---|
| Dominant vermell | 19 | 0 |
| Dominant verda | 23 | 0 |
| Dominant blava | 21 | 0 |
| **Escales** | 23 | **19** |

A Test no es reprodueix: només té un repte finalitzat i amb 8 notes distintes, massa poc per
xocar-hi. **Per això no s'havia vist.**

Efecte a la Classificació General (mateix càlcul de punts per posició, `scope = 'all'`):

| Soci | Punts avui | Punts amb el sistema nou | |
|---|---|---|---|
| Aina Ricart i Ramon | 31,0186 | 28,0285 | −2,99 |
| Jordi Roma | 32,0090 | 30,0090 | −2,00 |
| Esteve De La Paz | 20,0191 | 18,0191 | −2,00 · i **baixa del 4t al 5è lloc** |
| Jesús Grinyó i Quer | 15,0190 | 14,0190 | −1,00 · **7è → 8è** |
| Marta Inchausti, Maribel Grau, Laura Pérez | | | −1,00 cadascuna |
| Nuria Pleguezuelo | | | **5è → 4t** |
| Julien Plaquet | | | **8è → 7è** |

No és cosmètic: canvia l'ordre de la Classificació General de socis reals.

### La causa

El trigger `fem_sync_valoracio()` desa `round((c+t+comp)*10.0/15, 2)`, i la columna
`votes.valoracio` és `numeric(4,2)`. Sense l'arrodoniment, la nota nova d'una foto seria
**exactament el doble** de l'antiga (`(c+t+comp)/3 × 2`), i per tant l'ordre i les posicions
serien idèntics per àlgebra, sense haver de comprovar res.

Amb l'arrodoniment a 2 decimals, cada vot arrossega un residu de fins a ±0,0033. Els residus no
es cancel·len, i **trenquen els empats exactes** del sistema antic. A «Escales» n'hi havia tres:

| Empatats a la posició | Suma de criteris | `valoracio` acumulada |
|---|---|---|
| 4 — Marta Albertí / Jordi Roma | 266 i 266 | 177,34 vs 177,32 |
| 16 — José Antonio Sancho / Toni Garcia | 195 i 195 | 130,02 vs 129,99 |
| 20 — Maribel Nuñez / Juan Loewe | 165 i 165 | 110,00 vs 109,99 |

⚠️ La tercera parella **no empata dins l'app**, tot i sumar el mateix: el motor antic la separa
per un artefacte de coma flotant (vegeu «El detall del tercer empat», més avall).

Cada empat trencat empeny una posició avall tothom qui ve després (les posicions són denses), i
d'aquí surten les 19 diferències. **Qui guanya cada desempat el decideix el residu de
l'arrodoniment**, no res que tingui a veure amb les fotos.

Els altres tres reptes no es mouen perquè els seus empats surten de fotos amb la **mateixa**
distribució de criteris: mateix arrodoniment, mateix residu, empat conservat.

### Solució aplicada (29/07/2026)

**El motor nou ordena per la nota arrodonida a 2 decimals**, que és exactament la que es mostra a
la pantalla. Una línia a `getPhotoValoracio()` ([ranking.js](../js/features/ranking.js)): ni
migració, ni canvi de trigger, ni de tipus de columna. Per tant **no toca res compartit amb
FEM-Reptes ni amb Zampa**, que és el que interessa mentre convisquin.

Resultat a «Escales», replicant l'aritmètica de coma flotant del navegador:

| | Posicions diferents de l'antic |
|---|---|
| Abans del canvi | **19** de 23 |
| Després del canvi | **1** de 23 |

Als altres tres reptes: 0 diferències, abans i després. Arrodonir a 1 decimal, en canvi, seria
molt pitjor (21 diferències a «Escales» i 15-18 als altres): fusionaria notes que sí que són
distintes.

**Què no és aquesta solució**: no és una garantia algebraica, és una comprovació empírica sobre les
86 fotos dels 4 reptes finalitzats de Normal. Dues fotos que en el futur difereixin menys de
0,005 punts quedaran empatades i compartiran posició. Es considera preferible: coincideix amb el
que veu el soci, que si dues fotos mostren la mateixa nota comparteixin posició.

### El detall del tercer empat (la diferència que queda)

La comparació per SQL amb precisió exacta deia que «Escales» tenia tres empats. Executant el codi
real de `ranking.js` a Node amb els vots reals d'aquelles fotos, resulta que **el motor antic no
empata la tercera parella**: dona 2,11538461538462 i 2,11538461538461, una diferència d'**un sol
ulp** (4·10⁻¹⁶). Ve d'arrodonir cada criteri per separat abans de sumar-los; és determinista
—comprovat amb 200 ordres de vots diferents, sempre el mateix resultat— però arbitrari, i cap dels
dos socis pot veure-ho: tots dos mostren «2,12».

Conseqüència de deixar-ho així:

| Soci | Posició avui | Posició amb el sistema nou | Punts |
|---|---|---|---|
| Juan Loewe Tarmann | 20 | 20 | 1,0090 → 1,0090 |
| Maribel Nuñez de Murga | 21 | **20** (empatada) | 1,0089 → **1,0090** |

**Acceptat per Enric el 29/07/2026.** Les dues fotos sumen exactament els mateixos punts de criteris
(165); que avui no empatin és el defecte, no la referència. El guany per a Maribel és de 0,0001
punts, no mou ningú de lloc a la Classificació General, i corregir-ho demanaria tocar el motor
antic —que és el que els socis ja han vist i que al tall queda amagat.

### Com s'ha verificat

- **Codi real a Node**: còpia de `js/features/ranking.js` generada amb `sed` (només les 4 línies
  d'`import` canviades per stubs), alimentada amb les files reals de Normal de les 6 fotos
  empatades i els 26 votants. Abans del canvi: 5 posicions de 6 diferents. Després: 1, i és la
  parella de l'ulp. El banc de proves viu al directori de treball de la sessió, fora del repo; si
  es vol conservar, val la pena decidir on.
- **SQL sobre Normal, en lectura**: comparació repte per repte i foto per foto, amb precisió
  exacta i replicant també la coma flotant del navegador.
- **A la interfície, per Enric (29/07/2026, verd)**: notes i decimals correctes, commutació entre
  sistemes sense sorpreses, i **empat de punts = mateixa posició**. Amb un repte de prova muntat a
  Test expressament (dues fotos amb els mateixos totals per criteri —12/12/12— però repartiments
  per vot diferents, 13/13/10 contra 12/12/12, que és el que feia divergir la `valoracio`
  acumulada: 24,01 contra 24,00): les dues empaten a la 1a posició amb els dos sistemes, i la
  tercera queda 2a amb tots dos. Verificat també a la Classificació General de Test, sumant els
  punts repte per repte (33 / 32 / 28, idèntics amb «Antic» i amb «Nou»). Sense la correcció,
  aquell empat es trencava i la tercera foto queia a la 3a posició.
  Scripts de les dades de prova i de la seva marxa enrere: al directori de treball de la sessió.

---

## Annex B — Incidència 1.11: la revocació de sessions és diferida

Trobada el 29/07/2026 executant el punt 1.11 a Test, amb un compte d'un sol ús.

### El fet

Amb el compte de proves amb la sessió oberta en una finestra, un admin li fa **Reset** des del
panell de Socis. La finestra del soci **segueix activa**, i **recarregar la pàgina tampoc no la fa
fora**.

Al servidor, en canvi, tot s'ha fet:

| Comprovació | Resultat |
|---|---|
| Contrasenya nova a `public.users` i a `auth.users` | sí, i coincideixen |
| Contrasenya anterior | ja **no** valida |
| `auth.sessions` del soci | **0** |
| `auth.refresh_tokens` del soci | **0** |

### La causa

Supabase valida cada petició amb el **testimoni d'accés (JWT)** que el navegador ja té: la RLS en
llegeix `auth.uid()` a partir de la **signatura**, sense consultar `auth.sessions`. Per tant:

- Esborrar les files de sessió no invalida un testimoni ja emès.
- Recarregar la pàgina no ajuda: el SDK llegeix el testimoni de `localStorage` i, si no és a prop
  de caducar, no parla amb el servidor.
- El sondeig d'auto-refresc de l'app (cada 30 s, `startAutoRefresh()` a
  [router.js](../js/core/router.js)) fa consultes de **dades**, que amb un JWT vàlid funcionen: no
  detecta res.
- Qui acaba expulsant la finestra és el **primer intent de renovació** del testimoni: el refresh
  token ja no existeix, el SDK emet `SIGNED_OUT`, i `_listenAuthChanges()`
  ([login.js](../js/screens/login.js)) torna a la pantalla d'accés amb l'avís de sessió caducada.

O sigui: **la revocació funciona, però arriba tard** — fins a la durada del testimoni d'accés (el
valor per defecte de Supabase és 3600 s; el real es llegeix al tauler, Authentication → Sessions).
Mentrestant aquell soci pot seguir llegint **i escrivint**.

### Per què no s'havia vist el 28/07

Perquè es va verificar el que es podia verificar per SQL i per crida directa: que les files de
sessió havien desaparegut i que un **intent de renovació** donava `refresh_token_not_found`. Totes
dues coses són certes. El que no es va provar és el que ara s'ha provat: una finestra ja oberta,
sense tocar-la. És la mateixa lliçó del 27/07 amb les proves negatives, en una altra forma: **una
comprovació al servidor no demostra el que passa al client.**

### Opcions

1. **Afegir una validació de sessió al sondeig de 30 s**: cridar `sb.auth.getUser()` (que sí que
   va al servidor) i, si falla, forçar la sortida. Expulsió en menys de 30 s, cost d'una crida
   extra cada mig minut. És l'opció recomanada si es vol arreglar.
2. **Escurçar la caducitat del testimoni** al tauler de Supabase (per exemple 900 s). Acota la
   finestra per a tothom, a canvi de més renovacions. Es pot combinar amb l'1.
3. **Acceptar-ho i deixar-ho escrit.** Defensable: el cas d'ús normal del Reset és un soci que ha
   perdut l'accés, no un compte segrestat. Deixa de ser defensable el dia que el Reset es faci
   servir *per* fer fora algú.

Cap de les tres bloca el tall de domini. La correcció dels documents que prometien una expulsió
immediata (`docs/REFERENCIA_BD.md` i `ANALISI_Login_Navegacio.md` §1.5) sí que s'ha fet ja.

### Solució aplicada (29/07/2026): l'opció 1

Enric va triar l'opció 1. Al sondeig de 30 s d'`startAutoRefresh()`
([router.js](../js/core/router.js)) s'hi ha afegit una validació de la sessió contra el servidor
(`sb.auth.getUser()`) i, si el servidor la rebutja, es tanca la sessió local; el listener
`_listenAuthChanges()` de [login.js](../js/screens/login.js) ja s'encarrega de portar l'usuari a la
pantalla d'accés amb l'avís de sessió caducada. **Expulsió en 30 segons com a màxim** en lloc de
fins a una hora.

Dues condicions perquè el remei no fos pitjor que la malaltia:

- **Sense sessió local no es comprova res.** Qui entra pel camí de reserva (`fem_login`, sense
  sessió d'Auth) no en té, i no se l'ha de fer fora.
- **Només es tanca amb un rebuig d'autenticació.** Un error de xarxa no pot treure de l'app un
  soci amb mala cobertura, que amb aquest públic hauria estat pitjor que el problema original.

⚠️ **El codi de rebuig és 403, no 401** (comprovat contra el projecte de Test): 401 és el que
retorna `/auth/v1/user` quan **no** hi ha cap testimoni, i 403 quan n'hi ha un que no val. La
condició cobreix els dos; filtrant només per 401 el canvi no hauria fet res justament en el cas
que havia d'arreglar.

**Verificat a la interfície** (Enric, 29/07/2026): amb el compte de proves amb la sessió oberta i
un Reset fet des d'una altra finestra, la finestra del soci salta sola a la pantalla d'accés
—vist en directe, sense tocar-la—, amb el 403 de `/auth/v1/user` a la consola i tot seguit el
missatge de `_listenAuthChanges()`. Al servidor, `auth.sessions` i `auth.refresh_tokens` a 0 i la
contrasenya temporal coincidint a les dues taules.
