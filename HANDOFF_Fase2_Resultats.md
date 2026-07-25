# FEM-Foto — Handoff Fase 2: integració nativa de Resultats

> Document de traspàs perquè Claude Code pugui començar la Fase 2 del pla d'unificació
> sense haver d'explorar els dos repos des de zero. Llegeix també `FEM_reptes.md` (arrel
> d'aquest repo) abans de tocar res: conté les convencions del projecte i el flux de treball.

## Objectiu d'aquesta fase

FEM-Foto és avui una còpia exacta de FEM-Reptes. L'objectiu d'aquesta fase és portar-hi
les dues pantalles de FEM-Resultats — **Resultats de Repte** i **Classificació General** —
com a pantalles natives (JS pla, mòduls ES, sense build), eliminant l'iframe que les carrega
avui i deixant un **únic** càlcul de rànquing a tot el projecte.

**Fora d'abast d'aquesta fase**: el canvi de sistema de puntuació (3 criteris → "Puntuació"
única 0–10) és la Fase 3, posterior. No barrejar-ho amb aquesta tasca.

## Com s'enganxen avui (estat actual, a retirar)

- `index.html` (~línia 614): `<iframe id="iframe-resultats" src="" title="Resultats"></iframe>`
- `js/screens/participant.js`:
  - `RESULTATS_BASE = 'https://fem-resultats.vercel.app/'`
  - Una funció assigna `iframe.src` amb querystring `?role=&view=&embedded=true`
  - `embedded=true` fa que FEM-Resultats saltui el seu propi login (ho gestiona `App.jsx`,
    `useState(embedded)` a `loggedIn`)
- Tot això (l'`<iframe>` i el codi que l'alimenta) s'ha de retirar en acabar aquesta fase.

## Lògica que JA existeix a Foto/Reptes (reutilitzar, no duplicar)

`js/features/ranking.js` és la font de veritat del càlcul de rànquing en aquest projecte:

- `getPhotoScoreBreakdown(photoId, scope)` — nota d'una foto, amb `scope` = `'all' | 'expert' | 'socis'`
  (equivalent al filtre de vot per rol)
- `computeRankingForObjective(objId)` — rànquing detallat d'un repte
- `objectiveHasExpertVoting(objectiveId)` — si té sentit mostrar el filtre Tots/Socis/Expert
- `getPhotoResultsBreakdown(photoId)` — desglossament pels 3 blocs (Expert/Socis/Tots)
- `POSITION_POINTS` / `getPointsForPosition()` / `assignPositionPoints()` — taula de punts
  per posició (25, 18, 15, 12, 10, 8, 7, 6, 5, 4…)
- `renderResultatsRepte(objId, listId)` — **ja pinta un rànquing detallat d'un repte
  finalitzat** (nom, foto, 3 criteris, nota) — és el punt de partida més proper a la
  pantalla "Resultats de Repte" de Resultats; probablement calgui adaptar-lo (afegir
  filtre de vot per rol a la UI) més que escriure'l de nou.
- **Important — divergència a resoldre**: `ranking.js` (Foto/Reptes) guarda els punts
  acumulats de la Classificació General a `state.generalRanking`, persistits a
  `app_settings` **en el moment de finalitzar cada repte** (`tematiques.js`, funció que
  crida `assignPositionPoints` i `saveSettings()`). En canvi FEM-Resultats **recalcula
  tot en viu** a cada càrrega, llegint `votes`/`seguiment_votacio` directament (`App.jsx`,
  `loadGeneral()` + `utils.js`). Normalment donen el mateix resultat, però no és el mateix
  mecanisme. **Decidir explícitament quin dels dos criteris es manté** a Foto (recomanació:
  el càlcul en viu de Resultats és més robust — no depèn de no oblidar-se de re-finalitzar
  si es corregeix un vot a posteriori — però cal valorar-ho amb Pablo si hi ha reptes molt
  antics on recalcular en viu sigui car).

## Lògica que hi ha a FEM-Resultats i que s'ha de PORTAR (no copiar tal qual — adaptar a JS pla)

Repo: `FEMFotografiaElMasnou/FEM-Resultats` (React 19 + Vite). Fitxers rellevants:

- **`src/utils.js`** — conté `scorePhotos()`, `rankByField()`, `getInternalPoints()`/
  `POINTS_TABLE`, `VOTE_MODES`/`eligibleIdsForMode()`/`hasExpertAmong()`,
  `hasEffectiveVotes()`, `noAutoRotateUrl()`/`thumbUrl()`/`thumbSmUrl()` (Cloudinary),
  `buildLightboxCaption()`. **La part de puntuació (scorePhotos, rankByField,
  getInternalPoints) NO s'ha de portar** — és la lògica duplicada que unifiquem; Foto ja
  té l'equivalent a `ranking.js`. Sí que cal portar les utilitats de Cloudinary
  (thumbUrl/thumbSmUrl no existeixen a Foto) i `buildLightboxCaption`.
- **`src/App.jsx`** — orquestra la càrrega de dades i els dos `view` (`'repte'` / `'general'`).
  Útil per veure exactament quines taules/columnes de Supabase es consulten
  (`seguiment_votacio`, `photo_submissions`, `votes`, `users`) i com es filtra per
  `eligibleUsers` (usuaris que han enviat vot definitiu, `es_esborrany=false`).
- **`src/components/ResultsView.jsx`** (115 línies) — pantalla "Resultats de Repte":
  selector d'ordenació (Total/Creativitat/Composició/Temàtica), selector de filtre de vot
  (Tots/Socis/Expert), llista posicionada amb miniatures.
- **`src/components/GeneralTable.jsx`** (109 línies) — pantalla "Classificació General":
  taula Pos/Soci/Total/Reptes, mateix selector de filtre de vot.
- **`src/components/Stars.jsx`** (14 línies) i **`Lightbox.jsx`** (89 línies) — probablement
  substituïbles pels equivalents que ja existeixen a Foto (`js/ui/lightbox.js` ja fa
  zoom/swipe/descàrrega).
- **`src/components/Topbar.jsx`**, **`LoginOverlay.jsx`** — no calen: Foto ja té login i
  capçalera propis; només interessa la part de contingut (ResultsView/GeneralTable).

## Passos suggerits

1. **Preparar el material de referència**: copia el repo `FEM-Resultats` (només `src/`,
   no cal `node_modules`) dins de `FEM-Foto/_reference-resultats/` i afegeix
   `_reference-resultats/` al `.gitignore` — és només perquè Claude Code el pugui llegir
   còmodament durant aquesta fase; s'esborra en acabar.
2. Decidir la ubicació de les noves pantalles (proposta: `js/screens/resultats.js` +
   funcions noves a `js/features/ranking.js` per al render, seguint el patró
   `renderResultatsRepte()` ja existent).
3. Afegir el filtre de vot per rol (Tots/Socis/Expert) a la UI, reutilitzant
   `objectiveHasExpertVoting()` / `getPhotoResultsBreakdown()` de `ranking.js`.
4. Construir la pantalla "Classificació General" (avui no existeix res equivalent a Foto
   fora de `state.generalRanking` + `computeGeneralRanking()`/`renderRanking()` — cal
   decidir si s'hi arriba amb aquest mètode o amb el recàlcul en viu de Resultats, vegeu
   la divergència comentada més amunt).
5. Afegir accés a aquestes pantalles des de la navegació de Foto (on avui hi havia el botó
   cap a l'iframe).
6. Retirar l'iframe: `<iframe id="iframe-resultats">` a `index.html`, `RESULTATS_BASE` i
   el codi que l'alimenta a `participant.js`.
7. Provar-ho tot contra el projecte Supabase **Test** (commutador ja existent a Foto)
   abans de donar-ho per bo.
8. Esborrar `_reference-resultats/` un cop la migració estigui feta i validada.

## Regles del projecte (recordatori, ja són a `FEM_reptes.md`)

- Revisar sempre el codi implicat abans de tocar-lo; si alguna cosa no quadra, preguntar,
  no inventar.
- Una tasca (un deure) a la vegada; en acabar, explicar què s'ha canviat.
- No obrir l'app per `file://` — cal servidor local (`npx serve`, Live Server, etc.).
- No esborrar res de Supabase des del frontend.
- Provar sempre a l'entorn Test abans que a Normal.

## Prompt d'arrencada suggerit per a Claude Code

```
Llegeix FEM_reptes.md i HANDOFF_Fase2_Resultats.md sencers abans de tocar res.
Fes-me un pla detallat per a la Fase 2 (integració nativa de Resultats) seguint
els passos suggerits del handoff, i espera el meu OK abans de començar a escriure codi.
```
