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
- **Supabase Auth** per al login (vegeu `docs/AUTENTICACIO.md`).
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
fila que **existeixi de veritat**. Amb un id inexistent el verd no prova res: la funció surt pel
camí de "no trobat" abans d'arribar a comprovar l'autorització, i pot amagar un forat real.

### Pantalles del sistema de puntuació antic (3 criteris)

No es toquen ni es redissenyen. Són el pla de reversió del Tall 1 (`docs/TALLS.md`) — tornar
enrere ha de seguir sent un clic. Es revisen a la Fase 7 (retirada), no abans.

## Com es manté la documentació

Perquè els documents no tornin a créixer amb registre cronològic (el que ja vam haver de
desfer el 05/08/2026):

- **Estat actual i regles vives, mai narrativa cronològica.** Frases del tipus "el dia X es va
  trobar...", "verificat el..." no hi tenen lloc. El detall de com s'hi ha arribat viu al
  `git log` (els missatges de commit d'aquest projecte ja el porten) — no es duplica als `.md`.
- **Un fet, un únic lloc.** Abans d'escriure una dada, comprovar que no ja hi és a un altre
  document (taula de sota). No repetir un mateix estat en 3 llocs que caldrà recordar de
  sincronitzar — un se'n va desactualitzar per això mateix.
- **Comprimir en tancar, no després.** Quan un pas o fase es tanca, en el mateix moment (no en
  una neteja posterior) es retira la narrativa de com s'hi ha arribat i es deixa només la
  conclusió operativa. Si val la pena preservar el detall, va a `docs/arxiu/`, no es queda al
  document actiu.
- **Criteri de sortida**: es podria llegir "d'una pantalla"? Si no, no està acabat.

| Tipus de dada | Únic lloc |
|---|---|
| Estat de fases i passos | `FEM-Foto_Unificacio_Pla-desenvolupament.md` |
| Esquema BD, RPC, RLS actuals | `docs/REFERENCIA_BD.md` |
| Qui veu cada pantalla | `docs/PANTALLES.md` |
| Sistema de puntuació: com funciona avui | `docs/SISTEMA_PUNTUACIO.md` |
| Autenticació i navegació: com funciona avui | `docs/AUTENTICACIO.md` |
| Migracions aplicades | `sql/README.md` |
| Checklist dels talls pendents | `docs/TALLS.md` |
| Regles i convencions permanents | Aquest fitxer |
| Detall de com es va arribar a una decisió | `git log`, o `docs/arxiu/` si cal preservar-ho |

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
| `docs/SISTEMA_PUNTUACIO.md` | Sistema de puntuació (3 criteris → 1 concepte 0-10): com funciona avui |
| `docs/AUTENTICACIO.md` | Autenticació (Supabase Auth) i navegació: com funciona avui |
| `docs/REFERENCIA_BD.md` | Taules, funcions RPC, RLS, cron — la superfície de servidor |
| `docs/PANTALLES.md` | Quines pantalles hi ha i qui les veu |
| `docs/TALLS.md` | Llistes de comprovació dels dos talls pendents |
| `sql/README.md` | Quina migració s'ha aplicat on |
| `docs/arxiu/` | Documents tancats. Historial, no referència — inclou el registre pas a pas de la migració d'Auth i del canvi de puntuació, i el guió de proves de la Fase 4 |
