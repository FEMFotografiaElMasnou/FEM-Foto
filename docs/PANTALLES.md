# Inventari de pantalles i qui les veu

Durant el canvi de sistema de puntuació conviuen **parelles** de pantalles: l'antiga (3
criteris 0-5) i la nova (1 concepte 0-10). Cadascuna té la seva regla de visibilitat i és fàcil
confondre-les — de fet ja va passar amb els noms, i per això «Puntuació Repte» es va renombrar
«Puntuar Repte».

Estat llegit del codi el **27/07/2026** (`js/screens/participant.js`, `index.html`).

---

## Les tres parelles

| Sistema antic (3 criteris) | Sistema nou (0-10) | Què fa la nova |
|---|---|---|
| Votació real (`js/features/votacio.js`, estrelles) | **Puntuar Repte** | **Captura** de vots: 10 càpsules + desplegable |
| **Resultat Repte** | **Valoració Repte** | Resultats d'un repte, **només lectura** |
| **Classificació General** | **Taula de Classificació** | Punts acumulats, **només lectura** |

**No confondre «Puntuar Repte» amb «Valoració Repte»**: la primera *escriu* vots, la segona
només *mostra* resultats. Són coses diferents amb noms que s'assemblen.

## Visibilitat

| Pantalla | `nav-card` | Qui la veu |
|---|---|---|
| Votar (mosaic) | `vote-mosaic-section` | Tothom, quan la votació és oberta |
| Galeria | `nav-card-gallery` | Tothom |
| Resultat Repte | `nav-card-resultats` | Tothom |
| Classificació General | `nav-card-classificacio` | Tothom |
| Valoració Repte | `nav-card-valoracio-repte` | **Només rol admin real** |
| Taula de Classificació | `nav-card-taula-classificacio` | **Només rol admin real** |
| Puntuar Repte | `nav-card-puntuacio` | **Admin real O bé mode BD = Test** |

### Per què «Puntuar Repte» té una regla diferent

Les altres dues noves són taulers de només lectura: n'hi ha prou que les vegi un admin per
comparar sistemes. «Puntuar Repte» és una eina de **captura** que s'ha de poder exercitar amb
diversos usuaris de prova **no admin** — si es gatejava només per rol, calia promoure un usuari
de prova a admin només per arribar-hi. Es mostra també en mode Test, on els socis reals mai
són (no tenen manera de canviar de base de dades), així que no queda exposada en producció.

### Per què cal el **rol real**, no `actingAsAdmin()`

L'únic camí pel qual un admin arriba a veure aquesta graella de nav-cards és posant-se en mode
"veure com a participant", i en aquell mode `actingAsAdmin()` és fals **a propòsit**, perquè
tota la resta es vegi exactament com ho veu un soci. Cal comprovar
`state.currentUser.role === 'admin'` directament. Està comentat a
[participant.js:400](../js/screens/participant.js:400) i és fàcil de trepitjar sense voler.

## Què passarà al tall

Quan es doni per bo el canvi de sistema, els `nav-card` antics deixaran de mostrar-se i els
nous passaran a ser visibles per a tothom. **Les pantalles antigues no s'esborraran del codi**,
només quedaran ocultes — el mateix mecanisme que les noves fan servir avui, per si mai calgués
tornar enrere. Vegeu `docs/TALLS.md`.

Les pantalles que el canvi de puntuació no afecta (la Galeria) no es toquen ni es dupliquen.
