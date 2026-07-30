# Neteja de codi mort i rèmores

Obert el 29/07/2026, al final del bloc B2 de la Fase 4, quan van sortir quatre restes de la
compactació del panell d'admin i Enric va plantejar la pregunta de fons: **no és millor eliminar-les
que arrossegar-les?** Sí — el codi mort es paga cada vegada que algú l'ha de llegir i decidir si
importa. Però no totes són el mateix, i el que sembla codi mort de vegades és **funció a la qual no
s'hi pot arribar**.

> **Estat**: decisions preses (§Decisions). **L'inventari detallat és la primera feina del
> 30/07/2026**, abans de tocar cap línia. Res esborrat encara.

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
- **El panell de rànquing de l'admin** (`#admin-tab-ranking`, amb `ranking-current-list` i
  `ranking-general-list`): mateixa lògica, i també sense entrada al menú. ⚠️ Per confirmar a
  l'inventari: `renderRanking()` es crida amb aquests dos ids des de set llocs, i amb els ids
  `p-ranking-*` per a les pantalles de participant, **que es queden**. Cal separar bé les dues
  famílies abans d'esborrar res.

⚠️ **Això no és una supressió de dues línies.** Esborrar el panell de l'admin arrossega
`refreshAdminDashboard()`, `saveAdminVotes()`, els gestors `admin-upload-*` de `fotos.js`, claus
d'`i18n.js` i regles de CSS. D'aquí l'inventari abans de començar.

### 4 · Amb la base de dades compartida → **pendent de parlar (30/07/2026)**

Queda pendent de repassar amb calma l'afirmació que el frontend d'aquesta app es pot esborrar sense
mirar res més. La distinció que jo proposava, per tornar-hi:

- **Frontend d'aquesta app** (HTML, CSS, JS de FEM-Foto): FEM-Reptes és un altre repositori i un
  altre desplegament, i no en depèn.
- **El que viu a la base compartida** (files d'`app_settings`, les taules mortes `settings` i
  `reptes_calendari`, `users.password`, RPC, RLS): aquí sí que cal comprovar les dues apps, i
  Zampa quan toqui `users`. És la regla que ve del 26→28/07/2026.

---

## Inventari

Per omplir el 30/07/2026: cada id, funció, clau i valor de configuració no accessible, amb la prova
de per què ho és i el calaix on cau. Res s'esborra abans de constar aquí.
