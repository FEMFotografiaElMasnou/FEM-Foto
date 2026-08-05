# FEM · Fotografia El Masnou

## Unificació de Reptes i Resultats: context i pla de desenvolupament

*Pla mestre del projecte. Última actualització: 05/08/2026.*

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

**Vots històrics dels reptes ja finalitzats:** es mantenen intactes — no s'elimina ni el camp ni les dades dels 3 criteris (creativity/theme/composition). "No migrar-los" vol dir no ELIMINAR-los, no renunciar a derivar-ne un valor nou: `votes.valoracio` es calcula d'ells per trigger, sense tocar-los, i així la pantalla unificada 0-10 també pot mostrar els reptes antics ja normalitzats. Com funciona avui: `docs/SISTEMA_PUNTUACIO.md`.

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
| 0 | Diagnosi i pla | Aquest document |
| 1 | Bastida del projecte | Repo GitHub nou + projecte Vercel nou (sense domini), connectats a la mateixa BD Supabase (Normal/Test) i al mateix compte de Cloudinary. Es parteix del codi de FEM-Reptes com a punt de partida |
| 2 | Integració nativa de Resultats | "Resultats de Repte" i "Classificació General" com a pantalles pròpies dins l'app (no un iframe), amb un ÚNIC càlcul de rànquing (`ranking.js`) |
| 3 | Nou sistema de puntuació | Canvi d'esquema a `votes`, nou control de vot 0-10 a la UI, adaptació de `ranking.js` i de les pantalles de resultat. Primer a Test, després a Normal |
| 4 | Proves internes | Validació amb l'entorn de Test, comparant resultats amb Reptes + Resultats actuals per descartar regressions |
| 5 | ~~Validació amb els socis~~ | Suprimida — vegeu nota sota la taula |
| 6 | Tall (cutover) | femfotografiaelmasnou.cat es reapunta cap al projecte Vercel de Foto. Moment sensible: franja de baix ús + pla de reversió del DNS |
| 7 | Retirada | Un cop Foto porti un temps estable en producció, s'arxiven (no s'esborren de seguida) els repos i desplegaments de Reptes i Resultats |

**Fase 5, suprimida (04/08/2026, decisió d'Enric):** els socis no tenen el nivell tècnic per
validar una URL de prova de Vercel — no aportaria res de fiable. La validació real ja passa
contínuament en línia amb en Pablo, i cada "fes commit i push" d'Enric és, formalment, el punt
on ell dona una cosa per prou validada. El Tall 2 (domini) no depèn de cap "Fase 5 tancada":
depèn només dels punts tècnics de `docs/TALLS.md`.

## 6. Estat actual

| Fase | Estat | Detall |
|---|---|---|
| 0 · Diagnosi i pla | ✅ Fet | Aquest document |
| 1 · Bastida | ✅ Fet | Repo `FEM-Foto` i projecte Vercel actius. Desplega a `fem-foto.vercel.app` |
| 2 · Integració nativa de Resultats | ✅ **Tancada** | Iframe retirat, un únic motor de rànquing. Sense cap dependència de FEM-Resultats |
| 3 · Nou sistema de puntuació | 🔄 En curs | Passos 1-4 i A-D fets **i desplegats**. El tall ja és **un clic**, no codi: només falta prémer-lo (Normal segueix en «Antic») |
| 4 · Proves internes | ✅ **Tancada (02/08/2026)** | Els 10 blocs del guió en verd. Registre a `docs/arxiu/PROVES_Fase4.md` |
| 5 · ~~Validació amb els socis~~ | ❌ **Suprimida (04/08/2026)** | Vegeu la nota sota la taula de fases, §5 |
| 6 · Tall de domini | ⬜ | Llista de comprovació a `docs/TALLS.md` |
| 7 · Retirada de les apps antigues | ⬜ | Un cop FEM-Reptes deixi d'importar: la fila `app_settings.general_ranking` (§8) i el que quedi per revisar a `docs/arxiu/NETEJA_codi_mort.md` |

**Fase 2 — tancada del tot, sense dependència de FEM-Resultats**: zero referències a `iframe`,
`RESULTATS_BASE` o `FEM-Resultats` enlloc del codi viu. Si avui s'esborrés el repo de
FEM-Resultats, FEM-Foto seguiria funcionant igual.

**Fase 3 — com funciona avui**: `docs/SISTEMA_PUNTUACIO.md`; qui veu cada pantalla,
`docs/PANTALLES.md`.

### Treball transversal — autenticació, navegació i seguretat

Fora de la numeració de fases. Detall a `docs/AUTENTICACIO.md`.

| Bloc | Estat |
|---|---|
| **Autenticació** — migració a Supabase Auth | ✅ **Tancada (04/08/2026)** als dos entorns |
| **Navegació** — refresc i botó enrere | ✅ Fet i verificat (02/08/2026) |
| **Seguretat** — filtre d'alta (cens de socis FEM) | ✅ Fet i verificat als **dos entorns** (02/08/2026); 48 emails a Normal, 58 a Test |

Com funciona cadascun d'aquests tres blocs avui, i les regles que no es tornen a discutir:
`docs/AUTENTICACIO.md`.

## 7. Què queda pendent de decidir

**El tall de Fase 3** (checklist a `docs/TALLS.md`): **quan** es prem el commutador. No falta
res tècnic — els Passos A-D ja són desplegats —, només decidir el dia. Preferència: fer-ho entre
la pujada i l'inici de la votació d'un repte (no un requisit: els dos sistemes conviuen bé si no
es pot).

**La navegació**: si es fa per a totes les pantalles de cop o primer només les de participant.

## 8. Backlog de petits ajustos

Coses menors, sense data, que no justifiquen una fase pròpia:

- **Galeria**: si qui mira és admin, oferir un botó per descarregar les imatges que hi hagi en
  pantalla segons els filtres aplicats.
- **`fem_admin_create_member` i `fem_admin_set_password`**: afegir-hi `REVOKE EXECUTE ... FROM
  PUBLIC, anon`. No hi ha cap forat (totes dues es comproven internament), però trenquen el
  criteri de doble barrera que sí segueixen les funcions més noves. Vegeu `docs/REFERENCIA_BD.md`.
- **Neteja de BD, sense pressa**: eliminar les taules mortes `reptes_calendari` i `settings`, i
  la fila `app_settings.general_ranking` (mirall d'un càlcul que ja no existeix — comprovar
  abans que FEM-Reptes no la usa). Valorar el renombrat `objectives` → `reptes`; obliga a
  reescriure a mà `fem_apply_calendar()`, que té els noms de taula escrits com a text.
- **`admin-tab-voting`** (`admin-upload-section`, `admin-voting-grid`, `btn-save-admin-votes`):
  resta de la compactació del panell d'admin, sense entrada al sidebar. Candidat a esborrar
  igual que ja es va fer amb `admin-tab-ranking`.
- **`window.showAdminScreen`** no comprova el rol (es pot pintar la carcassa des de la consola
  del navegador). No exposa dades ni deixa escriure (RLS + `fem_is_admin()`), però convindria la
  mateixa comprovació que ja té `toggleAdminParticipantView()`.
- **Durant la votació, el soci perd de vista el repte**: amb la votació oberta,
  `updateUploadSection()` amaga tota la targeta «Repte + La meva foto» (imatge de portada,
  descripció, dates) i la substitueix per la de «Votar el repte». Disseny volgut, no un defecte,
  però val la pena decidir si la targeta de votació hauria de portar-hi almenys el nom del repte.
- **Interpunt de "Cancel·lar"**: es veu malament amb la font condensada dels botons (problema de
  renderització de la font, no de dades). Sense pedaç net trobat; acceptat com a menor.

## 9. Riscos vius

- **`users` és compartida amb l'app Zampa** del club. Qualsevol operació en cascada sobre
  aquesta taula hi esborraria dades. Comprovar-ho sempre.
- **Les dues apps escriuen al mateix Supabase de producció** mentre convisquin FEM-Foto i
  FEM-Reptes: qualsevol canvi d'esquema, de permisos o de RLS s'ha de comprovar **també** contra
  l'app antiga abans d'aplicar-lo (el codi font original és el primer commit de FEM-Foto,
  `3ddb85a`). Aquest risc ja va tombar FEM-Reptes dos dies (28/07/2026, arreglat el mateix dia) —
  des de llavors, cada canvi compartit es verifica contra les dues apps **abans**, no després.
- **El tall de domini** (Fase 6) és el moment més sensible del projecte: franja de baix ús i pla
  de reversió del DNS a mà. Vegeu `docs/TALLS.md`.

---

*Documents relacionats: `CLAUDE.md` (regles i entrada), `docs/SISTEMA_PUNTUACIO.md`,
`docs/AUTENTICACIO.md`, `docs/REFERENCIA_BD.md`, `docs/PANTALLES.md`, `docs/TALLS.md`,
`sql/README.md`. Documents tancats a `docs/arxiu/`.*
