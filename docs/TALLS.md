# El tall

Un únic canvi pendent, que afecta de cop tots els ~50 socis: repuntar
`femfotografiaelmasnou.cat` (avui l'app antiga, FEM-Reptes) cap a FEM-Foto. Aquest document
existeix perquè, quan arribi el moment, no s'hagi d'improvisar ni reconstruir el pla de
reversió amb pressa.

**Encara no s'ha fet.**

---

## Què canvia per als socis (ja n'estan informats)

Entren a Foto en lloc de Reptes sense haver de fer res —mateix email, mateixa contrasenya—, i hi
troben dues novetats:

1. **Tot el sistema de login**: recuperació de contrasenya per correu, entrada per enllaç màgic,
   sessió persistent. Detall: `docs/AUTENTICACIO.md`.
2. **El sistema de puntuació (0-10 en lloc de 3 criteris)**, amb dos moments diferents:
   - **Els reptes ja tancats** es veuran de seguida, el mateix dia del tall, amb la puntuació
     normalitzada al sistema nou (barra 0-10) en lloc del desglossament de 3 criteris. Els punts
     i posicions no canvien, només com es mostren.
   - **El repte en curs** (avui en fase de pujada) es veurà amb la manera nova, tant per votar
     com per veure'n el resultat, quan s'obri la propera votació. Fins llavors no hi ha cap
     mosaic de votació visible.

   Detall de com funciona: `docs/SISTEMA_PUNTUACIO.md`.

## No és un canvi de DNS (comprovat 28/07/2026)

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

No hi ha `manifest.json` ni service worker al projecte, així que no hi ha cap app instal·lada al
mòbil dels socis amb recursos cachejats que pugui quedar enganxada a la versió antiga. ⚠️ Això
**no** vol dir que no hi hagi risc de cache: sense build step ni bundler, els fitxers JS/CSS es
diuen sempre igual d'un desplegament a l'altre, així que el navegador els pot servir de la seva
pròpia cache HTTP encara que n'hi hagi una versió nova al servidor. Ja ha passat un cop
(02/08/2026, provant Fase 4): una recàrrega forçada ho va resoldre. Les capçaleres
`Cache-Control` (vegeu «Abans») ja el tallen per a qui obre l'app de nou.

## Abans

- [x] Fase 4 (proves internes) tancada — els 10 blocs de `docs/arxiu/PROVES_Fase4.md` en verd.
- [x] Capçaleres `Cache-Control` a `vercel.json` (commit `afaf17a`) — `/`, `/index.html`,
      `/js/(.*)` i `/css/(.*)` serveixen `no-cache, must-revalidate`.
- [x] ~~Detecció de versió en calent~~ — descartada (decisió d'Enric): l'app és d'ús molt poc
      freqüent, no cal.
- [x] Panell de Socis afinat — badge de rol i rol Zampa a desplegable, "Foto pujada"/"Ha Votat"
      eliminades.
- [x] Pas 4d de la migració d'Auth — fet als dos entorns, `docs/arxiu/HISTORIC_Auth_Migracio.md` §1.7.
- [x] Redirect URLs de Supabase, als dos projectes (`fem-foto.vercel.app/**`,
      `localhost:3000/**`, i les dues formes del domini).
- [x] Avisar els socis del canvi (sistema de login i de puntuació) — fet.
- [ ] **Comprovar que les pantalles del sistema nou donen els mateixos punts i posicions que les
      antigues, amb dades reals de Normal.** Ja verificat un cop (29/07/2026, amb una diferència
      d'una posició coneguda i acceptada per Enric — detall a `docs/arxiu/PROVES_Fase4.md`, Annex
      A), però convé repetir la comparació just abans del tall, amb les dades que hi hagi aquell dia.
- [ ] Decidir què es fa amb el **desplegament antic**: reassignar el domini no el mata. FEM-Reptes
      seguirà viva a la seva URL `.vercel.app` i seguirà escrivint al mateix Supabase de
      producció; qui la tingui a marcadors o a la pantalla d'inici del mòbil hi continuarà
      entrant. Cal redirigir-la a FEM-Foto o tombar-la.
- [ ] Captura de la configuració actual del domini als dos projectes de Vercel.
- [ ] **Site URL de Supabase → `https://www.femfotografiaelmasnou.cat`, als dos projectes.**
      Això sí que és del dia del tall, i **no abans**: la Site URL és el destí de reserva quan una
      adreça no encaixa amb l'allowlist, així que canviar-la mentre l'app viu a Vercel desviaria
      correus legítims. Avui val `https://fem-foto.vercel.app` als dos projectes. És el punt que
      de debò pot deixar algú fora si s'oblida.

      ⚠️ **Amb `www`, i les dues formes** (comprovat 28/07/2026). L'àpex
      `femfotografiaelmasnou.cat` no serveix l'app: fa un **308 cap a
      `www.femfotografiaelmasnou.cat`**, que és el host real. Com que l'app construeix l'adreça
      de retorn dels correus amb `window.location.origin`, al domini viu enviarà
      **`https://www.femfotografiaelmasnou.cat`**; si l'allowlist només porta la forma sense
      `www`, Supabase la rebutja i la substitueix per la Site URL, i el soci acaba en un lloc que
      no és el del seu enllaç. Per tant, la Site URL ha de ser la forma **amb `www`**.

      El redirect de l'àpex **sí** que preserva camí, query i fragment, així que un soci que
      escrigui el domini sense `www` no té cap problema. Qui s'hi enganya és el `curl` sense `-L`:
      en comprovar desplegaments en aquest domini, demanar el host `www` o passar `-L`.

## El tall

Un sol pas: repuntar Vercel.

- [ ] Fer-ho en **franja de baix ús**.
- [ ] Vercel: treure el domini de FEM-Reptes i afegir-lo a FEM-Foto (si tots dos són al mateix
      equip, Vercel ofereix el traspàs directe).
- [ ] Esperar que el certificat TLS quedi emès abans de donar-ho per bo.
- [ ] Supabase, als dos projectes: Site URL → `https://www.femfotografiaelmasnou.cat`.
- [ ] Confirmar que el commutador de puntuació (panell d'admin → Puntuació) és **«Nou»** — ja
      hauria de ser-ho, però verificar-ho, no assumir-ho.
- [ ] Verificar el login real d'un compte de **soci real, no d'admin**, des del domini, en mòbil
      i en ordinador.
- [ ] Verificar un correu de recuperació i un enllaç màgic **des del domini**.

## Marxa enrere

Reassignar el domini al projecte de FEM-Reptes i revertir la Site URL de Supabase. Segons, no
hores. El commutador de puntuació es pot tornar a «Antic» per separat, en qualsevol moment des
del panell d'admin, sense relació amb el domini — cap vot es perd en cap dels dos sentits.

---

## Fase 7 — Retirada (posterior, sense pressa)

Un cop FEM-Foto porti temps estable, **arxivar** (no esborrar) els repos i desplegaments de
FEM-Reptes i FEM-Resultats. Fase 2 ja va confirmar que FEM-Foto no té cap dependència en temps
d'execució de FEM-Resultats: es podria esborrar avui i no passaria res.

⚠️ **FEM-Reptes és una altra història**: mentre visqui, comparteix base de dades amb FEM-Foto i
qualsevol canvi d'esquema, de permisos o de RLS l'afecta. Va estar dos dies caiguda per això
(vegeu `docs/REFERENCIA_BD.md` i la secció de riscos del pla). Fins que no s'arxivi, cal
comprovar-la **abans** de tocar res compartit.
