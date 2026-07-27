# Els dos talls pendents

Hi ha dos canvis irreversibles-a-la-pràctica pendents, i cap dels dos té data. Aquest
document existeix perquè, quan arribi el moment, no s'hagi d'improvisar ni reconstruir el pla
de reversió amb pressa.

**Cap dels dos s'ha fet.**

---

## Tall 1 — Sistema de puntuació (Fase 3)

Fer visibles per a tothom les pantalles del sistema nou (0-10) i amagar les del vell (3
criteris). Detall del criteri a `ANALISI_Fase3_Puntuacio.md` §6; inventari de pantalles a
`docs/PANTALLES.md`.

**Principi**: amagar, no esborrar. Les pantalles antigues es queden al codi, ocultes, com a
xarxa de seguretat.

### Abans

- [ ] Decidir què passa amb els reptes que tinguin la **votació oberta** el dia del tall
      (§3.3 de l'anàlisi — encara sense resoldre). Les opcions eren: finestra sense reptes
      actius, o normalitzar també els vots parcials d'un repte en curs.
- [ ] Comprovar que «Valoració Repte» i «Taula de Classificació» donen els mateixos punts i
      posicions que les pantalles antigues, amb dades reals de Normal.
- [ ] Avisar els socis del canvi de sistema de vot (decisió de la reunió del 23/07/2026, però
      la interfície els canviarà de cop).

### El tall

- [ ] Invertir la visibilitat dels `nav-card` (`js/screens/participant.js`).
- [ ] Verificar amb un compte de soci real, no d'admin.

### Marxa enrere

Tornar a invertir la visibilitat dels `nav-card`. No hi ha canvi de dades: els tres criteris
antics (`creativity`/`theme`/`composition`) no s'esborren mai i `valoracio` es deriva d'ells,
així que cap vot es perd en cap dels dos sentits.

---

## Tall 2 — Domini (Fase 6)

Reapuntar `femfotografiaelmasnou.cat`, que avui va a l'app antiga (FEM-Reptes), cap al
projecte Vercel de FEM-Foto.

És el moment més sensible de tot el projecte: a partir d'aquí els ~50 socis entren a l'app
nova sense haver-hi fet res.

### Abans

- [ ] Fase 4 (proves internes) i Fase 5 (validació amb socis) tancades.
- [ ] Tall 1 fet i estable, o decidit explícitament que es fan alhora.
- [ ] Pas 4d de la migració d'Auth tancat (o decidit que pot esperar).
- [ ] Comprovar que l'app antiga i la nova no es trepitgen a la base de dades durant la
      convivència — les dues escriuen al mateix Supabase de producció.
- [ ] Tenir a mà la configuració DNS **actual** (captura o còpia) abans de tocar res.

### El tall

- [ ] Fer-ho en **franja de baix ús**.
- [ ] Reapuntar el DNS.
- [ ] Verificar el login real d'un soci des del domini nou, en mòbil i en ordinador.
- [ ] Verificar que els enllaços de correu (recuperació i enllaç màgic) funcionen des del
      domini: **cal afegir el domini a Site URL i a Redirect URLs de Supabase**, als dos
      projectes, o els enllaços continuaran anant a `fem-foto.vercel.app`.

### Marxa enrere

Tornar a apuntar el DNS a l'app antiga. Compte amb la propagació: no és instantani, i és el
motiu principal per fer-ho en franja de baix ús.

---

## Fase 7 — Retirada (posterior, sense pressa)

Un cop FEM-Foto porti temps estable, **arxivar** (no esborrar) els repos i desplegaments de
FEM-Reptes i FEM-Resultats. Fase 2 ja va confirmar que FEM-Foto no té cap dependència en temps
d'execució de FEM-Resultats: es podria esborrar avui i no passaria res.
