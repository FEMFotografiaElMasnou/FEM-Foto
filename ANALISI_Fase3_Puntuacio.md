# FEM-Foto — Fase 3: nou sistema de puntuació (3 criteris 0-5 → 1 concepte 0-10)

> **Com es llegeix aquest document.** Té tres nivells, i probablement només necessites el
> primer:
>
> - **§A Estat actual** — què és veritat avui. Una pantalla.
> - **§B Decisions vives** — el que no s'ha de tornar a discutir, i per què.
> - **§0-§6, la resta** — el **registre cronològic**: l'anàlisi inicial, les opcions
>   valorades i cada pas amb les seves proves, iteracions visuals i bugs trobats pel camí.
>   **No cal llegir-lo per treballar al projecte.**

---

## §A Estat actual (27/07/2026)

El club va decidir (reunió de socis del 23/07/2026) passar de votar **3 criteris**
(Creativitat/Temàtica/Composició, 0-5 cadascun) a **1 sol concepte, 0-10**.

| Pas | Estat |
|---|---|
| Pas 1 · columna `votes.valoracio` + trigger des dels 3 criteris antics | ✅ |
| Pas 1b · corregida la pèrdua de decimals (`numeric(4,2)`) | ✅ |
| Pas 2 · pantalla «Valoració Repte» (resultats, només lectura) | ✅ |
| Pas 2b · panell de puntuació propi al visor de fotos | ✅ |
| Pas 3 · pantalla «Taula de Classificació» | ✅ |
| Pas 4 · pantalla «Puntuar Repte» (captura 0-10) | ✅ |
| **El tall** · fer visible el sistema nou per a tothom | ⬜ **Pendent, sense data** |

Les tres pantalles noves conviuen amb les antigues i **només les veu l'admin** («Puntuar
Repte», a més, en mode Test). Inventari i regles de visibilitat: `docs/PANTALLES.md`.
Llista de comprovació del tall: `docs/TALLS.md`.

**Verificat**: «Taula de Classificació» dona exactament els mateixos punts i posicions que la
«Classificació General» actual — el resultat matemàticament esperat, perquè l'assignació de
punts per posició només fa servir la nota per detectar empats, mai la seva magnitud.

**Encara per decidir**: què es fa amb els reptes que tinguin la **votació oberta** el dia del
tall (§3.3).

---

## §B Decisions vives

**Els 3 criteris antics no s'esborren mai.** `valoracio` es deriva d'ells amb un trigger
(×10/15); les dades històriques queden intactes i qualsevol pantalla antiga segueix funcionant.

**Conseqüència pràctica que fa mal si s'oblida**: el trigger `fem_sync_valoracio()` recalcula
`valoracio` a cada escriptura que toqui els 3 criteris. Qui vulgui escriure `valoracio` ha
d'escriure **també** els tres criteris amb `valoracio/2` cadascun (no `/3`: el factor ×10/15
del trigger exigeix exactament `/2` per a un round-trip exacte). Si no, el trigger el trepitja
a 0.

**Cada pantalla afectada es construeix nova, en paral·lel, sense tocar l'original.** Les que el
canvi de puntuació no afecta (la Galeria) no es dupliquen ni es toquen.

**Al tall, les pantalles antigues no s'esborren**: només queden ocultes, amb el mateix
mecanisme que avui amaga les noves. És la xarxa de seguretat per si mai calgués tornar enrere.
«Resultat Repte» i la seva cortina de 3 criteris no es redissenyaran mai: es deixaran
intactes i ocultes.

**«Puntuar Repte» es gateja diferent de les altres dues** (admin real **o** mode Test, no
només admin) perquè és una eina de captura que cal poder provar amb usuaris no admin. El
criteri general: pantalla de només lectura → gate per rol; pantalla que escriu i s'ha de provar
amb diversos comptes → gate per mode de BD.

**Els estats bloquejats no atenuen mai el valor triat**, només les alternatives. Un "ja has
votat" que enfosqueix la pròpia resposta és el contrari del que ha de comunicar.

---

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

### Pas 1b — Correcció de precisió (2026-07-25)
**Bug detectat per Enric** comparant la pantalla amb un càlcul manual en full de càlcul
(repte "Dominant verda", 1 sol votant): la "Valoració" mostrada no tenia mai decimals, quan
la normalització 15→10 hauria de generar-ne gairebé sempre. Diagnòstic final (dues capes,
totes dues arrodonien/truncaven a enter):
- **BD**: `votes.valoracio` es va crear com a `integer` al Pas 1, i tant el backfill com el
  trigger `fem_sync_valoracio()` feien `round(...)::int`, descartant els decimals.
- **Client**: `js/core/data.js` llegia `creativity`/`theme`/`composition`/`valoracio` amb
  `parseInt(...)`, truncant-los de nou encara que la BD els enviés bé. Això afectava també
  `getPhotoScoreBreakdown()` i per tant **"Resultat Repte" (Fase 2, ja publicada)** per als
  reptes amb notes decimals reals (els que es van haver d'informar amb una sola nota
  consolidada per foto, "Dominant verda"/"Dominant vermell" — vegeu incidència §"Errors i
  fixes" de la conversa).

**Fix aplicat**:
- `sql/2026-07-25_fase3_valoracio_pas1b_decimals.sql`: `votes.valoracio` passa de `integer`
  a `numeric(4,2)`; backfill refet sense arrodonir a enter (només a 2 decimals); trigger
  `fem_sync_valoracio()` actualitzat igual. Aplicat i verificat a Test i Normal — valors
  coincidents al detall amb el càlcul manual de referència (ex.: creativity 4,1 + theme 4 +
  composition 4,02 → valoracio 8,08, exacte).
- `js/core/data.js`: els 4 camps passen de `parseInt` a `parseFloat`.

Matemàticament, mitjana-de-`valoracio`-per-vot i "mitjana-per-criteri, després normalitzar"
són equivalents (linealitat de la mitjana) — el problema mai va ser la fórmula, sempre la
pèrdua de decimals en dos punts diferents. Pas 1b tancat.

### Pas 2 — Pantalla "Valoració Repte" (FET, 2026-07-25)
En lloc de tocar `getPhotoScoreBreakdown()`/`computeRankingForObjective()` (que seguirien
alimentant "Resultat Repte", intocat), es va optar per una **pantalla nova en paral·lel**
(decisió d'Enric, per poder comparar side-by-side sense arriscar l'existent):
- `getPhotoValoracio(photoId, scope)` i `computeValoracioRankingForObjective(objId, scope)`
  (ranking.js) — mateix `_photoPoolForObjective`/`_submittedUserIdsForScope` que Resultat
  Repte (mateix pool de fotos i mateix denominador per scope), però la nota surt de
  `votes.valoracio` en lloc de la mitjana dels 3 criteris.
- `renderValoracioRepte()` — mateixa targeta `.photo-card` que Resultat Repte, sense el bloc
  de 3 criteris (ja no n'hi ha), amb una **barra de progrés 0–10** (no estrelles: 5 estrelles
  fixes queda forçat per a una escala de 10 punts) i, sota el nom de l'autor, el títol de la
  foto si n'hi ha.
- Posicions amb la mateixa regla "generosa" de dense-ranking que la resta de l'app (empats
  comparteixen posició).
- Accés: nova entrada "Valoració Repte" a la pantalla d'inici del participant, **visible
  només amb rol admin real** (no amb `actingAsAdmin()` — un admin només arriba a la pantalla
  d'inici en mode "veure com a participant", on `actingAsAdmin()` és fals a propòsit).
- De pas, es va arreglar una col·lisió de noms CSS (`.star` definida tant a `base.css`,
  per a les estrelles clicables de votació, com a `participant.css`, per a les de només
  lectura de Resultats) que filtrava propietats d'una a l'altra — ara `.stars .star` té
  àmbit propi.

Pas 2 tancat.

### Pas 2b — Redisseny del panell de puntuació del lightbox a "Valoració Repte" (FET, 2026-07-25)
Responent la pregunta oberta del §3.6/§5.6: **no es toca "Resultat Repte"** (queda amb
la seva estrella ⭐ i cortina completa de 3 criteris, intacte); es construeix un
disparador i panell **independents** només per a "Valoració Repte".

**Problema detectat abans de dissenyar la solució**: `renderResultatsRepte()` i
`renderValoracioRepte()` marcaven totes dues les fotos amb el mateix flag
`resultsMode:true`, i `lightbox.js` només sabia mostrar `getPhotoResultsBreakdown()`
(el desglossament vell de 3 criteris). Resultat: obrint una foto des de "Valoració
Repte" es veia la cortina vella (3 criteris), sense sentit amb el nou sistema d'1
concepte.

**Solució**:
- `renderValoracioRepte()` ara marca les seves fotos amb `valoracioMode:true` (no
  `resultsMode`), flag independent del de "Resultat Repte".
- Nova funció `getPhotoValoracioBreakdown(photoId)` (ranking.js) — mateixa condició
  de visibilitat que l'antiga (`objectiveHasExpertVoting`, no es mostra si el repte
  no té vot d'expert), però calcula posició+nota a partir de `valoracio`, amb un
  bloc per Total Vots / Vots Socis / Vots Experts.
- `lightbox.js` gestiona ara **dos disparadors i panells independents** en paral·lel
  (`_currentBreakdown`/`lightbox-score-trigger` per a Resultat Repte, sense tocar;
  `_currentValoracioBreakdown`/`lightbox-valoracio-trigger` nou), mai actius alhora
  per a la mateixa foto.
- Disseny final del panell nou (iterat amb captures reals, diverses rondes):
  taula d'1 sol bloc, 3 columnes amb capçalera **Votants | Puntuació | Posició**
  (la columna "Votants" és l'àmbit de la fila —Total Vots/Vots Socis/Vots Experts—
  no un recompte de persones), Puntuació en blau accent, Posició en blanc una mica
  més emfatitzada (però sense pes de lletra excessiu — la negreta forta quedava
  "empastada" a mida petita), interlineat compacte.
- Ubicació: el disparador ⓘ i el panell **no es posicionen respecte a la pantalla**
  sinó respecte a la **mida real renderitzada de la foto** (nou contenidor
  `.lightbox-img-wrap`, `position:relative`, que la imatge omple exactament) —
  així la cantonada inferior-esquerra és sempre la de la foto, sigui quina sigui
  la seva orientació, en lloc de quedar "perduda" a la cantonada de la pantalla
  (el mateix problema que ja tenia, sense revisar, l'estrella ⭐ de Resultat Repte).
  El disparador es mostra 12px per sota de la foto; en clicar, el panell s'obre
  cap amunt superposat a la base-esquerra de la foto.
- Estil final del disparador: unificat visualment amb `.lightbox-counter` (mateix
  padding/radi/mida de lletra/color blanc, vora semitransparent), però **sense el
  fons fosc del comptador** (només marc, transparent per dins).
- **Limitació coneguda, acceptada conscientment**: el disparador/panell no
  reposicionen si l'usuari fa zoom a la foto (el zoom escala visualment la imatge
  sense moure la seva caixa de layout, que és la referència de posicionament) —
  Enric ho ha vist i ha decidit no arreglar-ho, cas d'ús massa puntual.
- Fitxers tocats: `js/features/ranking.js`, `js/ui/lightbox.js`, `index.html`,
  `css/base.css`, `js/core/i18n.js` (noves claus ca/es). "Resultat Repte" no s'ha
  tocat en cap d'aquests fitxers.

Pas 2b tancat.

### Pas 3 — Assignació de punts per a la Classificació General (FET, 2026-07-25)
Confirmada la hipòtesi del §3.7: `assignPositionPoints`/`getPointsForPosition` només fan
servir la nota per detectar empats (comparació d'igualtat), mai la seva magnitud — la taula
de punts surt exclusivament de la posició. Per tant, el Pas 3 ha estat un simple canvi
d'origen de dades, no de l'algorisme.

Mateix patró que Pas 2/2b (duplicar, no refactoritzar, per poder comparar en paral·lel sense
arriscar l'existent):
- `computeValoracioGeneralRankingLive(scope)` (ranking.js) — còpia de
  `computeGeneralRankingLive()`, però alimentada per `computeValoracioRankingForObjective()`
  (nota `valoracio`) en lloc de `computeRankingForObjective()` (mitjana de 3 criteris).
- `renderTaulaClassificacio(listId, scope)` — còpia de `renderClassificacioGeneral()`, mateix
  disseny de taula/targetes, sense selector de repte (agrega tots els reptes tancats, com
  l'actual).
- Nova entrada "Taula de Classificació" a l'inici, amagada rere el mateix gate d'admin real
  que "Valoració Repte".
- **Verificat per Enric**: amb els reptes ja tancats, "Taula de Classificació" dona
  **exactament els mateixos punts i posicions** que "Classificació General" — el resultat
  esperat (vegeu la nota matemàtica del Pas 1b: `valoracio` és una transformació lineal de
  les mateixes dades de vot, i el backfill del Pas 1 va ser universal). El valor d'aquesta
  pantalla, doncs, és de comparació/validació ara mateix; el canvi real de números només
  arribarà amb vots nous capturats directament en 0-10.
- Fitxers tocats: `js/features/ranking.js`, `index.html`, `js/screens/participant.js`,
  `js/core/i18n.js` (noves claus ca/es). "Classificació General" no s'ha tocat.

Pas 3 tancat.

### Incidència de dades — usuari duplicat José Antonio Sancho Pastor (FET, 2026-07-25)
Detectat en revisar "Taula de Classificació": la taula `users` (compartida amb l'app del
club "Zampa") tenia dues files per a la mateixa persona — `u_1779390719550`
(sanchopastor@gmail.com, només 1 foto, cap altra dada) i `u_1779644516606`
(contacto@joseantoniosancho.com, el compte amb tota l'activitat real: vots emesos,
seguiment_votacio, dades de Zampa). Provocava que sortís com dues files diferents a
Classificació General. Sense relació amb la Fase 3 ni introduït per aquesta feina —
sembla que la persona es va tornar a registrar amb un altre email, oblidant que ja en
tenia un.

Solució aplicada (`sql/2026-07-25_merge_duplicate_user_sancho.sql`, només a Normal —
Test no reproduïa el problema): reassignada l'única foto del compte buit
("Dominant vermell") al compte real, i esborrada la fila `users` duplicada (verificat
prèviament que no quedava cap altra referència). Verificat: només queda un compte
"Sancho", amb les dues fotos al seu nom.

**Mateix patró detectat i deixat intacte, a petició d'Enric**, per a Harald Hausleithner
(`u_1775410565990` vs `usr_1780738611829`) — actualment inofensiu perquè el segon compte
només té dades de Zampa, cap activitat de FEM-Foto, així que no apareix a cap rànquing.
Pendent d'un possible escaneig més ampli de `users` per detectar més casos similars, no fet
encara (no demanat).

### Pas 4 — Captura del vot 0-10 (FET, 2026-07-26)
Substitueix les 3 files d'estrelles (`votacio.js` `starRow('creativity'...)` etc.) per un
control únic 0-10 a `.vote-card`. Decisions preses amb Enric abans d'escriure cap línia
de codi:

**Disseny de la targeta:**
- Mosaic (`.voting-grid`) de **2 columnes fixes** a tauleta/desktop i **1 columna** a
  mòbil (substitueix l'actual 1/2/3 per breakpoint) — prioritat: foto més gran, pensant
  en el públic ~65 anys.
- Sota la imatge: el **`caption`** de `photo_submissions` si n'hi ha (mai el número de
  participant ni l'autor — l'anonimat del vot es manté).
- Una sola fila de **10 càpsules clicables** (valors 1-10; 0 = sense vot, estat inicial,
  igual que ara amb les estrelles) + a la seva dreta un **`<select>` desplegable** amb el
  mateix valor, sincronitzat en tots dos sentits (clic a una càpsula actualitza el
  desplegable i viceversa). No hi ha cap tercer element de "lectura" separat — el
  desplegable fa also de indicador de valor actual.

**Coexistència amb el trigger `fem_sync_valoracio()` (Pas 1/1b) — decisió clau:**
El trigger recalcula sempre `valoracio` a partir de `creativity+theme+composition`
(`×10/15`) en qualsevol INSERT (sempre) o UPDATE que toqui aquestes 3 columnes. Si la
nova captura escrivís `valoracio` directament sense omplir els 3 camps antics, el
trigger el trepitjaria a 0 en el primer INSERT.

**Solució acordada (2026-07-26):** en lloc de tocar el trigger, la nova captura escriu
també als 3 camps antics amb el valor **`Puntuació / 2`** a cadascun (no `/3` — cal
tenir en compte que el trigger ja multiplica per `10/15`; amb `/3` als tres camps la
suma seria `Puntuació` i el trigger la convertiria en `Puntuació × 0.667`, no en
`Puntuació`). Amb `/2` a cada camp, la suma és `1.5 × Puntuació`, i el trigger fa
`1.5×Puntuació × 10/15 = Puntuació` exacte — viatge d'anada i tornada sense pèrdua, i
cada camp queda dins el rang 0-5 permès (màxim 5 quan Puntuació=10).

**Efecte secundari acceptat:** les pantalles antigues encara vives per a tothom
("Resultat Repte" i la seva cortina de 3 criteris) mostraran els 3 valors **idèntics**
per a qualsevol vot fet amb el sistema nou (perquè es reparteixen per igual, no hi ha
manera de reconstruir un desglossament real per criteri a partir d'una sola nota).
Cosmèticament estrany si algú s'hi fixa, però inofensiu i acceptat explícitament per
Enric — coherent amb el fet que aquestes pantalles ja estan "congelades" fins que es
retirin (§3.6, encara sense calendaritzar).

**Implementat (2026-07-26):** nova pantalla "Puntuar Repte" (renombrada de "Puntuació Repte" el 26/07/2026, a petició d'Enric, per distingir-la de "Valoració Repte" — vegeu §6), mateix patró que
"Valoració Repte"/"Taula de Classificació" (panell nou dins `screen-participant`, targeta
de nav pròpia, res de `votacio.js`/`base.css` de la votació real tocat). Diferència clau
respecte les altres dues eines de Fase 3: com que és una eina de **captura** (escriu
vots), no només de lectura, calia poder-la provar amb diversos usuaris de prova reals,
no només amb l'admin — la targeta és visible per a l'admin real **o** quan la BD activa
és Test (`_dbMode==='test'`, `js/core/config.js`), no només per rol admin.

Fitxers tocats: `index.html` (targeta + panell), `js/screens/participant.js`
(`showParticipantPuntuacioRepte`, gating), `js/features/votacio.js`
(`renderPuntuacioGrid`/`handleCapsule`/`handlePuntuacioSelect`/
`saveVoteOnClickPuntuacio`/`saveVotsPuntuacio`, tot nou, en paral·lel a
`renderVotingGrid`/`handleStar`/`saveVoteOnClick` que resten intactes),
`js/core/i18n.js` (claus noves), `css/base.css` (`.puntuacio-grid`/`.capsule`/
`.puntuacio-select`, classes noves).

**Bugs reals trobats i corregits durant les proves** (no eren nous, ja hi eren abans
d'aquesta feina, però s'han detectat provant la pantalla nova):
- El botó del modal de confirmació d'enviar vot deia "Canviar" en lloc d'"Enviar":
  `confirmAction()` (`js/ui/modals.js`) no netejava mai el text del botó — es quedava
  enganxat del darrer ús de `toggleDbMode()` (`router.js`), que l'escriu directament al
  DOM. Corregit: `confirmAction()` accepta ara una etiqueta opcional i sempre la
  imposa.
- `.btn-primary` portava `width:100%` fix a la classe (afectava totes les pantalles amb
  aquest botó, no només la nova) — eliminat; els botons ara ocupen només l'amplada del
  text, centrats.
- `updateVoteButtonsState()` (`votacio.js`) mai gestionava el botó de "Puntuació
  Repte" — es quedava congelat amb l'estat del primer render. Corregit: gestionat
  igual que els altres dos botons de vot.
- `computeValoracioGeneralRankingLive()` (Taula de Classificació) no aplicava el mateix
  criteri d'inclusió d'admin que "Valoració Repte" (només `status==='finished'`,
  ignorant reptes actius) — corregit perquè, per a l'admin real, també inclogui els
  actius (mateix criteri que `_resultatsObjectives()`, `participant.js`).
- Ni `computeGeneralRankingLive()` ni `computeValoracioGeneralRankingLive()` ordenaven
  els reptes per data — la consulta a `objectives` no porta `.order()`, així que
  l'ordre de les miniatures a Classificació General/Taula de Classificació depenia de
  l'ordre físic (indefinit) de la taula. Corregit amb un sort explícit (més recent
  primer, mateix criteri que el desplegable de Resultat/Valoració Repte) — arregla
  també la Classificació General real, no només la de prova.

**Decisions de disseny visual preses provant en directe** (feedback Enric,
2026-07-26): subtítol i avisos amb `.voting-instructions` (mida accessible ~65 anys);
avís "votacions no obertes" en vermell viu (`--danger`) en lloc de l'anterior barreja
groc/blau; estat "ja enviat" (títol, botó, avís) en ambre/daurat (`--gold`) en lloc de
verd — el verd suggeria "endavant", quan el missatge és el contrari; càpsula/desplegable
seleccionats en blanc sobre blau sòlid (`--accent`) per contrast, i quan la pantalla
queda bloquejada (vot ja enviat) **només** s'apaguen les càpsules no seleccionades, mai
la seleccionada ni el desplegable.

**Dades de prova a Test** (2026-07-26, no toca Normal): 4 usuaris ficticis
(`u_test_*`, nom amb prefix "TEST") i les seves fotos publicades a "Repte de proves",
per completar el cicle de prova (captura → Puntuar Repte → Taula de Classificació)
amb més de 2 votants. Verificat en directe: la Taula de Classificació ja reflecteix
correctament els punts d'aquest repte.

Pendent (fora d'aquesta conversa): el mateix punt (dot mig, "l·l") de "Cancel·lar" es
renderitza envitricollat en negreta condensada (`--font-cond`, Barlow Condensed) —
confirmat que el caràcter és el correcte (interpunct U+00B7), és un problema de la
font, no de les dades. Sense pedaç net trobat encara; queda com a peculiaritat menor
acceptada, a revisar si mai es canvia la tipografia dels botons.

### Incidència de dades — "Contrallums" duplicat a Test (detectat i resolt 2026-07-26)
Test tenia dos objectius actius anomenats "Contrallums": `obj_1784880752160` (creat
primer, amb les dates originals incorrectes que Enric va introduir, i únic amb fila a
`reptes_calendari`) i `obj_1784882067351` (creat ~13 min després, amb les dates ja
corregides). A **Normal** només existeix `obj_1784882067351` (mateix ID, mateixes
dates) — indici que en algun moment la versió corregida es va copiar/re-crear també a
Test amb el mateix ID, sense esborrar la fila vella. No és un bug de codi actual
(`saveObjective()` no escriu mai a dos projectes alhora); origen exacte no confirmat.
Verificat que `obj_1784880752160` no tenia cap foto ni vot enganxat. Esborrat de Test
(2026-07-26, confirmat per Enric); Test i Normal tornen a tenir un únic "Contrallums"
amb les mateixes dades.

### Passos pendents de calendaritzar (fora d'aquesta conversa per ara)
- Redisseny de les pantalles de resultat (cortina del lightbox, Resultat Repte) — §3.6.
  Ara sí és el següent pas lògic: Pas 4 (captura) ja tancat, i "Resultat Repte" segueix
  mostrant el desglossament de 3 criteris que ja no tindrà sentit quan es faci el tall.
  Nota: no cal "redissenyar" pròpiament aquestes pantalles — l'estratègia acordada (§6) és
  deixar-les intactes i amagar-ne l'accés en fer el tall, no editar-les.
- Reptes actius durant el tall (§3.3) i decisió final sobre backfill universal vs només
  reptes tancats (§3.2) — amb el Pas 1 ja hem optat, de facto, per la via "universal"
  (backfill de TOTS els vots, no només els de reptes finalitzats), perquè el trigger no
  distingeix per estat de repte.
- El moment i mecanisme exacte del tall (§6): quan es considerarà "finalitzada" la
  integració per amagar els nav-cards antics i mostrar els nous a tothom.

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
6. ~~La cortina de puntuació del lightbox i "Resultat Repte" (§3.6): es manté la mateixa
   interacció (disparador ⭐ + panell) només amb 1 fila, o es simplifica encara més?~~
   **Resolta (Pas 2b, 2026-07-25)** — només per a "Valoració Repte": disparador i
   panell nous i independents (vegeu §4, Pas 2b). "Resultat Repte" queda intacte,
   amb la seva estrella i cortina de 3 criteris; es revisarà si mai s'hi retira
   l'antic sistema de puntuació.
7. Es manté el nom de columna `valoracio` a `votes`, o preferiu un altre nom?

## 6. Estratègia de transició: pantalles noves, convivència i retirada (aclarit 2026-07-26)

**Resum del canvi de fons**: el club passa d'un sistema de vot amb **3 criteris** (Creativitat/
Temàtica/Composició, 0-5 cadascun, mitjana per obtenir la nota final) a **1 sol concepte**
("Puntuació"/"Valoració", 0-10). Aquest document (Fase 3) és el seguiment tècnic d'aquest
canvi.

**Mètode de desplegament (confirmat, ja aplicat consistentment des del Pas 2)**: en lloc de
modificar in-place les pantalles existents afectades pel sistema de puntuació, per cadascuna
es crea una **pantalla nova en paral·lel**, sense tocar l'original:

| Pantalla original (sistema antic, intacta) | Pantalla nova (sistema nou) |
|---|---|
| Votació real (`votacio.js`, 3 files d'estrelles) | **Puntuar Repte** (Pas 4) — renombrada el 26/07/2026 (abans "Puntuació Repte"; vegeu nota de naming més avall) |
| Resultat Repte (+ cortina de 3 criteris al lightbox) | **Valoració Repte** (Pas 2/2b) |
| Classificació General | **Taula de Classificació** (Pas 3) |

Només es toquen les pantalles que depenen del sistema de puntuació. Altres pantalles de
l'app **no es toquen ni es dupliquen** perquè el canvi no les afecta — per exemple, la
Galeria.

**Convivència (fase actual)**: totes les pantalles noves són visibles només per a l'usuari
admin real (i, en el cas de "Puntuar Repte" per ser una eina de captura, també quan la BD
activa és Test — vegeu Pas 4), precisament per poder-les provar i comparar amb les originals
sense arriscar l'experiència real dels socis. Les pantalles antigues i la votació real
segueixen sent les úniques visibles per a la resta d'usuaris durant tot aquest període.

**Tall (encara sense calendaritzar, §3.3/§5.3)**: quan es doni per finalitzada la integració
de les apps i el canvi de sistema de puntuació, els nav-cards d'accés a les pantalles
antigues (votació de 3 estrelles, Resultat Repte, Classificació General) deixaran de
mostrar-se, i els de les pantalles noves passaran a ser-hi per a tothom (no només admin/Test).

**Retirada (no esborrat)**: les pantalles antigues i els seus nav-cards **no s'eliminaran del
codi** en fer el tall — quedaran inaccessibles (nav-card ocult, com ja ho són ara les noves)
però presents, per si mai calgués revertir al sistema antic. Es considera un escenari poc
probable però no impossible; per això es manté com a xarxa de seguretat en lloc de fer neteja
immediata del codi. (Nota: això és una decisió específica d'aquestes pantalles de puntuació,
diferent de la retirada dels repositoris/desplegaments sencers de Reptes/Resultats prevista a
la Fase 7 del pla general.)

**Nota de naming (2026-07-26)**: la pantalla de captura del Pas 4 es deia de treball
"Puntuació Repte", massa semblant a "Valoració Repte" (la de resultats/lectura) i que
generava confusió real entre totes dues. Renombrada a **"Puntuar Repte"** (ca) / "Puntuar
Reto" (es) — el verb deixa clar que és on es fa l'acció de puntuar, per contrast amb
"Valoració Repte" on només es consulta. "Valoració Repte" no canvia de nom.
