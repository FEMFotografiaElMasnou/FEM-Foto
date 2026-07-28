# Els dos talls pendents

Hi ha dos canvis pendents que afecten de cop tots els socis. Aquest document existeix perquè,
quan arribi el moment, no s'hagi d'improvisar ni reconstruir el pla de reversió amb pressa.

**Cap dels dos s'ha fet.**

Des del 28/07/2026 el Tall 1 ha deixat de ser un canvi de codi: és **un clic al panell d'admin**,
i tornar enrere també. El Tall 2 continua sent el moment sensible del projecte, però resulta que
tampoc no toca cap DNS — vegeu-ho més avall.

---

## Tall 1 — Sistema de puntuació (Fase 3)

Fer que els socis passin de votar amb 3 criteris (0-5 cadascun) a votar amb una sola puntuació
(0-10), i que les pantalles de resultats corresponguin al sistema actiu.

**Com es fa avui**: panell d'admin → **Puntuació** → triar «Nou · 1 puntuació». El valor viu a
`app_settings.sistema_puntuacio_nou` (migració `sql/2026-07-27_fase3_commutador.sql`), un per
base de dades, i el llegeix tota l'app. No cal desplegar res.

**Principi**: amagar, no esborrar. Les pantalles antigues es queden al codi i tornen a
aparèixer soles si es torna a posar el commutador en «Antic».

### Abans

- [ ] Comprovar que les pantalles del sistema nou donen els mateixos punts i posicions que les
      antigues, amb dades reals de Normal. *(Ja verificat al Pas 3 de la Fase 3 amb les
      pantalles de comparació; convé repetir-ho just abans del tall.)*
- [ ] Avisar els socis del canvi de sistema de vot (decisió de la reunió del 23/07/2026): la
      interfície els canviarà de cop, encara que els noms de les pantalles no.
- [ ] Tenir el codi de la Fase 3 Pas D **desplegat** a `fem-foto.vercel.app`. Sense ell, el
      commutador existeix però la pantalla d'inici no li fa cas.

> **La pregunta que abans bloquejava això ja no bloqueja.** Es preguntava què fer amb els reptes
> que tinguessin la votació oberta el dia del tall. Amb el commutador, la resposta és que no cal
> fer-hi res: els dos sistemes escriuen les mateixes dades a `votes` (el sistema nou desa
> `valoracio` i reparteix els 3 criteris antics; l'antic desa els 3 criteris i el trigger en
> deriva `valoracio`), així que un repte a mig votar surt bé de totes dues maneres. Tot i això,
> el criteri d'Enric és fer el canvi **entre la pujada i l'inici de la votació**, que evita que
> ningú vegi canviar la pantalla a mitja feina. El panell d'admin avisa si hi ha votació oberta.

### El tall

- [ ] Fer-ho preferentment amb cap votació oberta.
- [ ] Panell d'admin → Puntuació → «Nou · 1 puntuació».
- [ ] Verificar amb un compte de **soci real, no d'admin** (l'admin veu distintius `3×5`/`0-10`
      que el soci no veu, i és fàcil confondre's).

### Marxa enrere

Tornar al mateix lloc i prémer «Antic · 3 criteris». Efecte immediat, sense desplegar.
Cap vot es perd en cap dels dos sentits: els tres criteris antics no s'esborren mai i
`valoracio` es deriva d'ells.

---

## Tall 2 — Domini (Fase 6)

Fer que `femfotografiaelmasnou.cat`, que avui serveix l'app antiga (FEM-Reptes), passi a servir
FEM-Foto. A partir d'aquí els ~50 socis entren a l'app nova sense haver fet res.

### No és un canvi de DNS (comprovat 28/07/2026)

El domini **ja està delegat a Vercel**:

```
femfotografiaelmasnou.cat      → 216.198.79.1              (IP de Vercel)
www.femfotografiaelmasnou.cat  → …vercel-dns-017.com
```

(els registres viuen a Nominalia; l'apex redirigeix a `www`). Per tant el tall consisteix a
**reassignar el domini d'un projecte de Vercel a l'altre**: treure'l de FEM-Reptes i afegir-lo a
FEM-Foto. A Nominalia no s'hi ha de tocar res.

Conseqüència: **no hi ha propagació de DNS a esperar, ni a l'anada ni a la tornada**. La marxa
enrere és qüestió de segons. La franja de baix ús segueix sent bona idea, però pel motiu
correcte: mentre Vercel emet el certificat TLS per al projecte nou hi ha una finestra petita en
què el domini pot donar error.

No hi ha `manifest.json` ni service worker al projecte, així que tampoc no hi ha cap app
instal·lada al mòbil dels socis amb recursos cachejats que pugui quedar enganxada a la versió
antiga.

### Abans

- [ ] Fase 4 (proves internes) i Fase 5 (validació amb socis) tancades.
- [ ] Tall 1 fet i estable, o decidit explícitament que es fan alhora.
- [ ] Pas 4d de la migració d'Auth tancat (o decidit que pot esperar).
- [ ] **Afegir el domini a Site URL i a Redirect URLs de Supabase, als dos projectes.** Sense
      això, els correus de recuperació i els enllaços màgics continuaran portant a
      `fem-foto.vercel.app`. És el punt que de debò pot deixar algú fora.
- [ ] Decidir què es fa amb el **desplegament antic**: reassignar el domini no el mata. FEM-Reptes
      seguirà viva a la seva URL `.vercel.app` i seguirà escrivint al mateix Supabase de
      producció; qui la tingui a marcadors o a la pantalla d'inici del mòbil hi continuarà
      entrant. Cal redirigir-la a FEM-Foto o tombar-la.
- [ ] Captura de la configuració actual del domini als dos projectes de Vercel.

### El tall

- [ ] Fer-ho en **franja de baix ús**.
- [ ] Vercel: treure el domini de FEM-Reptes i afegir-lo a FEM-Foto (si tots dos són al mateix
      equip, Vercel ofereix el traspàs directe).
- [ ] Esperar que el certificat TLS quedi emès abans de donar-ho per bo.
- [ ] Verificar el login real d'un soci des del domini, en mòbil i en ordinador.
- [ ] Verificar un correu de recuperació i un enllaç màgic **des del domini**.

### Marxa enrere

Tornar a assignar el domini al projecte de FEM-Reptes. Segons, no hores.

---

## Fase 7 — Retirada (posterior, sense pressa)

Un cop FEM-Foto porti temps estable, **arxivar** (no esborrar) els repos i desplegaments de
FEM-Reptes i FEM-Resultats. Fase 2 ja va confirmar que FEM-Foto no té cap dependència en temps
d'execució de FEM-Resultats: es podria esborrar avui i no passaria res.

⚠️ **FEM-Reptes és una altra història**: mentre visqui, comparteix base de dades amb FEM-Foto i
qualsevol canvi d'esquema, de permisos o de RLS l'afecta. El 28/07/2026 va estar dos dies caiguda
per això (vegeu `docs/REFERENCIA_BD.md` i la secció de riscos del pla). Fins que no s'arxivi, cal
comprovar-la **abans** de tocar res compartit.
