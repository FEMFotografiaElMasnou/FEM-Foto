# FEM · Fotografia El Masnou

## Unificació de Reptes i Resultats: context i pla de desenvolupament

*Document de treball · 24 de juliol de 2026 · Preparat per Claude a partir de FEM-Reptes i FEM-Resultats*
*Actualitzat 25 de juliol de 2026 (Pas 3 de la Fase 3) des de la sessió de Claude Code sobre el repo FEM-Foto — vegeu la secció 8.*
*Convertit a Markdown el 26 de juliol de 2026 (abans en .docx) per facilitar-ne el manteniment directe des de Claude Code.*

## 1. Context i motivació

El club FEM Fotografia El Masnou (~50 socis) organitza reptes fotogràfics periòdics: cada temàtica, els socis pugen una foto, voten les de la resta i s'obté un rànquing del repte i una Classificació General acumulada.

Aquesta funcionalitat va néixer com una única aplicació, FEM-Reptes. Amb el temps es va desenvolupar, de forma independent, FEM-Resultats: una segona aplicació centrada a mostrar amb més detall els Resultats de cada repte i la Classificació General. Avui, Resultats es mostra dins de Reptes mitjançant un iframe (pantalla de participant), i totes dues apps llegeixen i escriuen sobre la mateixa base de dades Supabase.

El problema d'aquest muntatge és que la lògica de puntuació i rànquing està duplicada: existeix un cop dins de FEM-Reptes (`js/features/ranking.js`) i un altre cop, reimplementada de forma independent, dins de FEM-Resultats (`src/utils.js`). Qualsevol canvi al sistema de vot obliga a tocar dues bases de codi, dos repositoris i dos desplegaments de Vercel, amb risc que quedin descoordinats.

**Decisió de la reunió de socis (23 de juliol de 2026):** es canvia el sistema de votació. En lloc de tres criteris (Creativitat, Temàtica, Composició, 0–5 cadascun), es votarà un sol concepte, "Puntuació", amb escala 0–10. Amb aquesta puntuació s'obté el rànquing del repte, i d'aquest rànquing surten els punts per a la Classificació General, exactament com fins ara.

Aquest canvi afecta per igual totes dues aplicacions. És el moment natural per no fer la feina dues vegades: es proposa unificar Reptes i Resultats en una única aplicació nova, FEM-Fotografia El Masnou ("Foto"), i aplicar-hi el canvi de puntuació ja unificat.

## 2. Arquitectura actual

Resum tècnic de les dues aplicacions tal com estan avui:

| | FEM-Reptes | FEM-Resultats |
|---|---|---|
| **Stack** | HTML + CSS + JS amb mòduls ES natius, sense framework ni build | React 19 + Vite |
| **Repo GitHub** | FEMFotografiaElMasnou/FEM-Reptes | FEMFotografiaElMasnou/FEM-Resultats |
| **Desplegament** | Vercel — domini públic femfotografiaelmasnou.cat | Vercel — fem-resultats.vercel.app (sense domini propi) |
| **Base de dades** | Supabase, amb commutador Normal / Test des de la UI | Supabase, només projecte Normal (sense mode Test) |
| **Rol** | App principal: login, admin, participant, pujada, votació, galeria, calendari | Pantalles de detall: Resultats de Repte i Classificació General, embegudes a Reptes via iframe |
| **Càlcul de rànquing** | `js/features/ranking.js` — mitjana de 3 criteris + taula de punts per posició | `src/utils.js` — la MATEIXA fórmula, reimplementada de forma independent |

Taules clau compartides a Supabase: `objectives` (reptes, amb el calendari de pujada/votació incorporat des del 24/07/2026), `photo_submissions` (fotos pujades), `votes` (un vot per usuari+foto+repte, columnes creativity/theme/composition), `seguiment_votacio` (marca si un usuari ha enviat definitivament el seu vot per a un repte), `users` (rols admin/participant/expert) i `app_settings`/`app_texts`. Les imatges es serveixen via Cloudinary. La seguretat real recau en les polítiques RLS de Supabase, no en amagar la clau anon (dissenyada per ser pública).

## 3. Nou sistema de puntuació (acordat pels socis)

| | Sistema actual | Sistema nou (acordat 23/07/2026) |
|---|---|---|
| **Criteris de vot** | 3 criteris: Creativitat, Temàtica, Composició | 1 sol criteri: "Puntuació" |
| **Escala** | 0–5 (estrelles) per criteri | 0–10 |
| **Nota final de la foto** | Mitjana dels 3 criteris | La pròpia puntuació |
| **Rànquing del repte** | Ordenat per nota final | Ordenat per puntuació (sense canvis de mecànica) |
| **Punts a la Classificació General** | Taula per posició: 25, 18, 15, 12, 10, 8, 7, 6, 5, 4… | Es manté la mateixa taula de punts per posició |

Es manté sense canvis el filtre de vot per rol que ja existeix a totes dues apps (Tots els vots / Vots dels socis / Vot expert).

**Vots històrics dels reptes ja finalitzats:** es mantenen intactes — no s'elimina ni el camp ni les dades dels 3 criteris (creativity/theme/composition). Les pantalles actuals per criteri continuen sempre disponibles i operatives per als reptes tancats.

**Aclariment (25/07/2026):** la proposta original d'aquest document ("no migrar-los") feia referència a no ELIMINAR els camps ni les dades antigues — no a no derivar-ne cap valor nou. En aquest sentit, el Pas 1 de la Fase 3 (afegir el camp `votes.valoracio`, calculat per un trigger a partir dels 3 criteris antics sense tocar-los) hi encaixa perfectament, sense cap contradicció. A més, això permet que la nova pantalla unificada (sota Valoració 0–10) també pugui mostrar els reptes antics ja normalitzats, sense haver de mantenir dues implementacions de pantalla en paral·lel. Aplicat i verificat a Test (969 vots) i Normal (1059 vots) — vegeu secció 8 i `ANALISI_Fase3_Puntuacio.md`, secció 3.2.

## 4. Proposta: FEM-Fotografia El Masnou (Foto)

Objectiu: una única aplicació que integri tota la funcionalitat de Reptes més les dues pantalles de Resultats (Resultats de Repte i Classificació General), sense iframe i sense lògica de rànquing duplicada, com a base sobre la qual aplicar el nou sistema de puntuació un sol cop.

**Enfocament tècnic acordat:** FEM-Reptes com a base. Ja cobreix la major part de la funcionalitat (login, admin, participant, pujada de fotos, votació, galeria, calendari de reptes). S'hi incorporen com a pantalles natives noves les dues vistes de Resultats, adaptant-les a l'estil JS modular sense build de Reptes; FEM-Resultats deixa de rebre desenvolupament un cop migrada.

### Convivència durant el desenvolupament

- Repositori GitHub propi (sota l'organització FEMFotografiaElMasnou) i projecte Vercel propi, sense domini assignat.
- Es connecta a la MATEIXA arquitectura que Reptes i Resultats: mateix Supabase (Normal i Test) i mateix compte de Cloudinary — zero interferència amb la producció actual.
- El domini públic femfotografiaelmasnou.cat continua apuntant a Reptes fins que Foto estigui completament validada; només llavors es reapunta.
- Desenvolupament amb Claude Code, sobre la infraestructura ja preparada.

## 5. Pla de desenvolupament per fases

| Fase | Nom | Contingut |
|---|---|---|
| 0 | Diagnosi i pla | Aquest document: recull la situació actual, la decisió de la reunió de socis i el pla per unificar-ho tot. (Fet) |
| 1 | Bastida del projecte | Repo GitHub nou + projecte Vercel nou (sense domini), connectats a la mateixa BD Supabase (Normal/Test) i al mateix compte de Cloudinary. Es parteix del codi de FEM-Reptes com a punt de partida. **Estat (25/07/2026):** repo GitHub FEMFotografiaElMasnou/FEM-Foto creat i connectat (origin). Projecte Vercel i variables d'entorn: per confirmar amb Enric. |
| 2 | Integració nativa de Resultats | Es porten "Resultats de Repte" i "Classificació General" a dins de l'app com a pantalles pròpies (nova entrada al menú/router), es retira l'iframe i es deixa un ÚNIC càlcul de rànquing (`ranking.js`). **Estat (25/07/2026):** FET i validat per Enric. Les dues pantalles natives repliquen l'estètica de FEM-Resultats (targetes amb estrelles, taula de Classificació amb miniatures per repte). Iframe i RESULTATS_BASE retirats del tot. |
| 3 | Nou sistema de puntuació | Canvi d'esquema a la taula `votes` (nova columna de puntuació 0–10), nou control de vot a la UI (1 selector en lloc de 3 files d'estrelles), adaptació de `ranking.js` i del desglossament de resultats. Primer a Supabase Test, després a Normal. **Estat (25/07/2026):** EN CURS. Pas 1 (columna `votes.valoracio` + trigger) i Pas 1b (correcció: valoracio es guarda amb decimals, numeric, no arrodonit a enter) fets i verificats a Test i Normal. Pas 2 (pantalla nova «Valoració Repte», en paral·lel a Resultat Repte, només visible per a comptes admin) FET. Pas 2b (25/07/2026): panell de puntuació propi al visor de fotos («Valoració Repte»), amb disparador ⓘ ancorat a la mateixa foto (no a la pantalla) i taula Votants/Puntuació/Posició; «Resultat Repte» queda intacte amb la seva estrella i cortina de 3 criteris. FET. Pas 3 (25/07/2026): «Taula de Classificació», pantalla nova en paral·lel a Classificació General (intacta), amb el mateix motor de punts per posició alimentat per valoracio en lloc dels 3 criteris — verificat per Enric que dona els mateixos punts i posicions que l'actual, com s'esperava. FET. Fase 3, pla per passos acordat, tancada. Pas 4 (26/07/2026): nova pantalla «Puntuar Repte» amb el control de captura 0–10 definitiu, FET i validat per Enric — vegeu secció 8. Pendent, sense calendaritzar: el redisseny de les pantalles de resultat per al sistema d'1 sol concepte. |
| 4 | Proves internes | Validació amb l'entorn de Test, comparant resultats amb Reptes + Resultats actuals per descartar regressions. |
| 5 | Validació amb els socis | Foto accessible per la URL de Vercel (sense domini públic) perquè Pablo i la resta de socis la revisin sense risc per a la producció actual. |
| 6 | Tall (cutover) | femfotografiaelmasnou.cat es reapunta cap al projecte Vercel de Foto. Moment sensible: franja de baix ús + pla de reversió del DNS. |
| 7 | Retirada | Un cop Foto porti un temps estable en producció, s'arxiven (no s'esborren de seguida) els repos i desplegaments de Reptes i Resultats. |

## 6. Riscos i punts d'atenció

- Doble manteniment temporal: mentre Foto es desenvolupa en paral·lel, qualsevol canvi urgent a producció (Reptes/Resultats) s'haurà de replicar manualment si el codi ja s'ha bifurcat — convé no allargar aquesta fase més del necessari.
- Dades històriques: resolt (secció 3) — els camps i dades dels 3 criteris no s'eliminen mai; el nou camp valoracio es deriva a partir d'ells sense tocar-los.
- Tall de domini (Fase 6): moment sensible — fer-ho en una franja de baix ús i tenir clar el pla de reversió del DNS cap a Reptes si calgués.
- Consistència de claus/entorn: les claus anon de Supabase són públiques per disseny (la seguretat recau en RLS), però cal mantenir els tres projectes (Reptes, Resultats, Foto) apuntant exactament als mateixos projectes Supabase i Cloudinary mentre convisquin.
- **[Nou, detectat 24/07/2026]** La taula `users` del projecte Supabase es comparteix amb una altra app del club ("Zampa"), amb les seves pròpies taules (zampa_*). Qualsevol operació en cascada sobre users (TRUNCATE, DELETE) esborraria també dades de Zampa — cal revisar-ho sempre abans d'operacions destructives sobre aquesta taula.
- **[Nou, detectat i resolt 25/07/2026]** Manifestació concreta del risc anterior: José Antonio Sancho Pastor tenia dos comptes a `users` (un per email diferent, cadascun amb activitat real repartida entre Reptes/Foto i Zampa), fent que sortís duplicat a la Classificació General. Fusionat a Normal (`sql/2026-07-25_merge_duplicate_user_sancho.sql`): reassignada la seva foto a l'únic compte amb activitat real i esborrada la fila buida. Es va detectar el mateix patró, encara sense resoldre a petició d'Enric, per a Harald Hausleithner — actualment inofensiu perquè el segon compte només té dades de Zampa.
- **[Nou, detectat 24/07/2026]** El camp `users.password` es llegeix/escriu en clar des del client (sense hash). Ja identificat per Enric com a canvi pendent, fora de l'abast d'aquesta unificació.

## 7. Propers passos immediats

*Nota (25/07/2026): aquests 5 passos de bastida ja s'han completat (el repo GitHub existeix i el desenvolupament ja avança dins seu, en Fase 2 i 3). Es mantenen a sota com a historial. Per a l'estat real i el proper pas, vegeu la secció 8.*

A partir d'aquí, t'aniré guiant pas a pas pel xat, un pas a la vegada:

- Pas 1 — Confirmar el nom del repositori/projecte (proposta: FEM-Foto o FEM-Fotografia-El-Masnou) i crear-lo a GitHub, sota l'organització FEMFotografiaElMasnou.
- Pas 2 — Crear el projecte Vercel nou i connectar-lo al repo, sense domini.
- Pas 3 — Clonar FEM-Reptes com a punt de partida dins el nou repositori.
- Pas 4 — Configurar les variables d'entorn (Supabase Normal/Test, Cloudinary) al nou projecte.
- Pas 5 — Obrir Claude Code sobre el nou repo i començar la Fase 2 (integració nativa de Resultats).

## 8. Estat actual (actualitzat 26 de juliol de 2026)

**Fase 1 — Bastida:** repo GitHub FEMFotografiaElMasnou/FEM-Foto creat i connectat (origin/main). Projecte Vercel i variables d'entorn: pendents de confirmar amb Enric (no verificable des de la sessió de Claude Code).

**Fase 2 — Integració nativa de Resultats: FETA i validada per Enric, sense cap dependència pendent de FEM-Resultats.** Resultat Repte i Classificació General són pantalles natives (sense iframe), amb selector de vot Tots/Socis/Expert i l'estètica calcada de FEM-Resultats. RESULTATS_BASE i tot el codi de l'iframe retirats.

**Confirmat (26/07/2026):** aquesta fase es pot donar per completament tancada, independentment del que passi amb l'app FEM-Resultats. Cerca a tot el codi de Foto (`js/`, `index.html`, `vercel.json`) de `iframe`, `RESULTATS_BASE` i `FEM-Resultats`: **cap resultat**. L'únic rastre que queda al repo és `_reference-resultats/` (còpia estàtica del codi font React d'abans, mantinguda només com a referència de consulta) — no es carrega ni es construeix mai des de Foto, no és una dependència en temps d'execució. És a dir: si avui s'esborrés el repo i el desplegament de FEM-Resultats, "Resultat Repte" i "Classificació General" de Foto continuarien funcionant exactament igual, amb el seu propi motor de càlcul natiu (`ranking.js`).

Aquesta confirmació és independent del tall encara pendent de la Fase 3 (vegeu més avall i `ANALISI_Fase3_Puntuacio.md` §6) — aquell tall és sobre el canvi de sistema de puntuació (amagar el sistema antic de 3 criteris dins la mateixa Foto), no sobre la integració de Resultats, que ja no té cap fil pendent amb l'app externa.

**Fase 3 — Nou sistema de puntuació: EN CURS.** Pas 1: columna votes.valoracio (0–10) afegida i sincronitzada amb un trigger a partir dels 3 criteris antics (sense eliminar-los ni tocar-los), coherent amb la proposta original de la secció 3 (vegeu aclariment). Pas 1b (25/07/2026): es va detectar que tant el trigger com el client (data.js) arrodonien/truncaven a enter, perdent els decimals que la normalització 15→10 hauria de conservar (detectat comparant amb un càlcul manual en full de càlcul) — corregit: valoracio ara es guarda com a numeric amb 2 decimals, backfill refet, i el client ja no trunca cap dels 4 camps de vot (creativity/theme/composition/valoracio). Verificat a Test i Normal, valors coincidents amb el càlcul manual. Pas 2 (25/07/2026): construïda «Valoració Repte», pantalla nova en paral·lel a Resultat Repte (que es manté intacta), amb el mateix disseny de targeta però una barra de progrés 0–10 en lloc d'estrelles; accessible només des del compte admin (nova entrada a la pantalla d'inici), per comparar el nou sistema amb l'actual abans de decidir res més. Pas 2b (25/07/2026): el visor de fotos a pantalla completa, obert des de «Valoració Repte», mostrava fins ara la cortina vella de 3 criteris (bug de disseny compartit amb «Resultat Repte»); es va construir un disparador i panell propis i independents per a «Valoració Repte» — icona ⓘ ancorada a la cantonada inferior-esquerra de la pròpia foto (no de la pantalla), i en clicar-hi, una taula compacta amb 3 columnes (Votants/Puntuació/Posició) i 3 files (Total Vots/Vots Socis/Vots Experts). Iterat amb Enric sobre captures reals (tipografia, interlineat, ubicació, estil del disparador). «Resultat Repte» no s'ha tocat. Pas 3 (25/07/2026): confirmada la hipòtesi que l'assignació de punts per posició no depèn del rang de la nota (només detecta empats per igualtat) — es va construir «Taula de Classificació», pantalla nova en paral·lel a Classificació General (que es manté intacta), mateix motor de punts alimentat per valoracio en lloc dels 3 criteris, amagada rere el mateix gate d'admin real que «Valoració Repte». Enric ho ha provat en viu i confirma que dona exactament els mateixos punts i posicions que l'actual Classificació General, el resultat matemàticament esperat. Amb això es tanca el pla per passos de la Fase 3 acordat el 24/07/2026; queden pendents de calendaritzar el nou control de vot 0–10 a la UI de captura i el redisseny de les pantalles de resultat.

**Pas 4 (26/07/2026, FET):** construïda «Puntuar Repte» (renombrada de «Puntuació Repte» el mateix dia, per distingir-la de «Valoració Repte» — vegeu `ANALISI_Fase3_Puntuacio.md` §6), nova pantalla de captura amb el control 0–10 definitiu (10 càpsules + desplegable sincronitzat, imatge més gran a 1 col mòbil/2 tauleta-desktop, `caption` de la foto en lloc del número de participant), en paral·lel a la votació real (`votacio.js`, `renderVotingGrid`/`handleStar` intactes). A diferència de «Valoració Repte»/«Taula de Classificació» (només lectura, només admin), aquesta és una eina de captura pensada per provar-se amb diversos usuaris de prova reals — la targeta és visible per a l'admin real o quan la BD activa és Test. Resolta la coexistència amb el trigger `fem_sync_valoracio()`: la nova captura també escriu als 3 camps antics amb `Puntuació/2` cadascun, perquè el trigger recalculi exactament el mateix valor. Provant-ho en directe amb Enric es van trobar i corregir diversos bugs reals preexistents (no relacionats amb aquesta feina però detectats fent-la): el botó de confirmació d'enviar vot deia "Canviar" en lloc d'"Enviar" (`confirmAction()` no netejava mai l'etiqueta), els botons `.btn-primary` anaven a tota l'amplada de pantalla arreu de l'app, el botó "Enviar Vots" de la pantalla nova no reflectia mai l'estat real (`updateVoteButtonsState()` no el gestionava), i tant la Classificació General real com la Taula de Classificació de prova no ordenaven les miniatures de reptes per data (consulta sense `.order()`) — totes corregides. Taula de Classificació ajustada perquè, per a l'admin real, també inclogui reptes actius (no només finalitzats), mateix criteri que «Valoració Repte». Colors revisats amb Enric sobre captures reals: avís "no obert" en vermell, estat "ja enviat" en ambre/daurat (no verd, per no suggerir "endavant"), selecció de càpsula/desplegable en blanc sobre blau sòlid. Detall pendent, acceptat com a menor: el punt de "Cancel·lar" es veu envitricollat per un problema de renderització de la font dels botons (Barlow Condensed), no de les dades — sense pedaç net trobat encara. Vegeu `ANALISI_Fase3_Puntuacio.md`, Pas 4, per al detall tècnic complet.

**Estratègia de transició i retirada (aclarida 26/07/2026, detall a `ANALISI_Fase3_Puntuacio.md` §6):**
el canvi de sistema de puntuació (de 3 criteris 0–5 a 1 concepte "Valoració"/"Puntuació" 0–10)
s'aplica creant una pantalla nova en paral·lel per a cada pantalla afectada (votació real →
Puntuar Repte; Resultat Repte → Valoració Repte; Classificació General → Taula de
Classificació), sense tocar mai l'original. Pantalles no afectades pel sistema de puntuació
(p. ex. la Galeria) no es toquen ni es dupliquen. Durant tot aquest període de convivència,
les pantalles noves només són visibles per a l'admin real (i, «Puntuar Repte», també quan la
BD activa és Test). Quan es doni per finalitzada la integració i el canvi de puntuació, els
nav-cards d'accés a les pantalles antigues deixaran de mostrar-se i els de les noves passaran
a ser visibles per a tothom — però les pantalles i nav-cards antics **no s'esborraran del
codi**, només quedaran ocults, per si mai calgués un retorn (poc probable però no impossible)
al sistema antic.

**Treball transversal, fora de la numeració de fases (obert 26/07/2026):** aprofitant que
Fase 2 i Fase 3 estan tancades, Enric vol abordar dos aspectes pendents a nivell de tota
l'app, independents d'aquesta unificació: (1) el sistema de login/autenticació/gestió
d'usuaris, i (2) la navegació (comportament en refrescar i en prémer "enrere"). Anàlisi
completa a `ANALISI_Login_Navegacio.md` — inclou dades reals dels advisors de seguretat de
Supabase (RLS "activada" però amb polítiques permissives a totes les taules, incloent
`users.password` en clar llegible per qualsevol via l'API pública).

**Estat del bloc (1) autenticació, a 27/07/2026 — en marxa, decidit migrar a Supabase Auth:**

- **Fase 1.3 (26/07)** — tancada l'exposició de contrasenyes: la verificació es fa al servidor
  (`fem_login()`) i el client ja no pot llegir la columna `password`.
- **Pas 1 i 2 (26/07)** — columna pont `users.auth_user_id` i creació dels comptes reals a
  `auth.users` preservant les contrasenyes actuals (Test 50/50, Normal 41/41). Cap soci ha
  hagut de fer res.
- **Pas 3a/3b/3c (27/07)** — sessions reals de Supabase Auth i polítiques RLS basades en
  `auth.uid()` als dos projectes: les escriptures obertes a internet queden tancades.
- **Pas 4a (27/07)** — altes i baixes de socis passen per funcions de servidor que creen i
  esborren el compte d'Auth juntament amb la fila de `users`. Abans, tot compte nou (registre
  o alta d'admin) quedava sense poder votar ni pujar fotos, i tota baixa deixava l'adreça
  bloquejada per sempre.
- **Pas 4b (27/07)** — Supabase Auth ja és qui decideix l'accés, i la sessió es manté oberta fins
  que es prem "Sortir" (abans, tancar la pestanya obligava a tornar a entrar). El canvi d'email
  d'un soci des del panell de Socis també actualitza el seu compte d'Auth.
- **Pas 4c (27/07)** — a la pantalla d'accés hi ha "Has oblidat la contrasenya?" i "Entrar amb un
  enllaç per correu". Qui no pot entrar ja no depèn de l'administrador: rep un correu del domini
  del club i se'n surt sol. Provat de cap a cap amb un correu real. Detall important perquè no
  quedés una porta oberta: en canviar la contrasenya des del correu, **la contrasenya antiga
  queda revocada de debò** (s'escriuen alhora les dues taules on viu, no només la de Supabase
  Auth). Mètode d'accés: contrasenya **i** enllaç màgic, a triar per l'usuari.
- **Pendent**: 4d (retirada del sistema antic).

El bloc (2), navegació, segueix sense començar.

**Documents de treball relacionats (dins del repo FEM-Foto):**

- `HANDOFF_Fase2_Resultats.md` — detall tècnic de la integració nativa de Resultats (Fase 2).
- `ANALISI_Fase3_Puntuacio.md` — anàlisi d'implicacions del nou sistema de puntuació, pla per passos i decisions preses als Pas 1/1b/2/2b/3/4.
- `ANALISI_Login_Navegacio.md` — anàlisi del sistema de login/autenticació i de la navegació de l'app (treball transversal, fora de fases).
- `sql/2026-07-24_fase3_valoracio_pas1.sql` — migració SQL del Pas 1, ja aplicada a Test i Normal.
- `sql/2026-07-25_fase3_valoracio_pas1b_decimals.sql` — migració SQL del Pas 1b (correcció de precisió), ja aplicada a Test i Normal.
- `sql/2026-07-26_*` i `sql/2026-07-27_*` — migracions de la migració a Supabase Auth (Fase 1.3 i Passos 1, 2, 3b/3c i 4a), totes aplicades a Test i Normal, cadascuna amb el seu script de marxa enrere.

**Proper pas immediat:** amb el Pas 4 tancat, queda per decidir, sense calendaritzar encara: el moment i mecanisme exacte del tall descrit més amunt (quan es considera "finalitzada" la integració per amagar els nav-cards antics i mostrar els nous a tothom — «Resultat Repte» i la seva cortina de 3 criteris no es redissenyen, es deixen intactes i ocultes), i el moment del tall per als reptes amb votació oberta.
