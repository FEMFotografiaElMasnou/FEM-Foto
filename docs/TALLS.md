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

- [ ] **Comprovar que les pantalles del sistema nou donen els mateixos punts i posicions que les
      antigues, amb dades reals de Normal.** Ja verificat un cop (29/07/2026, amb una diferència
      d'una posició coneguda i acceptada per Enric — detall a `docs/arxiu/PROVES_Fase4.md`, Annex
      A), però convé repetir la comparació just abans del tall, amb les dades que hi hagi aquell dia.
- [x] **Desplegar la correcció del 29/07/2026** (l'arrodoniment a 2 decimals de la nota del
      motor nou). **Fet el 29/07/2026**, commit `ab2c3cd`: comprovat que
      `fem-foto.vercel.app/js/features/ranking.js` ja serveix la versió corregida i que l'app
      hi carrega sense errors. Sense això, prémer el commutador hauria reordenat la Classificació
      General dels reptes històrics.
- [ ] Avisar els socis del canvi de sistema de vot (decisió de la reunió del 23/07/2026): la
      interfície els canviarà de cop, encara que els noms de les pantalles no.
- [x] Tenir el codi de la Fase 3 Pas D **desplegat** a `fem-foto.vercel.app`. Sense ell, el
      commutador existeix però la pantalla d'inici no li fa cas. **Fet el 28/07/2026** (commit
      `4641350`; verificat que els cinc mòduls que llegeixen `sistema_puntuacio_nou` —`data.js`,
      `router.js`, `state.js`, `admin.js`, `participant.js`— ja se serveixen des d'allà).

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
antiga. ⚠️ Això **no** vol dir que no hi hagi risc de cache: sense build step ni bundler, els
fitxers JS/CSS es diuen sempre igual d'un desplegament a l'altre (`js/screens/login.js` no porta
mai un hash al nom), així que el navegador els pot servir de la seva pròpia cache HTTP encara que
n'hi hagi una versió nova al servidor — sense cap app instal·lada de per mig. Trobat de debò el
02/08/2026 (Enric, provant Fase 4): una pestanya amb l'app carregada d'abans d'un desplegament
mostrava un rètol ja retirat del codi ("Primera configuració"); una recàrrega forçada ho va
resoldre. Ja ha generat consultes reals dels socis abans d'ara — vegeu el punt següent.

### Abans

- [x] **Fase 4 (proves internes) tancada** — **FET el 02/08/2026**, els 10 blocs de
      `docs/arxiu/PROVES_Fase4.md` en verd. ~~Fase 5 (validació amb socis)~~ **suprimida (04/08/2026,
      decisió d'Enric)**: els socis no tenen el nivell tècnic per a aquest tipus de validació: la
      real ja passa en línia amb en Pablo durant tot el desenvolupament, i cada "fes commit i push"
      d'Enric és el punt on ho dona per prou validat. Vegeu
      `FEM-Foto_Unificacio_Pla-desenvolupament.md` §5.
- [x] **Capçaleres `Cache-Control` a `vercel.json`** — **FET el 03/08/2026** (commit `afaf17a`):
      `/`, `/index.html`, `/js/(.*)` i `/css/(.*)` serveixen ara `no-cache, must-revalidate`, així
      que qui carrega (o recarrega) l'app sempre revalida amb el servidor abans de fer servir la
      seva cache. Això talla el cas de soca-rel: **qui obre l'app de nou** (la majoria de vegades)
      ja no pot quedar-se amb `index.html`/JS/CSS vells.
- [x] ~~**Detecció de versió en calent**~~ — **descartada (04/08/2026, decisió d'Enric)**. Cobriria
      qui ja tenia una pestanya oberta abans d'un desplegament, cas que les capçaleres de cache no
      arriben a tallar. Descartada perquè l'app és d'ús molt poc freqüent (2-3 setmanes cada ~2
      mesos): entre un repte i el següent hi ha temps de sobres perquè l'entrada i sortida
      esporàdica normal ja renovi l'app tota sola.
- [x] **Panell de Socis afinat** — **FET el 02/08/2026**. Els tres punts detallats a
      `FEM-Foto_Unificacio_Pla-desenvolupament.md` §8: badge de rol → desplegable de 3 opcions a
      la taula, columna nova de rol Zampa (3 opcions), i "Foto pujada"/"Ha Votat" eliminades.
- [ ] Tall 1 fet i estable, o decidit explícitament que es fan alhora.
- [x] **Pas 4d de la migració d'Auth** — **FET als dos entorns (04/08/2026)**,
      `docs/arxiu/HISTORIC_Auth_Migracio.md` §1.7.
- [x] **Redirect URLs de Supabase, als dos projectes** — **FET el 29/07/2026**. Hi ha les 4
      entrades a `FEM_Reptes` (Normal) i a `FEM_Reptes-test` (Test): `fem-foto.vercel.app/**`,
      `localhost:3000/**`, `www.femfotografiaelmasnou.cat/**` i `femfotografiaelmasnou.cat/**`.
      Fer-ho per avançat és inert: les Redirect URLs només **autoritzen** destinacions, i qui
      tria la destinació és el `redirectTo` que envia l'app (`_emailRedirectTo()`, `login.js`),
      que mentre l'app se serveixi des de Vercel seguirà demanant Vercel. Comprovat també que
      l'app antiga no pot generar cap correu que hi caigui: al repo de FEM-Reptes (`0772b63`)
      no hi ha cap crida a `resetPasswordForEmail`, `signInWithOtp` ni cap `emailRedirectTo`.
- [ ] **Site URL de Supabase → `https://www.femfotografiaelmasnou.cat`, als dos projectes.**
      Aquest punt sí que és del dia del tall, i **no abans**: la Site URL és el destí de reserva
      quan una adreça no encaixa amb l'allowlist, així que canviar-la mentre l'app viu a Vercel
      desviaria correus legítims. Avui val `https://fem-foto.vercel.app` als dos projectes.
      És el punt que de debò pot deixar algú fora si s'oblida.

      ⚠️ **Amb `www`, i les dues formes** (comprovat 28/07/2026). L'àpex
      `femfotografiaelmasnou.cat` no serveix l'app: fa un **308 cap a
      `www.femfotografiaelmasnou.cat`**, que és el host real. Com que l'app construeix l'adreça
      de retorn dels correus amb `window.location.origin` (`_emailRedirectTo()`, `login.js`), al
      domini viu enviarà **`https://www.femfotografiaelmasnou.cat`**; si l'allowlist només porta
      la forma sense `www`, Supabase la rebutja i la substitueix per la Site URL, i el soci acaba
      en un lloc que no és el del seu enllaç. Per tant, la Site URL ha de ser la forma **amb
      `www`**: `https://www.femfotografiaelmasnou.cat`. (La part de Redirect URLs d'aquest
      raonament ja està resolta al punt anterior, amb les dues formes autoritzades.)

      El redirect de l'àpex **sí** que preserva camí, query i fragment (verificat amb
      `?db=normal#access_token=…`), així que un soci que escrigui el domini sense `www` no té cap
      problema. Qui s'hi enganya és el `curl` sense `-L`, que torna "Redirecting..." en lloc del
      fitxer: en comprovar desplegaments en aquest domini, demanar el host `www` o passar `-L`.
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
