# Sistema de puntuació — 3 criteris → 1 concepte (0-10)

Com funciona avui el canvi de sistema de vot decidit per la reunió de socis (23/07/2026), i les
regles que no s'han de tornar a discutir. El detall tècnic pas a pas de com es va construir
(ja tancat) és a `docs/arxiu/HISTORIC_Fase3_Puntuacio.md`.

## Estat actual

| Pas | Estat |
|---|---|
| Columna `votes.valoracio` + trigger `fem_sync_valoracio()` | ✅ |
| «Valoració Repte» (resultats, lectura) | ✅ |
| «Taula de Classificació» | ✅ |
| «Puntuar Repte» (captura 0-10) | ✅ |
| Commutador `sistema_puntuacio_nou` al panell d'admin (pestanya *Puntuació*) | ✅ |
| **El tall** — commutador en «Nou» a Normal, de manera formal i estable | ⬜ Pendent, fet alhora amb el tall de domini |

Tot el desenvolupament està tancat. **Decidit (05/08/2026): no hi ha un tall de puntuació
independent** — es fa en el mateix moment que el tall de domini, un únic pas. El commutador ja
és a `true` a Normal (resta d'una prova anterior, no el tall fet formalment), i coincideix amb
l'estat que ha de quedar el dia del tall. Checklist completa: `docs/TALLS.md`.

**Què veuran els socis, i quan**: els reptes ja tancats mostraran la puntuació normalitzada al
sistema nou (0-10) des del mateix dia del tall — els punts i posicions no canvien, només com es
mostren. El repte en curs es veurà amb el sistema nou (tant per votar com per veure el resultat)
quan s'obri la propera votació.

## Com funciona

- **Els 3 criteris antics (`creativity`/`theme`/`composition`) mai s'esborren.** `votes.valoracio`
  (0-10) es deriva d'ells amb el trigger `fem_sync_valoracio()` (×10/15). Qui escrigui
  `valoracio` directament ha d'escriure també els tres criteris a `valoracio/2` cadascun — no
  `/3` — o el trigger el trepitja a 0 en el següent INSERT/UPDATE.
- **Cada pantalla afectada té una parella**, construïda en paral·lel sense tocar l'original:
  Votació per estrelles / Puntuar Repte (0-10); Resultat Repte / Valoració Repte; Classificació
  General / Taula de Classificació. Les pantalles noves porten els noms de sempre («Resultat
  Repte», «Classificació General») — el soci no aprèn cap nom nou.
- **Qui es veu ho decideix només el commutador** `app_settings.sistema_puntuacio_nou`, igual per
  a tothom, sense excepció per rol ni per mode Test. Un distintiu `3×5`/`0-10`, visible només
  amb rol admin real, diu quin sistema es mira. Detall de qui veu què: `docs/PANTALLES.md`.
- **Les pantalles antigues no s'esborren mai** — queden ocultes, com a xarxa de seguretat per si
  algun dia cal tornar enrere. No es toquen ni es redissenyen fins la Fase 7 (retirada).
- **Els estats bloquejats no atenuen mai el valor ja triat**, només les alternatives.
- Un repte votat a mitges amb un sistema i acabat amb l'altre dona el mateix resultat des de
  totes dues pantalles: els dos sistemes escriuen a les mateixes files de `votes`, i
  `assignPositionPoints`/`getPointsForPosition` només fan servir la POSICIÓ, mai el rang de la
  nota.

Motor de càlcul, taules i RPC: `docs/REFERENCIA_BD.md`.
