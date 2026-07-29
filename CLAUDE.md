# FEM-Foto — instruccions del projecte

App web de votació fotogràfica per al club **FEM Fotografia El Masnou** (~50 socis).
Cada repte, els socis pugen una foto, voten les de la resta i l'app en calcula el rànquing
i una Classificació General acumulada.

Aquest fitxer és el punt d'entrada. Es llegeix sencer a cada sessió; ha de ser curt i **cert**.

---

## ⚠️ Desplegament — llegeix això abans de fer `push`

| | |
|---|---|
| Repositori | `FEMFotografiaElMasnou/FEM-Foto`, branca `main` |
| Desplegament | `git push` a `main` → **Vercel desplega automàticament** |
| URL desplegada | **`https://fem-foto.vercel.app`** |
| Domini del club | `femfotografiaelmasnou.cat` → **encara apunta a l'app ANTIGA (FEM-Reptes), NO a aquesta** |

El tall de domini és la **Fase 6** del pla i **encara no s'ha fet**. Fer `push` publica a
`fem-foto.vercel.app`, no al domini que fan servir els socis avui. Això no vol dir que sigui
inofensiu: l'app desplegada escriu a la base de dades **de producció**, compartida amb l'app
antiga i amb l'app Zampa del club.

---

## Stack

- **HTML + CSS + JavaScript amb mòduls ES natius** (`import`/`export`). Sense framework.
- **Sense build step ni bundler.** El navegador carrega els mòduls tal com són. No hi ha
  `npm install`, ni transpilació, ni `node_modules`.
- **Supabase** (Postgres + API REST/JS) — dos projectes, commutables des de la UI:
  - Normal (producció): `ogqqcgbgcqowvywaolln`
  - Test: `xxydxdsiunfwzkcffdai`
  - Configuració a `js/core/config.js`. El mode actiu es desa a `localStorage`.
  - La clau `anon` és **pública per disseny**: la seguretat real recau a les polítiques RLS,
    no a amagar-la.
- **Supabase Auth** per al login (migració feta el 26-27/07/2026; vegeu `ANALISI_Login_Navegacio.md`).
- **Cloudinary** per a les imatges (cloud `dz1n0g9yg`, preset `Fem_Apps`).

## Com treballar-hi

```bash
npx serve          # servir en local (http://localhost:3000)
node --check js/ruta/al/modul.js   # validar sintaxi d'un mòdul
```

**Els mòduls ES no funcionen per `file://`.** Obrir `index.html` amb doble clic no funciona
mai: el navegador bloqueja els imports i l'app no reacciona. Sempre per HTTP.

## Estructura

- `index.html` — contenidors de pantalla (login/admin/participant) + modals. Carrega `js/main.js`.
- `css/` — `base.css` (variables, reset, layout), `login.css`, `admin.css`, `participant.css`.
- `js/main.js` — punt d'entrada: importa el graf sencer, lliga listeners globals, arrenca `init()`.
- `js/core/` — `state` (font única de veritat), `config` (client Supabase/Cloudinary, mode BD),
  `i18n` (CA/ES), `data` (`loadAllData` i escriptures), `router` (pantalles, nav, auto-refresh).
- `js/ui/` — `toast`, `modals`, `lightbox`.
- `js/features/` — `calendari`, `fotos`, `galeria`, `ranking`, `socis`, `tematiques`, `textos`, `votacio`.
- `js/screens/` — `login`, `admin`, `participant` (orquestren les features).
- `sql/` — migracions escrites a mà, amb el seu rollback. Vegeu `sql/README.md`.
- `_reference-resultats/` — còpia estàtica del codi React de l'antiga app FEM-Resultats,
  **només com a referència de consulta**. No es carrega ni es construeix mai.

## Convencions

- **`onclick` → `window.*`**: les funcions cridades des d'`onclick=` a l'HTML s'exposen a
  `window` (p. ex. `window.handleLogin = handleLogin`). Entre mòduls, `import`/`export`.
- **`state` és l'única font de veritat** (`js/core/state.js`). Els mòduls l'importen, no el dupliquen.
- **i18n**: tot text visible passa per `t(key)` o `data-i18n`. Català (`ca`, per defecte) i
  castellà (`es`) — **sempre els dos alhora** en afegir textos nous.
- **Rols**: `admin`, `participant` i `expert` (aquest darrer només afecta el filtre de vots).
- **Públic real**: socis d'edat mitjana ~65 anys. Mides de lletra, contrast i claredat dels
  missatges no són un detall estètic, són un requisit.

## Regles de treball

- **Una tasca a la vegada.** Per a qualsevol cosa no trivial, proposar el pla i **esperar l'OK**
  abans d'escriure codi.
- **Mai `commit` ni `push` sense que Enric ho demani explícitament.**
- **Mai esborrar res de Supabase des del frontend** (ADR-015). Els canvis d'esquema i de dades
  van per SQL, aplicat amb les eines MCP de Supabase.
- **Sempre Test primer, verificar, i després Normal.** Cada migració ha de portar el seu script
  de marxa enrere escrit *abans* d'aplicar-la.
- **Provar servint en local**, mai per `file://`, abans de donar per bo cap canvi d'interfície.
- **No barrejar modularització/refactor amb canvis de lògica** en la mateixa edició.
- Si alguna cosa no quadra (dades, un document, una fórmula), **preguntar**. No inventar ni
  "arreglar" en silenci.
- Els canvis visuals s'iteren sobre captures reals d'Enric, no sobre suposicions.

### Proves d'autorització

Una prova negativa (comprovar que algú **no** pot fer una cosa) ha de fer-se sempre amb una
fila que **existeixi de veritat**. El 27/07/2026 una prova amb un id inexistent va donar verd
sense provar res: la funció sortia pel camí de "no trobat" abans d'arribar a comprovar
l'autorització, i va amagar un forat real durant hores.

## Qui és qui

- **Enric** — porta el desenvolupament i és amb qui es treballa. Informàtic de carrera
  (programador → cap de projectes → consultoria, ara jubilat): es pot anar al detall tècnic
  sense embuts. El que no domina és aquest stack concret (Supabase, JS modern), i per a
  decisions de seqüenciació tècnica prefereix que se li recomani una opció amb els motius,
  no que se li facin triar alternatives.
- **Pablo** — soci de la FEM i iniciador original de l'app; Enric i ell estan en contacte
  permanent i comparteixen el desenvolupament. No cal fer-hi cap gestió des d'aquí.

## Documentació

| Document | Per a què serveix |
|---|---|
| `FEM-Foto_Unificacio_Pla-desenvolupament.md` | Pla mestre: fases, estat de cadascuna, backlog |
| `ANALISI_Fase3_Puntuacio.md` | Canvi del sistema de puntuació (3 criteris → 1 concepte 0-10) |
| `ANALISI_Login_Navegacio.md` | Autenticació (Supabase Auth) i navegació |
| `docs/REFERENCIA_BD.md` | Taules, funcions RPC, RLS, cron — la superfície de servidor |
| `docs/PANTALLES.md` | Quines pantalles hi ha i qui les veu |
| `docs/TALLS.md` | Llistes de comprovació dels dos talls pendents |
| `docs/PROVES_Fase4.md` | Guió de proves internes (Fase 4) i registre d'incidències |
| `sql/README.md` | Quina migració s'ha aplicat on |
| `docs/arxiu/` | Documents tancats. Historial, no referència. |
