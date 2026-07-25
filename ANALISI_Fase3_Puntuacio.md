# FEM-Foto — Anàlisi Fase 3: nou sistema de puntuació (3 criteris 0-5 → 1 concepte "Valoració" 0-10)

> Document d'anàlisi previ a qualsevol modificació. Objectiu: mapejar tots els punts del
> codi/BD afectats i llistar les decisions obertes que cal tancar amb Pablo/Enric abans
> d'escriure una sola línia. **Cap fitxer de codi s'ha tocat per fer aquest document.**

## 0. Resum de l'encàrrec

- Els vots passen de **3 conceptes (Creativitat/Temàtica/Composició, 0-5 cadascun)** a
  **1 concepte ("Valoració", 0-10)**.
- Les estrelletes de captura desapareixen; cal un control nou igual d'atractiu i usable.
- La BD ha d'acollir el nou camp **sense eliminar els 3 antics** durant un període de
  prova/convivència.
- Els rànquings de reptes **ja finalitzats** s'han de re-puntuar: normalitzar l'antiga nota
  (avui 0-5, vegeu §3.1 — el "0-15" de l'encàrrec és la suma dels 3 criteris, matemàticament
  equivalent) a 0-10 amb arrodoniment enter, i bolcar-ho al nou camp.

## 1. Abast real: més ampli del que sembla a primer cop d'ull

L'encàrrec parla de "pantalles de captura" + "BD" + "re-puntuar rànquings tancats". Però el
canvi de 3 criteris → 1 travessa **quatre capes independents** que cal tocar totes:

1. **Captura del vot** (`votacio.js` + CSS `.star`/`.vote-stars`) — 3 files d'estrelles per foto.
2. **Motor de càlcul** (`ranking.js`) — TOTA la lògica de puntuació parteix avui de
   `creativity`/`theme`/`composition`; no hi ha un sol punt d'entrada que es pugui canviar
   aïlladament.
3. **Pantalles de resultats** (natives, Fase 2 d'aquesta mateixa conversa) — tant "Resultat
   Repte" com la cortina de puntuació del lightbox mostren **els 3 criteris per separat**,
   no només el total. Amb 1 sol concepte, aquest desglossament deixa de tenir sentit i cal
   redissenyar-lo (no és un simple canvi de fórmula per sota).
4. **Pestanya "Ranking" de l'admin** (`admin-tab-ranking`, llegada, encara activa) — usa el
   mateix motor de càlcul; qualsevol canvi a `ranking.js` l'afecta automàticament.

## 2. Inventari de punts de codi afectats

### 2.1 Captura del vot
- `js/features/votacio.js:164-174` — `starRow(criteria, label)`: genera 5 `<span class="star">`
  per criteri, 3 crides (`creativity`/`theme`/`composition`) a `votacio.js:185`.
- `js/features/votacio.js:20-44` (`setVoteCriteria`), `58-110` (`saveVoteOnClick`, upsert a
  `votes` amb els 3 camps), `193-239` (`handleStar`) — tota la lògica d'autosave treballa
  criterion-per-criterion.
- `css/base.css:678-696` (`.vote-stars`, `.star`, `.star.flash`) + `css/base.css:1040-1043`
  (responsive) + `css/participant.css:306-310` (`.vote-criteria-label`).
- `js/core/i18n.js:43-44,411-412` — claus `creativity`/`theme`/`composition`.

### 2.2 Motor de càlcul (`js/features/ranking.js`) — el nucli real del canvi
- `getPhotoScoreBreakdown(photoId, scope)` (línia 82) — calcula `creativity`/`theme`/
  `composition` (mitjana per criteri) i `final = (creativity+theme+composition)/3`. **Avui
  `final` és 0-5, no 0-15** (veure §3.1). Aquesta és LA funció font de veritat; tot el
  rànquing en depèn directament o indirecta.
- `getPhotoScore(photoId)` (130) — wrapper que només agafa `.final`.
- `computeRankingForObjective(objId, scope)` (144) — mapeja `getPhotoScoreBreakdown` per
  totes les fotos d'un repte.
- `_rankingForObjectiveScoped(objId, scope)` (152) i `getPhotoResultsBreakdown(photoId)`
  (183) — generen els 3 blocs Expert/Socis/Tots per a la cortina del lightbox, **cadascun
  amb els 3 criteris per separat**.
- `computeCurrentRanking()` (271), `computeGeneralRanking()` (279, llegat admin),
  `computeGeneralRankingLive()` (281, natiu Fase 2.2) — tots criden, directa o
  indirectament, `getPhotoScore`/`getPhotoScoreBreakdown`.
- `assignPositionPoints()`/`getPointsForPosition()`/`POSITION_POINTS` (10-45) — **NO
  depenen del rang de la nota**, només de la POSICIÓ relativa dins del repte (1r, 2n...).
  Això és una bona notícia: la taula de punts (25,18,15...) de la Classificació General
  **no cal tocar-la**.
- `formatScore()` (48) — `.toFixed(2)` amb coma catalana; vàlid per qualsevol rang, només
  cal decidir si seguim mostrant 2 decimals amb el nou 0-10.
- `renderResultatsRepte()` (222) — pinta els 3 criteris per foto (`rank-criteria`, línies
  250-252). **Aquesta vista necessita redisseny, no només nova fórmula.**

### 2.3 Cortina de puntuació del lightbox (`js/ui/lightbox.js:8-52`)
- `_miniStarsHtml(score)` (33-36) — `score/5*100%`, assumeix explícitament el 0-5. Trencarà
  amb un 0-10 si no es toca el divisor (o es descarta el mini-estel per un altre indicador).
- Bloc `score-crit-row` × 3 (46-48) — una fila per `creativity`/`composition`/`theme` dins
  de cadascun dels 3 blocs Expert/Socis/Tots. Amb 1 sol concepte, **cada bloc passa a tenir
  1 sola fila** (la Valoració), no 3 — canvi de disseny, no només de dades.
- CSS relacionat: `css/base.css:1304-1310` (`.score-crit-row`, `.mini-stars`).

### 2.4 Base de dades
- Taula `votes` (columnes conegudes via `data.js:64`: `id,user_id,photo_id,objective_id,
  creativity,theme,composition` + `created_at`). No hi ha migració SQL trackejada per
  aquesta taula a `sql/` (deu ser anterior a l'inici del tracking de migracions d'aquest
  repo) — **abans de tocar-la cal mirar l'esquema real a Supabase**, no assumir només pel
  codi client.
- `js/core/data.js:64,150-159` — `SELECT` i mapeig de `state.votes`.
- `js/core/state.js:47` — comentari de forma de l'objecte vot en memòria.
- Cap altra taula sembla dependre directament de `creativity`/`theme`/`composition`
  (`objectives`, `photo_submissions`, `seguiment_votacio` són independents de l'esquema de
  puntuació).

### 2.5 Pestanya "Ranking" de l'admin (llegat, `index.html:253-277`, `admin-tab-ranking`)
- Encara activa i enllaçada des de la barra de l'admin (`index.html:167`). Usa
  `computeGeneralRanking()`/`renderRanking()` i, indirectament via `tematiques.js:142-144`
  (`finalizeObjective`), `getPhotoScore`/`assignPositionPoints`. **Es veurà afectada
  automàticament** per qualsevol canvi al motor de càlcul, encara que ningú l'esmenti
  explícitament a l'encàrrec.

## 3. Punts a aclarir abans de dissenyar la implementació

### 3.1 Confirmar la fórmula real (per no arrossegar un malentès)
Avui `getPhotoScoreBreakdown().final = (creativity + theme + composition) / 3`, on cada
criteri ja és una mitjana 0-5 entre votants → **`final` és 0-5, no 0-15**. L'encàrrec parla
de "0-15 (suma dels 3 màxims)". Són **matemàticament equivalents** per a la normalització
(`valoracio = round(final_0a5 × 2) == round(suma_0a15 × 2/3)`), però val la pena confirmar-ho
explícitament perquè no hi hagi un desajust de fórmula més endavant.

### 3.2 Granularitat del "backfill" dels reptes tancats — la decisió més important
L'encàrrec diu "re-puntuar els rànquings ja tancats" (parla del resultat agregat), però
també "suposo que caldrà tocar la taula Votes" (parla de files individuals). Són dues
estratègies diferents amb implicacions arquitectòniques:

- **Opció A — Normalitzar cada VOT històric individual** (`UPDATE votes SET valoracio =
  round((creativity+theme+composition) * 2.0/3) WHERE ...`, per a tots els vots antics, no
  només dels reptes tancats). Avantatge: el motor de càlcul queda **uniforme** —
  `getPhotoScoreBreakdown` sempre fa `avg(valoracio)` sense necessitat de saber si un repte
  és "antic" o "nou". Encaixa amb la Fase 2.2 (Classificació General i Resultat Repte ja
  recalculen en viu a partir de `votes`, no d'un valor congelat) — si no es fa aquest
  backfill per vot, aquestes dues pantalles natives deixarien de poder mostrar correctament
  els reptes finalitzats abans del canvi.
- **Opció B — Normalitzar només l'agregat final per foto dels reptes ja tancats** (el que
  literalment descriu l'encàrrec). Més fidel al redactat, però **incompatible amb com
  funciona avui el recàlcul en viu** (Fase 2.2): caldria tornar a servir un valor congelat
  per als reptes antics (com feia `state.generalRanking` abans de la Fase 2.2) i mantenir
  una branca de codi diferent segons si el repte és "pre-canvi" o "post-canvi" — més
  complexitat de manteniment a llarg termini.

**Recomanació**: Opció A (backfill per vot individual), per coherència amb l'arquitectura ja
decidida a la Fase 2.2. Nota matemàtica: arrodonir vot-a-vot i després fer mitjana **no és
idènticament igual** a fer mitjana i arrodonir un sol cop al final (poden sortir diferències
d'una fracció de punt en empats molt ajustats) — a la pràctica hauria de ser inapreciable,
però cal que ho sapigueu abans de triar.

### 3.3 Reptes actius durant el canvi (tall en calent)
Què passa amb un repte que està **en votació activa** el dia que es desplega el canvi?
- Si es tallen les estrelles i s'activa el control nou a mig repte, els vots ja emesos amb
  el sistema antic per aquell repte concret també necessiten normalitzar-se (mateixa
  fórmula del backfill) perquè convisquin amb els vots nous del mateix repte.
- Alternativa més senzilla: **desplegar el canvi només quan no hi hagi cap repte amb
  votació oberta** (finestra de manteniment), evitant barrejar sistemes dins un mateix
  repte. Requereix triar el moment del desplegament amb cura.

Cal decidir quina d'aquestes dues vies (o una altra) es vol seguir.

### 3.4 Com distingir "sistema antic" vs "sistema nou" si NO es fa backfill universal
Si s'acaba triant l'Opció B (o una via mixta), cal un marcador durador de quin sistema es va
fer servir — per exemple una columna a `objectives` (`scoring_version`) fixada en finalitzar,
o inferir-ho implícitament segons si `votes.valoracio` és `NULL` o no per aquell repte. Si es
va per l'Opció A (backfill universal), aquest problema desapareix del tot.

### 3.5 Disseny del nou control de captura (0-10)
L'encàrrec demana "un mètode igualment atractiu i d'ús" per substituir les estrelles.
Consideracions pràctiques (el perfil d'usuari mitjà de l'app té ~65 anys, vegeu la
preferència ja expressada a la Fase 2 per mides grans i llegibles):
- Un control de precisió fina (slider continu) pot ser difícil d'encertar amb el dit en
  mòbil per aquest perfil d'usuari — recomanable que "encaixi" (`snap`) a enters.
- Opcions a valorar (a decidir amb Pablo, no és una decisió tècnica unilateral):
  - **Slider amb "snap" a enters 0-10** + número gran sempre visible damunt (bona relació
    compacitat/precisió, un sol gest).
  - **Graella de botons grans 0-10** (11 tocs, potser 2 files de 6/5) — zero ambigüitat,
    però ocupa més espai vertical per foto i amb moltes fotos a votar pot fer la pantalla
    de votació molt llarga.
  - **Estels/icones amb mig-punt** (5 icones que valen "2 punts" cadascuna, amb tap=parell,
    doble-tap o zona esquerra/dreta=imparell) — manté l'estètica d'estrelles que ja
    coneixen, però afegeix un gest menys evident (pitjor per a usuaris grans, en contra del
    que es busca).
- Sigui quina sigui l'opció, cal el mateix tractament d'autosave-per-clic que ja existeix
  (`saveVoteOnClick`), adaptat a un sol camp en lloc de 3.

### 3.6 Redisseny de les pantalles de resultat (no és opcional, és conseqüència directa)
- Cortina de puntuació del lightbox (§2.3): passa de 3 files de criteri a 1 fila de
  Valoració per bloc (Expert/Socis/Tots) — disseny més simple, però és un canvi de
  plantilla, no només de dades.
- `renderResultatsRepte()` (§2.2): la línia `rank-criteria` amb Creativitat/Composició/
  Temàtica desapareix; només queda la nota total.
- Caldrà decidir si es manté el disparador ⭐ + cortina tal qual (amb 1 sola fila) o si,
  ja que només queda un número, val la pena simplificar-ho encara més (mostrar la Valoració
  directament sense necessitat d'obrir cap cortina).

### 3.7 Coses que NO calen tocar (per acotar l'abast, no donar-ho per fet sense dir-ho)
- `assignPositionPoints`/`getPointsForPosition`/`POSITION_POINTS` (Classificació General):
  depenen de la posició relativa, no del rang de la nota.
- `objectiveHasExpertVoting`/`objectiveHasVotesForScope`/filtre Tots-Socis-Expert (Fase 2):
  depenen de QUI vota, no de QUÈ es vota — no els afecta el canvi d'escala.
- `seguiment_votacio` (enviament definitiu del vot) — independent de l'esquema de puntuació.
- Cloudinary, calendari, multi-repte (Fase 1) — sense relació.

## 4. Pla per passos (acordat 2026-07-24) — fer-ho incremental, no d'un cop

Enric proposa no fer el canvi d'un sol cop, sinó pas a pas: primer preparar la BD sense
tocar cap comportament, i analitzar cada pas següent quan arribi el moment. Redueix el risc
(cada pas és petit i reversible) encara que l'impacte final total sigui el mateix (§1).

### Pas 1 — Camp `valoracio` a `votes` ✅ FET (aplicat i verificat a Test i Normal, 2026-07-24)
**Fitxer**: `sql/2026-07-24_fase3_valoracio_pas1.sql` (NO aplicat encara — cal que Enric
l'executi manualment a Supabase Test primer, després Normal, seguint la convenció ja
establerta al projecte, ADR-015).

**Decisió de disseny — trigger, no columna `GENERATED ALWAYS AS`**: Postgres permet una
columna calculada nativa (`GENERATED ALWAYS AS (...) STORED`), que semblava l'opció més
òbvia. **Es descarta conscientment** per un motiu concret: una columna `GENERATED` **no es
pot escriure mai directament** (ni amb `INSERT`/`UPDATE` explícit) — quan en un pas futur
(captura nova, encara no arribem aquí) l'app vulgui escriure `valoracio` directament des
d'un vot nou de 0-10, la columna generada ho bloquejaria i caldria eliminar-la i recrear-la
com a columna normal. Per evitar aquest trencament més endavant, es fa servir en canvi:
- Una columna normal (`integer`, nul·lable, `CHECK (0-10)`).
- Un **trigger** (`BEFORE INSERT OR UPDATE OF creativity, theme, composition`) que
  recalcula `valoracio` automàticament — visible i transparent, però **no és una restricció
  de BD que bloquegi escriptures futures**: el dia que calgui, el trigger es pot eliminar o
  modificar sense tocar l'esquema de la columna.
- Un `UPDATE` de backfill (un sol cop) per als vots que ja existeixen abans de crear el
  trigger (el trigger només actua sobre inserts/updates futurs).

**Resultat pràctic**: zero canvis de codi d'aplicaciò en aquest pas (`votacio.js`,
`ranking.js`, `data.js` queden intactes) — tal com demanaves, "tot seguirà funcionant igual
com fins ara". `valoracio` queda disponible i sempre sincronitzat per quan calgui fer-hi
càlculs (Pas 2/3).

**Nuance a validar** (no bloqueja, però cal que ho sàpigues): un criteri sense valorar es
guarda avui com a `0` (no `NULL`) — `votacio.js:29-31` inicialitza `creativity/theme/
composition` a `0` i un vot es pot enviar tenint només 1 o 2 dels 3 criteris puntuats (no
es bloqueja l'enviament, `submitFinalVoting` només avisa si CAP dels 3 té estrelles). La
fórmula del backfill tracta aquest `0` igual que un "valorat amb 0" — exactament el mateix
criteri que ja fa avui `avgCriterion()` a `ranking.js:109-114` (compta el votant al
denominador encara que el criteri concret estigui a 0). És a dir: **mantenim el mateix
criteri ambigu que ja existia, no n'introduïm cap de nou** — es documenta perquè quedi clar,
no perquè calgui resoldre'l ara.

**Fet i verificat (2026-07-24)**: aplicat a Test (969/969 vots, 0 inconsistències) i a Normal
(1059/1059 vots, 0 inconsistències), trigger comprovat en calent a Test. Pas 1 tancat.

### Pas 2 — Càlcul de resultats de repte (a analitzar quan es tanqui el Pas 1)
Toca `getPhotoScoreBreakdown()`/`computeRankingForObjective()` (ranking.js) — passar de
`(creativity+theme+composition)/3` a llegir `valoracio` directament. Pendent d'anàlisi
detallada fins que el Pas 1 estigui validat.

### Pas 3 — Assignació de punts per a la Classificació General (a analitzar després del Pas 2)
`assignPositionPoints`/`getPointsForPosition` (§3.7) ja s'ha comprovat que **no depenen del
rang de la nota** — probablement aquest pas sigui trivial o gairebé nul, però es confirmarà
quan hi arribem.

### Passos pendents de calendaritzar (fora d'aquesta conversa per ara)
- Captura del vot (nou control 0-10, substitueix les estrelles) — §3.5.
- Redisseny de les pantalles de resultat (cortina del lightbox, Resultat Repte) — §3.6.
- Reptes actius durant el tall (§3.3) i decisió final sobre backfill universal vs només
  reptes tancats (§3.2) — amb el Pas 1 ja hem optat, de facto, per la via "universal"
  (backfill de TOTS els vots, no només els de reptes finalitzats), perquè el trigger no
  distingeix per estat de repte.

## 5. Preguntes concretes per a la propera conversa (abans de tocar codi)

1. Confirmes la fórmula d'equivalència 0-5 → 0-10 del §3.1 (×2, arrodonit)?
2. Opció A o B del backfill (§3.2) — normalitzar cada vot històric individual, o només
   l'agregat dels reptes ja tancats?
3. Com es gestionen els reptes amb votació **oberta** el dia del desplegament (§3.3):
   finestra de manteniment sense reptes actius, o normalització també dels vots parcials
   d'un repte en curs?
4. Si es descarta l'Opció A universal: quin marcador decidim per diferenciar repte
   antic/nou (§3.4)?
5. Quin dels tres formats de control de captura (§3.5) — o un altre — prefereixes per a
   l'usuari de ~65 anys?
6. La cortina de puntuació del lightbox i "Resultat Repte" (§3.6): es manté la mateixa
   interacció (disparador ⭐ + panell) només amb 1 fila, o es simplifica encara més?
7. Es manté el nom de columna `valoracio` a `votes`, o preferiu un altre nom?
