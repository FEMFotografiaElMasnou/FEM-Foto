# Neteja de codi mort i rèmores (històric)

> **Document arxivat (05/08/2026).** La regla viva que en va sortir ("pantalles del sistema
> antic: no tocar fins Fase 7") és a `CLAUDE.md`. L'únic punt encara pendent (la fila
> `app_settings.general_ranking`) és al backlog de `FEM-Foto_Unificacio_Pla-desenvolupament.md`.
> Això que segueix és el registre de com es va decidir cada peça.

Obert el 29/07/2026, al final del bloc B2 de la Fase 4, quan van sortir quatre restes de la
compactació del panell d'admin i Enric va plantejar la pregunta de fons: **no és millor eliminar-les
que arrossegar-les?** Sí — el codi mort es paga cada vegada que algú l'ha de llegir i decidir si
importa. Però no totes són el mateix, i el que sembla codi mort de vegades és **funció a la qual no
s'hi pot arribar**.

> **Estat**: decisions preses (§Decisions). **31/07/2026**: el panell de rànquing i el mirall
> `general_ranking` (§3) ja s'han esborrat, avançats per la incidència 4.9 — no calia esperar que el
> bloc B fos verd del tot. **01/08/2026**: `names_revealed`/`ranking_hidden` (columnes i files),
> resoltes del tot, a les dues apps i les dues bases. Només queda pendent la fila
> `app_settings.general_ranking` (§3) i la resta de l'inventari (§1, §4).

---

## Quan es fa

**Quan el bloc B de `docs/PROVES_Fase4.md` estigui verd, i abans de la Fase 5.** No durant les
proves: si s'esborra mentre es verifica, un vermell no es distingeix d'un efecte de la neteja. És la
regla del projecte de no barrejar refactor amb lògica, que el 29/07 ja va estalviar un mal de cap
amb `getPhotoValoracio()`.

Cada bloc de neteja va en **el seu propi commit**, servint l'app i tornant a passar els punts del
guió de les pantalles afectades.

---

## Decisions (Enric, 29/07/2026)

### 1 · Mort de debò → **esborrar**

Línies que no fan res i de les quals no depèn res.

- La barra antiga de 6 pestanyes del panell (`#admin-top-tabs`, amb `display:none`), substituïda pel
  sidebar.
- `showUpload` dins de `getButtonVisibility()` (`js/screens/participant.js`): es calcula i no el
  llegeix ningú. Qui amaga la secció de pujada és la comprovació directa de `fotos.js`.

### 2 · Adormit a posta → **NO TOCAR**

Les pantalles del sistema antic (3 criteris 0-5) i tot el que les alimenta.

Dues raons, i totes dues valen: són **el pla de reversió del Tall 1** —tornar enrere és un clic
precisament perquè aquell codi hi és— i estan **prou afinades** per si una reunió de socis futura
decideix tornar al 3×5. No es toquen fins que el tall porti temps estable (Fase 7), i llavors es
tornarà a decidir.

### 3 · Rèmores de disseny → **esborrar, amb inventari previ**

Funcions que existeixen però que no calen, perquè la manera de fer-les ja és una altra.

- **Els quatre `force_hide_*`** (`force_hide_upload`, `force_hide_vote`, `force_hide_resultats`,
  `force_hide_classificacio`): no calen per res. Avui ja no tenen control a la interfície i tots
  quatre valen `false` a les dues bases. Fora el codi que els llegeix (`participant.js`,
  `fotos.js`, `data.js`, `state.js`, `config.js`, `router.js`) i fora les seves files
  d'`app_settings` i les claus d'`i18n.js`.
- **El panell de pujada i votació propi de l'admin** (`#admin-tab-voting`: `admin-upload-section`,
  `admin-voting-grid`, `btn-save-admin-votes` i companyia, més `refreshAdminDashboard()` i les
  crides a `renderAdminVotingGrid()`): quan un admin vol pujar foto o votar, **adopta el rol de
  soci** i ho fa com qualsevol altre. No necessita una interfície pròpia per fer-ho.
- ~~**El panell de rànquing** (`#admin-tab-ranking` I `#participant-panel-ranking`, amb
  `ranking-current-list`/`ranking-general-list` i `p-ranking-current-list`/`p-ranking-general-list`)~~
  — **esborrat el 31/07/2026**, junt amb la incidència 4.9 (`PROVES_Fase4.md`).
  Resulta que la família `p-ranking-*` **tampoc** es quedava: `showParticipantRanking()` només la
  cridava `showParticipantClassificacio()`, que el propi codi ja marcava com "vista interna antiga;
  ja no enllaçada" — cap `onclick` hi arribava enlloc. Les dues famílies eren mort, no calia
  separar-les.

- ~~**El mirall `app_settings.general_ranking` i el que l'escriu**~~ (incidència 3.6 de
  `PROVES_Fase4.md`) — **codi esborrat el 31/07/2026**, de rebot en esborrar les pantalles de dalt
  (eren la mateixa font): `computeGeneralRanking()` i el bloc de `finalizeObjective()` que hi sumava
  punts ja no existeixen. `state.generalRanking` ara és inert. **Pendent només la fila
  `app_settings.general_ranking` en si** (a Test i a Normal): no s'ha tocat perquè `app_settings` és
  compartida amb FEM-Reptes i cal comprovar-ho abans, mateixa cautela de sempre.

⚠️ **Això no és una supressió de dues línies.** Esborrar el panell de l'admin arrossega
`refreshAdminDashboard()`, `saveAdminVotes()`, els gestors `admin-upload-*` de `fotos.js`, claus
d'`i18n.js` i regles de CSS. D'aquí l'inventari abans de començar.

### 4 · Amb la base de dades compartida → **pendent de parlar (30/07/2026)**

La distinció de fons, per no tornar-hi cada cop:

- **Frontend d'aquesta app** (HTML, CSS, JS de FEM-Foto): FEM-Reptes és un altre repositori i un
  altre desplegament, i no en depèn. Es pot esborrar sense mirar res més — és el que s'ha fet a la
  incidència 4.9 (31/07/2026).
- **El que viu a la base compartida** (columnes i files d'`app_settings`/`objectives`/
  `photo_submissions`, les taules mortes `settings` i `reptes_calendari`, `users.password`, RPC,
  RLS): aquí sí que cal comprovar les dues apps (i Zampa quan toqui `users`) abans de tocar
  l'esquema o esborrar files — regla que ve del 26→28/07/2026, quan un canvi fet només pensant en
  aquesta app va deixar FEM-Reptes caiguda dos dies.

**Llista concreta pendent** (tot descobert fent net de la incidència 4.9, 31/07/2026 — cap d'aquests
punts fa mal avui, cap camí de codi hi arriba):

| Què | On | Per què no s'ha tocat avui |
|---|---|---|
| Fila `app_settings.general_ranking` | Test i Normal | Incidència 3.6: el codi que hi escrivia ja no existeix (31/07), la fila sí. Mateixa comprovació pendent |

Criteri per quan es pugui tocar: quan es confirmi que FEM-Reptes no les usa (repte a part, cal el
seu repositori), **o** directament a la Fase 7 (retirada de FEM-Reptes), quan deixi d'importar.

> `objectives.names_revealed`, `photo_submissions.revealed` i les files `app_settings.names_revealed`/
> `ranking_hidden` **ja no hi són** (01/08/2026): es va comprovar FEM-Reptes a fons —el codi que els
> llegia hi era, però mort igual que aquí— i es van treure de les dues apps i de les dues bases.
> Vegeu `sql/2026-08-01_neteja_names_revealed_ranking_hidden.sql` i la incidència 4.9/7.7 de
> `docs/PROVES_Fase4.md`.

---

## Inventari

Per omplir el 30/07/2026: cada id, funció, clau i valor de configuració no accessible, amb la prova
de per què ho és i el calaix on cau. Res s'esborra abans de constar aquí.
