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
| 3 | Nou sistema de puntuació | Canvi d'esquema a la taula `votes` (nova columna de puntuació 0–10), nou control de vot a la UI (1 selector en lloc de 3 files d'estrelles), adaptació de `ranking.js` i del desglossament de resultats. Primer a Supabase Test, després a Normal. **Estat (25/07/2026):** EN CURS. Pas 1 (columna `votes.valoracio` + trigger) i Pas 1b (correcció: valoracio es guarda amb decimals, numeric, no arrodonit a enter) fets i verificats a Test i Normal. Pas 2 (pantalla nova «Valoració Repte», en paral·lel a Resultat Repte, només visible per a comptes admin) FET. Pas 2b (25/07/2026): panell de puntuació propi al visor de fotos («Valoració Repte»), amb disparador ⓘ ancorat a la mateixa foto (no a la pantalla) i taula Votants/Puntuació/Posició; «Resultat Repte» queda intacte amb la seva estrella i cortina de 3 criteris. FET. Pas 3 (25/07/2026): «Taula de Classificació», pantalla nova en paral·lel a Classificació General (intacta), amb el mateix motor de punts per posició alimentat per valoracio en lloc dels 3 criteris — verificat per Enric que dona els mateixos punts i posicions que l'actual, com s'esperava. FET. ⚠️ **Rectificat el 29/07/2026**: aquella comparació era d'un repte «Dominant» i no valia en general — «Escales» donava 19 posicions diferents de 23 per l'arrodoniment de `valoracio`. **Corregit i verificat el mateix dia** (una línia a `getPhotoValoracio()`): per SQL, amb el codi real a Node i a la interfície, amb un repte de prova a Test que reprodueix l'empat. Tot a `docs/PROVES_Fase4.md`, Annex A. Fase 3, pla per passos acordat, tancada. Pas 4 (26/07/2026): nova pantalla «Puntuar Repte» amb el control de captura 0–10 definitiu, FET i validat per Enric — vegeu secció 8. Pendent, sense calendaritzar: el redisseny de les pantalles de resultat per al sistema d'1 sol concepte. |
| 4 | Proves internes | Validació amb l'entorn de Test, comparant resultats amb Reptes + Resultats actuals per descartar regressions. |
| 5 | Validació amb els socis | Foto accessible per la URL de Vercel (sense domini públic) perquè Pablo i la resta de socis la revisin sense risc per a la producció actual. |
| 6 | Tall (cutover) | femfotografiaelmasnou.cat es reapunta cap al projecte Vercel de Foto. Moment sensible: franja de baix ús + pla de reversió del DNS. |
| 7 | Retirada | Un cop Foto porti un temps estable en producció, s'arxiven (no s'esborren de seguida) els repos i desplegaments de Reptes i Resultats. |

## 6. Estat actual (27 de juliol de 2026)

| Fase | Estat | Detall |
|---|---|---|
| 0 · Diagnosi i pla | ✅ Fet | Aquest document |
| 1 · Bastida | ✅ Fet | Repo `FEM-Foto` i projecte Vercel actius. Desplega a `fem-foto.vercel.app` |
| 2 · Integració nativa de Resultats | ✅ **Tancada** | Iframe retirat, un únic motor de rànquing. Sense cap dependència de FEM-Resultats |
| 3 · Nou sistema de puntuació | 🔄 En curs | Passos 1-4 i A-D fets **i desplegats**. El tall ja és **un clic**, no codi: només falta prémer-lo (Normal segueix en «Antic») |
| 4 · Proves internes | 🔄 Oberta el 29/07/2026 | Guió de proves a `docs/PROVES_Fase4.md` (10 blocs, criteris de verd escrits). Executat el bloc de puntuació: hi va sortir **una regressió real**, corregida i verificada (Annex A). Els blocs 1-6 i 8-10, pendents |
| 5 · Validació amb els socis | ⬜ | |
| 6 · Tall de domini | ⬜ | Llista de comprovació a `docs/TALLS.md` |
| 7 · Retirada de les apps antigues | ⬜ | Un cop FEM-Reptes deixi d'importar, executar la "Llista concreta pendent" de `docs/NETEJA_codi_mort.md` §4 (columnes/files d'`objectives`/`photo_submissions`/`app_settings` deixades quietes per prudència mentre convivien) |

**Fase 2 — per què es dona per tancada del tot (verificat 26/07/2026):** cerca a tot el codi
(`js/`, `index.html`, `vercel.json`) de `iframe`, `RESULTATS_BASE` i `FEM-Resultats`: cap
resultat. L'únic rastre és `_reference-resultats/`, una còpia estàtica de consulta que no es
carrega mai. Si avui s'esborrés el repo de FEM-Resultats, FEM-Foto seguiria funcionant igual.

**Fase 3 — què hi ha fet:** columna `votes.valoracio` amb trigger des dels 3 criteris antics
(Pas 1/1b), i les tres pantalles noves del sistema 0-10 convivint amb les antigues (Passos
2/2b, 3 i 4). Des dels **Passos A-D (27-28/07/2026)**, qui decideix quin dels dos jocs de
pantalles veuen els socis és un **commutador al panell d'admin** (pestanya *Puntuació*), amb
efecte immediat i marxa enrere d'un clic: el tall ha deixat de ser una edició de codi amb
desplegament. Les pantalles noves han adoptat els noms de sempre, així que el soci no aprendrà
cap nom nou. Detall tècnic i decisions a `ANALISI_Fase3_Puntuacio.md` §7; qui veu cada
pantalla, a `docs/PANTALLES.md`.

### Treball transversal — autenticació, navegació i seguretat

Fora de la numeració de fases. Anàlisi completa a `ANALISI_Login_Navegacio.md`.

| Bloc | Estat |
|---|---|
| **Autenticació** — migració a Supabase Auth | 🔄 Passos 1, 2, 3a-3c i 4a-4c fets, verificats als dos entorns i desplegats, més el **Reset de contrasenya de l'admin** (28/07, contrasenya temporal en lloc de buida — `ANALISI_Login_Navegacio.md` §1.5). Falta **4d** (retirar el sistema antic), bloquejat per una comprovació prèvia a Zampa |
| **Navegació** — refresc i botó enrere | ✅ Fet i verificat (02/08/2026). Routing per `hash` (`js/core/navigation.js`): refrescar es queda al mateix panell i el botó enrere navega per dins l'app. Detall a `ANALISI_Login_Navegacio.md`, secció Navegació |
| **Seguretat** — filtre d'alta (cens de socis FEM) | ✅ Fet i verificat als **dos entorns** (02/08/2026) |

El que ha canviat per als socis amb la migració d'Auth: la sessió es manté oberta fins que es
prem "Sortir", i qui no pot entrar se'n surt sol per correu (contrasenya nova o enllaç màgic)
sense dependre de l'administrador.

**Filtre d'alta (02/08/2026):** cap email pot crear-se un compte si no és al cens
`socis_fem_autoritzats` (taula nova, admin-only per RLS, independent de `users` — compartida
amb Zampa i amb un significat de fila que el cens hauria trencat). `fem_register_account()` ho
comprova abans de crear res i, si l'email hi és, en pren també el rol amb què es crea el
compte (ja no sempre `participant`: es pot pre-autoritzar un Expert). Gestió d'altes, baixes i
canvi de rol del cens des d'una subpestanya nova a Admin → Socis → **Socis FEM**, sense RPC
pròpia (la mateixa RLS n'hi ha prou, com ja passa a Reptes/Fotos). De pas, arreglats els
desplegables de rol (aquí i a la gestió d'usuaris existent) que es pintaven amb fons blanc del
sistema en lloc del fosc de la resta de l'app. Decisió (taula a part vs. columna a `users`),
detall tècnic i verificació a `ANALISI_Login_Navegacio.md` §1.6. Migració aplicada als **dos
entorns** (02/08/2026, vegeu `sql/README.md`). Pendent: carregar-hi els socis de la FEM encara
no usuaris de l'app quan Enric passi la llista.

## 7. Què queda pendent de decidir

**El tall de Fase 3** (§7 de `ANALISI_Fase3_Puntuacio.md`, llista a `docs/TALLS.md`): **quan**
es prem el commutador. La pregunta que hi havia lligada —què es fa amb els reptes amb la
votació oberta aquell dia— **ja no bloqueja**: els dos sistemes escriuen les mateixes dades i
un repte a mig votar surt bé de totes dues maneres. Queda com a preferència fer-ho entre la
pujada i l'inici de la votació. Els Passos A-D ja són **desplegats** des del 28/07/2026, així
que no falta res tècnic: només decidir el dia.

**La navegació**: si es fa per a totes les pantalles de cop o primer només les de participant.

**Criteri ja fixat i que no cal tornar a discutir**: cada pantalla afectada pel canvi de
puntuació es construeix **nova, en paral·lel**, sense tocar l'original; les que el canvi no
afecta (la Galeria) no es dupliquen; i al tall les antigues **no s'esborren**, només queden
ocultes, per si mai calgués tornar enrere.

## 8. Backlog de petits ajustos

Coses menors, sense data, que no justifiquen una fase pròpia:

- **Galeria**: si qui mira és admin, oferir un botó per descarregar les imatges que hi hagi
  en pantalla segons els filtres aplicats.
- **`fem_admin_create_member` i `fem_admin_set_password`**: afegir-hi `REVOKE EXECUTE ... FROM
  **PUBLIC, anon**`. No hi ha cap forat (totes dues es comproven internament), però trenquen el
  criteri de doble barrera que sí segueixen les funcions més noves. ⚠️ `FROM anon` tot sol **no
  funciona** —el permís els ve del `GRANT` a `PUBLIC` que rep tota funció nova, comprovat el
  28/07/2026— i cal verificar-ho amb `has_function_privilege()`. Vegeu `docs/REFERENCIA_BD.md`.
- **Neteja de BD, sense pressa**: eliminar les taules mortes `reptes_calendari` i `settings`, i
  valorar el renombrat `objectives` → `reptes`. ⚠️ El renombrat obliga a reescriure a mà
  `fem_apply_calendar()` (té els noms de taula escrits com a text) i a tocar 2 línies de
  l'antiga FEM-Resultats si encara existeix.
- **Restes de la compactació del panell d'admin** (detectades el 29/07/2026 provant el bloc 2 de
  la Fase 4; cap d'elles fa mal, totes enganyen qui llegeixi el codi):
  - El contenidor `admin-tab-ranking` (i tot el que hi pintava: `renderRanking()`,
    `computeCurrentRanking()`, `computeGeneralRanking()`, `getDisplayName()`) **ja no hi és** —
    esborrat el 31/07/2026, vegeu `docs/PROVES_Fase4.md`. **Encara pendent**: `admin-tab-voting`
    (`admin-upload-section`, `admin-voting-grid`, `btn-save-admin-votes`), que segueix a
    `index.html` sense entrada al sidebar, i la barra antiga de 6 pestanyes (`display:none`).
  - Els quatre `force_hide_*` **ja no tenen cap control a la interfície**; el codi que els llegeix
    sí que hi és. Avui només es poden canviar per SQL, i tots quatre són `false` a les dues bases.
  - `getButtonVisibility()` calcula un `showUpload` que ningú no fa servir.
  - `window.showAdminScreen` no comprova el rol: des de la consola del navegador se'n pot pintar
    la carcassa. No exposa dades ni deixa escriure (RLS + `fem_is_admin()`), però convindria
    posar-hi la mateixa comprovació que ja té `toggleAdminParticipantView()`.
- **Durant la votació, el soci perd de vista el repte** (detectat el 30/07/2026 provant el punt 3.5
  de la Fase 4). Quan la votació és oberta, `updateUploadSection()` amaga **tota** la targeta
  «Repte + La meva foto» i la substitueix per la de «Votar el repte». Com que la capçalera del
  repte (`#objective-header`) viu a dins, amb la votació oberta desapareixen alhora la **imatge de
  portada**, la **descripció** del repte i els **rangs de dates**. És el disseny volgut de la
  substitució, no un defecte, però val la pena decidir si la targeta de votació hauria de portar
  almenys la portada de fons —avui mostra el mosaic de fotos— o el nom del repte amb la seva
  descripció.
- **Interpunt de "Cancel·lar"**: es veu malament amb la font condensada dels botons (Barlow
  Condensed). Confirmat que el caràcter és correcte i que és un problema de renderització de la
  font. Sense pedaç net trobat; acceptat com a menor.
- ~~**Panell de Socis, tres punts detectats per Enric provant el bloc 9 de la Fase 4**~~ — **FET el
  02/08/2026**, condició del Tall 2 ja complerta (vegeu `docs/TALLS.md`, Tall 2 → Abans):
  - El badge de rol ara és un desplegable de 3 opcions (Participant/Soci, Expert, Administrador)
    directament a la taula, `changeRole()` (`js/features/socis.js`) — reemplaça l'antic
    `toggleRole()`, que només alternava Admin↔Soci i amagava Expert al modal d'edició. Desactivat
    per a la pròpia fila (no es pot canviar el rol propi).
  - **Gestió del rol Zampa**: nova columna "Zampa" amb desplegable de les 3 opcions que accepta
    realment Zampa (`admin`/`editor`/`user` — investigat el codi de `FEM-Zampa`), `changeZampaRole()`.
    ⚠️ Matís important, que Enric ja sap: les RLS de Zampa són totes `USING(true)` — `zampa_role`
    només és un permís d'interfície dins de Zampa mateix, no s'aplica per RLS enlloc (ni allà ni
    aquí). Canviar-lo des de FEM-Foto és tan real com ja ho era des de Zampa.
  - **"Foto pujada" / "Ha Votat"**: **eliminades** (decisió d'Enric, no calia substituir-les per
    cap comptador). De rebot, `hasUserVoted()` (`core/data.js`) ha quedat sense cap ús i s'ha
    esborrat.
  Verificat en local (Test): les 3 columnes noves persisteixen a `public.users` (comprovat per
  SQL), la fila pròpia queda desactivada, i CA↔ES repinten bé sense clau crua. Trobada i corregida
  de pas una incidència menor: `edit_role_tooltip` tenia un valor vell a `app_texts` ("Clica per
  canviar rol", d'quan el control era un clic, no un desplegable) que guanyava al nou text del
  codi — actualitzat a Test als dos idiomes.

## 9. Riscos vius

- **`users` és compartida amb l'app Zampa** del club. Qualsevol operació en cascada sobre
  aquesta taula hi esborraria dades. Comprovar-ho sempre. Va materialitzar-se un cop (un soci
  amb dos comptes, sortia duplicat a la Classificació General; resolt el 25/07/2026), i n'hi ha
  un segon cas conegut i deixat estar a propòsit perquè avui és inofensiu.
- **Doble manteniment mentre duri la convivència**: qualsevol canvi urgent a l'app antiga s'ha
  de replicar aquí a mà. Convé no allargar aquesta fase.
- **Les dues apps escriuen al mateix Supabase de producció** mentre convisquin.

  > ⚠️ **Aquest risc ja s'ha materialitzat (28/07/2026), i va deixar l'app antiga caiguda dos
  > dies.** L'enduriment d'autenticació fet aquí va trencar FEM-Reptes per partida doble: (a) el
  > `REVOKE SELECT` sobre `users.password` (26/07) feia fallar la seva càrrega sencera amb
  > `permission denied for table users` — l'app es quedava sense dades i oferia "Primera
  > configuració"; i (b) les RLS d'escriptura basades en `auth.uid()` (27/07) haurien impedit
  > votar i pujar fotos encara que la càrrega s'hagués arreglat, perquè l'app antiga no tenia cap
  > sessió de Supabase Auth. Resolt portant-hi el login per Auth (mateixes RPC, cap canvi de BD).
  > **Cap dels dos problemes es va veure fins que un soci ho va reportar.** Mentre FEM-Reptes
  > visqui, qualsevol canvi d'esquema, de permisos o de RLS s'ha de comprovar **també** contra
  > ella — el Pas 4d (buidar `users.password`) és el pròxim candidat clar.
- **El tall de domini** (Fase 6) és el moment més sensible del projecte: franja de baix ús i
  pla de reversió del DNS a mà. Vegeu `docs/TALLS.md`.

---

*Documents relacionats: `CLAUDE.md` (regles i entrada), `ANALISI_Fase3_Puntuacio.md`,
`ANALISI_Login_Navegacio.md`, `docs/REFERENCIA_BD.md`, `docs/PANTALLES.md`, `docs/TALLS.md`,
`sql/README.md`. Documents tancats a `docs/arxiu/`.*
