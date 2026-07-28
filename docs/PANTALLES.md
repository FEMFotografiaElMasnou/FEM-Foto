# Inventari de pantalles i qui les veu

Durant el canvi de sistema de puntuació conviuen **parelles** de pantalles: l'antiga (3 criteris
0-5) i la nova (1 puntuació 0-10). Qui decideix quina es veu és el **commutador** del panell
d'admin (pestanya *Puntuació*), i val per a tothom.

Estat llegit del codi el **28/07/2026** (`js/screens/participant.js`, `index.html`), després de
la Fase 3 Pas D.

---

## Les parelles

| Sistema antic (3 criteris) | Sistema nou (0-10) | Nom que veu el soci |
|---|---|---|
| Votació real (`js/features/votacio.js`, estrelles) | Captura 0-10 (`renderPuntuacioGrid`) | — (s'hi entra pel mosaic) |
| `nav-card-resultats` | `nav-card-valoracio-repte` | **Resultat Repte** |
| `nav-card-classificacio` | `nav-card-taula-classificacio` | **Classificació General** |

**Les dues pantalles d'una parella es diuen igual, a posta.** El soci no ha d'aprendre cap nom
nou ni notar res el dia del tall. Els noms de treball («Valoració Repte», «Taula de
Classificació», «Puntuar Repte») ja no apareixen enlloc de la interfície: viuen només als
identificadors del codi i en aquesta documentació.

## Com es decideix què es veu

Tot passa per `applyParticipantButtonVisibility()` ([participant.js](../js/screens/participant.js)),
que llegeix `state.settings.sistemaPuntuacioNou` (reflex d'`app_settings.sistema_puntuacio_nou`).

| Targeta | Quan es veu |
|---|---|
| Mosaic de votació (`vote-mosaic-section`) | Quan la votació és oberta. **Sempre la mateixa targeta**; només canvia on porta (`obrirVotacioRepte()`) |
| Galeria (`nav-card-gallery`) | Hi ha algun repte finalitzat (o l'admin amb repte actiu). El commutador no l'afecta |
| Resultat Repte — antic / nou | Un o l'altre segons el commutador, i tots dos amagats si `force_hide_resultats` |
| Classificació General — antic / nou | Ídem amb `force_hide_classificacio` |
| `nav-card-puntuacio` | **Mai.** Retirada al Pas D; s'hi arriba pel mosaic. Es queda a l'HTML per no perdre el punt d'entrada |

Els `force_hide_*` amaguen **la parella sencera**, no una de les dues pantalles: són els botons
de sempre i fan el que sempre han fet, digui el que digui el commutador.

## El distintiu `3×5` / `0-10`

Com que les dues pantalles de cada parella es diuen igual, un admin que estigui revisant el
funcionament no sabria quina mira. Per això les targetes porten un distintiu a la cantonada que
**només veuen els comptes amb rol admin real** (`.nav-card-badge`, el pinta
`_updateSistemaBadges()`). El soci no el veu mai.

## El que va canviar al Pas D (28/07/2026)

Fins llavors, les pantalles noves eren visibles **només per a l'admin** (i «Puntuar Repte»
també en mode Test), com a eines de comparació. Aquell gating **s'ha retirat**: ara no hi ha cap
excepció per rol ni per base de dades, i un admin en mode «veure com a participant» veu
exactament el que veu un soci — decisió d'Enric, perquè aquell mode serveix precisament per
posar-se a la pell del soci. Per comparar els dos sistemes s'obren dues finestres.

Això vol dir que la vella advertència sobre `actingAsAdmin()` ja no aplica al commutador: la
visibilitat no depèn del rol. Sí que segueix aplicant al distintiu, que necessita el **rol real**
(`state.currentUser.role === 'admin'`), perquè en mode «veure com a participant»
`actingAsAdmin()` és fals a posta.

## Què passarà al tall

Res de codi: es prem el botó. Vegeu `docs/TALLS.md`, Tall 1.
