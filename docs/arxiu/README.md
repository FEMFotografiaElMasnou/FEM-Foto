# Arxiu documental

Documents **tancats**. Es conserven perquè expliquen *per què* les coses són com són, però
**cap d'ells descriu l'estat actual del projecte** i alguns contenen dades que ja no són certes.

Mateix criteri que s'aplica al codi durant la transició de Fase 3: **amagar, no esborrar**.

Per a l'estat actual, vegeu `CLAUDE.md` a l'arrel.

| Document | Què era | Per què s'arxiva | Què encara hi val |
|---|---|---|---|
| `FEM_reptes_historic.md` | Regles del projecte fins al 27/07/2026 | Descriu l'app anterior i té **dades de desplegament errònies** per a aquest repo | El pla multi-repte: per què `objectives` té els camps que té i d'on surten els modes `calendari`/`obert`/`tancat` |
| `CHANGELOG.md` | Registre de versions de la modularització (0.1.x) | Abandonat: última entrada 0.1.45 del 24/07/2026, sense cap rastre de Fase 2, Fase 3 ni la migració d'Auth. Un registre que s'atura en silenci enganya | Historial detallat de l'època de la modularització i dels bugs corregits fins al 24/07 |
| `Diagnostic_objectives_reptes_calendari.md` | Diagnòstic previ a fusionar `reptes_calendari` dins `objectives` | La migració es va aplicar el 24/07/2026 | El raonament de per què una taula satèl·lit era mala idea. Els tres fets que segueixen vius són a `docs/REFERENCIA_BD.md` |
| `HANDOFF_Fase2_Resultats.md` | Traspàs per integrar Resultats nativament | Fase 2 tancada i verificada; descriu un iframe que ja no existeix | El mapa del codi de FEM-Resultats, útil si algun dia cal consultar `_reference-resultats/` |
| `Galeria_especificacio.md` | Especificació de la galeria | Implementada a `js/features/galeria.js` | El criteri d'ordenació i el comportament esperat dels dos desplegables |
| `HISTORIC_Fase3_Puntuacio.md` | Seguiment pas a pas del canvi de sistema de puntuació | Fase 3 tancada (05/08/2026); l'estat actual viu a `docs/SISTEMA_PUNTUACIO.md` | El raonament de cada decisió de disseny (trigger vs. columna generada, `/2` vs `/3`, etc.) si mai cal revisar-lo |
| `HISTORIC_Auth_Migracio.md` | Seguiment pas a pas de la migració a Supabase Auth | Migració tancada (05/08/2026); l'estat actual viu a `docs/AUTENTICACIO.md` | El detall de cada forat de seguretat trobat i corregit pel camí (el parany del `NULL` en comprovacions d'autorització, els `REVOKE` que no feien res, etc.) |
| `PROVES_Fase4.md` | Guió de proves internes abans del tall de domini | Fase 4 tancada (02/08/2026), els 10 blocs en verd | El guió mateix, si mai cal repetir una ronda de proves equivalent |
| `NETEJA_codi_mort.md` | Inventari i decisions de neteja de codi mort | Feina majoritàriament feta; la regla viva i el punt pendent ja són a `CLAUDE.md` i al pla mestre | El criteri complet de què es considera "mort de debò" vs. "adormit a posta" |

## Una decisió que calia rescatar

`HANDOFF_Fase2_Resultats.md` contenia una divergència d'arquitectura que **segueix sent certa
al codi d'avui** i que no era enlloc més:

> FEM-Foto persisteix els punts de la Classificació General a `app_settings` **en el moment de
> finalitzar cada repte**, mentre que l'antiga FEM-Resultats els **recalculava en viu** a cada
> càrrega. Normalment donen el mateix, però no és el mateix mecanisme: el càlcul en viu és més
> robust (no depèn de recordar re-finalitzar un repte si es corregeix un vot a posteriori).

Les pantalles noves de Fase 3 (`computeValoracioGeneralRankingLive()`) ja fan servir el
recàlcul en viu. La pantalla antiga «Classificació General» segueix amb el mecanisme persistit.
Anotat aquí perquè no es perdi amb l'arxiu.
