# Fase 4 — Proves internes

Guió de proves de FEM-Foto **abans** d'ensenyar-la als socis (Fase 5) i abans del tall de domini
(Fase 6). Obert el 29/07/2026.

**Què és aquesta fase**: repassar l'app sencera, un cop, amb criteris escrits, i deixar constància
de què s'ha comprovat i amb què. **Què no és**: la validació amb socis (Fase 5), ni una auditoria
de seguretat (ja feta pels seus passos a `ANALISI_Login_Navegacio.md`).

---

## Regles d'execució

1. **Tot a Test** (`xxydxdsiunfwzkcffdai`), excepte els punts marcats **[N]**, que són lectures
   sense escriptura i es fan a Normal (`ogqqcgbgcqowvywaolln`) perquè el que s'hi comprova són
   *les dades reals*.
2. **Cap escriptura a Normal des d'aquest guió.** Si un punt sembla demanar-la, és que està mal
   escrit: atura't i canvia el guió, no la base.
3. **Servint per HTTP** (`npx serve`, `http://localhost:3000`) o des de
   `https://fem-foto.vercel.app`. Mai per `file://`: els mòduls ES no carreguen.
4. **Els comptes de prova són d'un sol ús** i es donen de baixa en acabar. No es reciclen entre
   blocs: un compte que ja ha votat no serveix per provar "el primer vot".
5. **Una prova negativa d'autorització** (comprovar que algú **no** pot fer una cosa) es fa
   **sempre amb una fila que existeixi de veritat**. Amb un id inventat, la funció surt pel camí
   de "no trobat" i el verd no prova res. Va passar el 27/07/2026.
6. **Cada punt es tanca amb un verd o amb una incidència**, mai amb "sembla que sí". Les
   incidències van a §Registre, al final.

### Preparatius

- [ ] Dos navegadors (o finestra normal + finestra privada) per tenir **dues sessions alhora**:
      una d'admin i una de soci. Fa falta a gairebé tots els blocs.
- [ ] A Test, un repte de treball amb almenys **3 fotos publicades** i **2 socis que hi puguin
      votar**, per poder veure rànquings amb empats i desempats.
- [ ] Saber quin sistema de puntuació té cada base: Test **«Nou» (0-10)**, Normal **«Antic»
      (3×5)**, comprovat el 29/07/2026. Els blocs 5 i 6 demanen commutar Test i tornar-la a
      deixar com estava.

---

## 1 · Accés i sessió

| # | Prova | Verd si |
|---|---|---|
| 1.1 | Entrar amb **email + contrasenya** | Entra i cau a la pantalla del seu rol |
| 1.2 | Entrar amb **nom complet + contrasenya** | Igual que 1.1 (el nom es resol contra `state.users` abans de cridar Auth) |
| 1.3 | Contrasenya equivocada | Missatge d'error clar, **sense** dir si l'usuari existeix |
| 1.4 | Usuari inexistent | Mateix missatge que 1.3 |
| 1.5 | **Sessió persistent**: entrar, tancar la pestanya, tornar a obrir l'app | Segueix dins sense tornar a escriure la contrasenya |
| 1.6 | **Sortir** | Torna al login i, en tornar a obrir l'app, ja **no** hi entra sol |
| 1.7 | **Enllaç màgic** ("Entrar amb un enllaç per correu") | Arriba el correu del remitent del club, l'enllaç entra a l'app i la sessió queda oberta |
| 1.8 | **Recuperació de contrasenya** ("Has oblidat la contrasenya?") | Arriba el correu, deixa posar-ne una de nova, i **la nova entra i la vella ja no** |
| 1.9 | **Auto-registre** amb un email nou | Compte creat i entra tot seguit, sense confirmació ni aprovació. Rol resultant **`participant`** (comprovar-ho a la BD, no fiar-se de la pantalla) |
| 1.10 | Auto-registre amb un email **ja existent** | Error entenedor, i **no** es crea cap segon compte |
| 1.11 | **Reset de l'admin** (panell → Socis → Reset) | Mostra una contrasenya temporal; la temporal entra, **la vella ja no**, i si el soci tenia sessió oberta en una altra finestra, **en queda fora en 30 s com a màxim, sense tocar-la** |

> 1.8 i 1.11 comproven el mateix invariant per dos camins: la contrasenya s'escriu a
> `public.users` **i** a `auth.users` alhora. És l'única cosa que ha fallat quatre vegades en
> aquest projecte (§B de `ANALISI_Login_Navegacio.md`). Si algun dels dos punts es posa vermell,
> és un blocador, no una molèstia.

**Bloc 1 tancat el 29/07/2026.** Els onze punts en verd, amb dues coses trobades pel camí: el
Reset no expulsava la finestra oberta fins que el testimoni caducava (**incidència 1.11**,
corregida i verificada, Annex B), i «Sortir» resulta que tanca la sessió **també al servidor**,
que és més del que demanava el criteri. Comprovat a més, per SQL, que a Test i a Normal **totes**
les contrasenyes coincideixen entre `public.users` i `auth.users` (51/51 i 41/41, cap compte
sense parella a `auth.users`).

---

## 2 · Rols i visibilitat

| # | Prova | Verd si |
|---|---|---|
| 2.1 | Soci `participant` | Veu la pantalla de participant i **cap camí d'interfície** cap al panell d'admin. ✅ Verificat el 29/07/2026 (a la pantalla i al codi: `_enterApp()` reparteix per rol i `toggleAdminParticipantView()` surt si el rol no és admin). Matís escrit a posta: `window.showAdminScreen` no comprova el rol, així que des de la **consola** del navegador se'n pot pintar la carcassa. No exposa dades noves (la llista de socis ja la carrega tothom, el login per nom la necessita) i les escriptures les rebutja el servidor (RLS + `fem_is_admin()`) |
| 2.2 | `admin` | Té accés a **les 5 seccions del sidebar** (Fotos, Reptes, Socis, Textos, Puntuació) i pot entrar a totes. ✅ Verificat el 29/07/2026: en són cinc, i són les que han de ser des de la compactació del panell (Votacions, Controls i Calendari es van moure a cada targeta de repte el 18/07/2026, a petició de Pablo) |
| 2.3 | `expert` | Entra com un participant normal. **L'únic efecte del rol és el filtre de vots** (bloc 7) |
| 2.4 | Admin → **"veure com a participant"** | Les targetes de resultats són les que toquen **segons el commutador**, no segons el rol (això és el que va canviar al Pas D). **Dues excepcions legítimes**, que depenen del rol **real** i per tant no desapareixen en aquest mode: el distintiu `3×5`/`0-10` (hi ha de ser: serveix precisament per saber quina pantalla es revisa) i la targeta de Galeria, que l'admin també veu quan hi ha repte **actiu** i encara no cap de finalitzat |
| 2.5 | Distintiu `3×5`/`0-10` | El veu **qui té rol admin real** i **mai** un soci, i diu el sistema actiu a cada targeta de les parelles. A Galeria no n'hi ha d'haver: el commutador no l'afecta |
| 2.6 | `force_hide_upload`, `force_hide_vote`, `force_hide_resultats`, `force_hide_classificacio` | ⚠️ **Aquest punt estava mal plantejat i queda reformulat** (29/07/2026): aquests quatre valors **ja no es poden tocar des de la interfície** — no hi ha cap control a `index.html`, perquè es van retirar amb la compactació del panell. Avui només es poden canviar per SQL. El que sí que s'ha comprovat, i és el que importa, és que **tots quatre valen `false` a les dues bases**, o sigui que no estan amagant res en silenci. El codi que els llegeix segueix viu (`participant.js`, `fotos.js`) i funcionaria si algú els posés a `true` per SQL |

---

## 3 · Repte i calendari

| # | Prova | Verd si |
|---|---|---|
| 3.1 | Crear un repte des del panell (Reptes) | Es crea amb `status = active` i surt a la pantalla del soci |
| 3.2 | `upload_mode` i `voting_mode` a **`obert`** i a **`tancat`** | Manen sobre les dates: obert deixa fer sempre, tancat no deixa mai |
| 3.3 | `upload_mode`/`voting_mode` = **`calendari`** amb finestres passades i futures | `uploads_enabled`/`voting_enabled` acaben coherents amb les finestres |
| 3.4 | **Cron `fem-calendar`** (00:05 UTC, `fem_apply_calendar()`) | Executada a mà a Test, deixa els estats efectius com toca i **no** toca cap repte `finished` |
| 3.5 | Imatge de portada del repte: posar-la i treure-la | Es veu i desapareix, sense deixar l'URL penjat |
| 3.6 | Finalitzar un repte | Passa a `finished`, apareix a Galeria i a la Classificació General |

---

## 4 · Pujada de fotos

| # | Prova | Verd si |
|---|---|---|
| 4.1 | Soci puja una foto amb la pujada oberta | Puja a Cloudinary i queda visible per a ell, **no** per als altres fins a publicar-la |
| 4.2 | Pujar amb la pujada **tancada** | No hi ha camí per fer-ho |
| 4.3 | Segona foto del mateix soci al mateix repte | El comportament és el que espera l'admin (substitueix o rebutja) i és **el mateix** que fa l'app antiga |
| 4.4 | Editar el peu de foto (`caption`) | Es desa i es veu on toca |
| 4.5 | El soci esborra **la seva** foto | Desapareix. Provar també que **no** pot esborrar la d'un altre (prova negativa, amb una foto real d'un altre soci) |
| 4.6 | Admin: **Publicar Fotos** | `published` a totes les seleccionades; a partir d'aquí les veu tothom |
| 4.7 | Admin: esborrar seleccionades | Només les marcades |
| 4.8 | Admin: **Descarregar Totes** | Baixa les de la pantalla, amb els filtres aplicats |
| 4.9 | Noms revelats (`names_revealed`) | Amb `false` no es veu qui ha fet cada foto en cap pantalla; amb `true`, sí |

---

## 5 · Votació — sistema antic (3 criteris)

Amb el commutador de Test a **«Antic»**.

| # | Prova | Verd si |
|---|---|---|
| 5.1 | Votar les 3 estrelles d'una foto | Cada clic es desa tot sol (no hi ha "desar" per foto) |
| 5.2 | Sortir a mitja votació i tornar | Els vots posats hi segueixen, i el repte consta com a **esborrany** (`seguiment_votacio.es_esborrany = true`) |
| 5.3 | **Enviar Vots** | `es_esborrany` passa a `false` amb `submitted_at`, i la interfície ho reflecteix |
| 5.4 | Tornar a entrar després d'enviar | No deixa tornar a votar el mateix repte |
| 5.5 | Votar la **pròpia** foto | No es pot |
| 5.6 | Votar amb la votació tancada | No hi ha camí, i una crida directa tampoc no cola (prova negativa amb un repte real tancat) |
| 5.7 | El trigger `fem_sync_valoracio()` | Cada vot desat deixa `valoracio = (suma dels 3) × 10/15`, amb decimals, **sense arrodonir** |

---

## 6 · Votació — sistema nou (0-10)

Amb el commutador de Test a **«Nou»**, que és com està ara.

| # | Prova | Verd si |
|---|---|---|
| 6.1 | El mosaic de votació porta a la captura 0-10 | Mateixa targeta que al sistema antic; només canvia on va |
| 6.2 | Posar una puntuació 0-10 | Es desa al clic, com al 5.1 |
| 6.3 | Esborrany i **Enviar Vots** | Igual que 5.2 i 5.3: mateixa taula, mateix camp |
| 6.4 | **La trampa del trigger** | Un vot desat pel sistema nou deixa `valoracio` amb el valor triat **i** els 3 criteris a `valoracio/2` cadascun. Si `valoracio` torna trepitjada, el codi ha escrit només ella |
| 6.5 | Un repte votat **a mitges** amb un sistema i acabat amb l'altre | Els punts i les posicions surten bé des de totes dues pantalles. És el supòsit del dia del tall |
| 6.6 | Puntuacions decimals ja existents (venen de vots antics) | Es mostren i s'ordenen bé, no es trunquen a enter |

---

## 7 · Resultats, rànquing i Classificació General

| # | Prova | Verd si |
|---|---|---|
| 7.1 | **[N]** Motor nou contra motor antic, **repte per repte, amb dades reals de Normal** | Mateixos punts i **mateixes posicions** a tots els reptes finalitzats. Aquesta la faig jo per SQL i deixo la sortida aquí |
| 7.2 | Filtre de votants: **Tots / Socis / Vot expert** | `socis` = tothom que no és expert (participants **i** admins); `expert` = només rol expert |
| 7.3 | Un repte **sense cap vot d'expert** | La pestanya d'expert no apareix (o no dona un rànquing buit disfressat de vàlid) |
| 7.4 | Empat de puntuació | El desempat és el mateix a les dues pantalles i el mateix que fa l'app antiga |
| 7.5 | Taula de punts per posició (25, 18, 15, 12, 10, 8, 7, 6, 5, 4…) | Coincideix amb `app_settings` i amb l'app antiga |
| 7.6 | Classificació General amb un soci que **no ha participat** en algun repte | Compta 0 en aquell repte, i no desapareix de la taula |
| 7.7 | `rankingHidden` | Amaga el rànquing on toca, sense trencar la resta de la pantalla |

---

## 8 · Galeria, textos i idioma

| # | Prova | Verd si |
|---|---|---|
| 8.1 | Galeria amb els filtres (repte, autor) | Els filtres fan el que diuen i el comptador quadra |
| 8.2 | Lightbox: obrir, passar fotos, descarregar, tancar | Funciona amb ratolí **i** en mòbil |
| 8.3 | Canviar **CA ↔ ES** a totes les pantalles | Cap text es queda en l'altre idioma ni surt la clau crua (`login_user_placeholder` i companyia) |
| 8.4 | Textos: **Desar a la base activa** i **Desar a les dues bases** | El canvi es veu, i el de "les dues" arriba de veritat a Normal (llegir `app_texts` per confirmar-ho) |
| 8.5 | `app_texts` guanya a `i18n.js` | Assumit i comprovat: si una clau és a la BD, el codi no pinta res. Que no ens torni a sorprendre |

---

## 9 · Panell de Socis

| # | Prova | Verd si |
|---|---|---|
| 9.1 | Alta de soci ("Nou Soci") | Es creen **les dues** files (`public.users` i `auth.users`) i el soci entra a la primera |
| 9.2 | Baixa de soci | Desapareixen **les dues** files. ⚠️ Comprovar que **no** s'ha endut res de Zampa |
| 9.3 | Canvi d'email | Sincronitzat a `public.users`, `auth.users` i `auth.identities`; el soci entra amb el nou i **no** amb el vell |
| 9.4 | Un admin canvia la contrasenya d'un soci | La nova entra, la vella no |
| 9.5 | Un soci es canvia **la seva** | Igual, i la identitat surt **només** d'`auth.uid()` |
| 9.6 | Proves negatives: un `participant` intentant 9.1–9.4 sobre **un soci real** | Denegat sempre, també cridant la RPC a pèl amb la clau anon |

---

## 10 · Commutador i coexistència amb l'app antiga

| # | Prova | Verd si |
|---|---|---|
| 10.1 | Commutar a «Nou» i a «Antic» a Test | Efecte immediat en recarregar la pantalla del soci, sense desplegar |
| 10.2 | Avís de votació oberta al panell de Puntuació | Surt quan hi ha una votació en marxa |
| 10.3 | Commutador de base de dades Normal/Test a la UI | Canvia de base de debò (banner de Test visible) i no deixa dades barrejades |
| 10.4 | **FEM-Reptes segueix sana** | Amb l'app antiga en viu: carrega la llista de socis, deixa entrar, deixa votar i deixa pujar. Cap `permission denied` a la consola |
| 10.5 | Zampa | Fora d'abast aquí (té la seva pròpia nota de traspàs), però **no es toca res compartit** durant la Fase 4 |

> 10.4 no és opcional ni és cortesia: és l'app que fan servir els socis avui i comparteix base de
> dades amb aquesta. Ja va quedar caiguda dos dies per un canvi fet des d'aquí (26→28/07/2026).

---

## Fora d'abast, a posta

- **Navegació** (refrescar torna a l'inici, el botó enrere surt de l'app). Conegut, sense
  començar, proposta a `ANALISI_Login_Navegacio.md` §2.3. **No** es compta com a incidència
  d'aquesta fase.
- **Pas 4d** de la migració d'Auth: bloquejat per Zampa.
- **Site URL de Supabase**: es canvia el dia del tall, no abans (`docs/TALLS.md`).
- El **redisseny** de les pantalles de resultat per al sistema d'1 concepte: backlog, no regressió.

---

## Registre

Una fila per incidència trobada. Si un punt es tanca en verd, s'hi marca la casella i prou.

| Data | Punt | Què passa | Blocador? | Estat |
|---|---|---|---|---|
| 29/07/2026 | **1.11** | El Reset de l'admin **no feia fora a l'instant** el soci que tingués l'app oberta: seguia dins, i podent escriure, fins que el testimoni d'accés (JWT) intentava renovar-se (fins a una hora). Al servidor la revocació sí que es feia. Diagnòstic i solució a l'**Annex B** | No blocador del tall, però era una promesa que la documentació donava per bona | **Corregit** el 29/07/2026: el sondeig de 30 s valida la sessió contra el servidor. Verificat a la interfície |
| 29/07/2026 | **7.1** | El sistema nou **no** donava les mateixes posicions que l'antic al repte «Escales» de Normal: 19 posicions de 23 canviaven i la Classificació General es movia. Diagnòstic i solució a l'**Annex A** | **Sí** — blocava el Tall 1 | **Corregit** (arrodoniment a 2 decimals a `getPhotoValoracio()`). Verificat amb el codi real, amb SQL i **a la interfície** (29/07, amb un repte de prova a Test que reprodueix l'empat); queda **1** diferència, explicada a l'Annex A i pendent de la teva confirmació |

**Criteri de tancament de la Fase 4**: tots els punts amb casella marcada, i cap incidència
blocadora oberta. Les no blocadores poden passar al backlog del pla amb el seu número de punt.

---

## Annex A — Incidència 7.1: el sistema nou reordena els reptes històrics

Trobat el 29/07/2026 executant el punt 7.1 per SQL sobre **Normal**, en lectura. Cap escriptura.

### El fet

Comparant, repte per repte i foto per foto, la posició que dona el motor antic (3 criteris) amb
la que dona el motor nou (`valoracio`), amb el mateix conjunt de votants i el mateix pool de fotos
que fa servir l'app:

| Repte | Fotos | Posicions diferents |
|---|---|---|
| Dominant vermell | 19 | 0 |
| Dominant verda | 23 | 0 |
| Dominant blava | 21 | 0 |
| **Escales** | 23 | **19** |

A Test no es reprodueix: només té un repte finalitzat i amb 8 notes distintes, massa poc per
xocar-hi. **Per això no s'havia vist.**

Efecte a la Classificació General (mateix càlcul de punts per posició, `scope = 'all'`):

| Soci | Punts avui | Punts amb el sistema nou | |
|---|---|---|---|
| Aina Ricart i Ramon | 31,0186 | 28,0285 | −2,99 |
| Jordi Roma | 32,0090 | 30,0090 | −2,00 |
| Esteve De La Paz | 20,0191 | 18,0191 | −2,00 · i **baixa del 4t al 5è lloc** |
| Jesús Grinyó i Quer | 15,0190 | 14,0190 | −1,00 · **7è → 8è** |
| Marta Inchausti, Maribel Grau, Laura Pérez | | | −1,00 cadascuna |
| Nuria Pleguezuelo | | | **5è → 4t** |
| Julien Plaquet | | | **8è → 7è** |

No és cosmètic: canvia l'ordre de la Classificació General de socis reals.

### La causa

El trigger `fem_sync_valoracio()` desa `round((c+t+comp)*10.0/15, 2)`, i la columna
`votes.valoracio` és `numeric(4,2)`. Sense l'arrodoniment, la nota nova d'una foto seria
**exactament el doble** de l'antiga (`(c+t+comp)/3 × 2`), i per tant l'ordre i les posicions
serien idèntics per àlgebra, sense haver de comprovar res.

Amb l'arrodoniment a 2 decimals, cada vot arrossega un residu de fins a ±0,0033. Els residus no
es cancel·len, i **trenquen els empats exactes** del sistema antic. A «Escales» n'hi havia tres:

| Empatats a la posició | Suma de criteris | `valoracio` acumulada |
|---|---|---|
| 4 — Marta Albertí / Jordi Roma | 266 i 266 | 177,34 vs 177,32 |
| 16 — José Antonio Sancho / Toni Garcia | 195 i 195 | 130,02 vs 129,99 |
| 20 — Maribel Nuñez / Juan Loewe | 165 i 165 | 110,00 vs 109,99 |

⚠️ La tercera parella **no empata dins l'app**, tot i sumar el mateix: el motor antic la separa
per un artefacte de coma flotant (vegeu «El detall del tercer empat», més avall).

Cada empat trencat empeny una posició avall tothom qui ve després (les posicions són denses), i
d'aquí surten les 19 diferències. **Qui guanya cada desempat el decideix el residu de
l'arrodoniment**, no res que tingui a veure amb les fotos.

Els altres tres reptes no es mouen perquè els seus empats surten de fotos amb la **mateixa**
distribució de criteris: mateix arrodoniment, mateix residu, empat conservat.

### Solució aplicada (29/07/2026)

**El motor nou ordena per la nota arrodonida a 2 decimals**, que és exactament la que es mostra a
la pantalla. Una línia a `getPhotoValoracio()` ([ranking.js](../js/features/ranking.js)): ni
migració, ni canvi de trigger, ni de tipus de columna. Per tant **no toca res compartit amb
FEM-Reptes ni amb Zampa**, que és el que interessa mentre convisquin.

Resultat a «Escales», replicant l'aritmètica de coma flotant del navegador:

| | Posicions diferents de l'antic |
|---|---|
| Abans del canvi | **19** de 23 |
| Després del canvi | **1** de 23 |

Als altres tres reptes: 0 diferències, abans i després. Arrodonir a 1 decimal, en canvi, seria
molt pitjor (21 diferències a «Escales» i 15-18 als altres): fusionaria notes que sí que són
distintes.

**Què no és aquesta solució**: no és una garantia algebraica, és una comprovació empírica sobre les
86 fotos dels 4 reptes finalitzats de Normal. Dues fotos que en el futur difereixin menys de
0,005 punts quedaran empatades i compartiran posició. Es considera preferible: coincideix amb el
que veu el soci, que si dues fotos mostren la mateixa nota comparteixin posició.

### El detall del tercer empat (la diferència que queda)

La comparació per SQL amb precisió exacta deia que «Escales» tenia tres empats. Executant el codi
real de `ranking.js` a Node amb els vots reals d'aquelles fotos, resulta que **el motor antic no
empata la tercera parella**: dona 2,11538461538462 i 2,11538461538461, una diferència d'**un sol
ulp** (4·10⁻¹⁶). Ve d'arrodonir cada criteri per separat abans de sumar-los; és determinista
—comprovat amb 200 ordres de vots diferents, sempre el mateix resultat— però arbitrari, i cap dels
dos socis pot veure-ho: tots dos mostren «2,12».

Conseqüència de deixar-ho així:

| Soci | Posició avui | Posició amb el sistema nou | Punts |
|---|---|---|---|
| Juan Loewe Tarmann | 20 | 20 | 1,0090 → 1,0090 |
| Maribel Nuñez de Murga | 21 | **20** (empatada) | 1,0089 → **1,0090** |

**Acceptat per Enric el 29/07/2026.** Les dues fotos sumen exactament els mateixos punts de criteris
(165); que avui no empatin és el defecte, no la referència. El guany per a Maribel és de 0,0001
punts, no mou ningú de lloc a la Classificació General, i corregir-ho demanaria tocar el motor
antic —que és el que els socis ja han vist i que al tall queda amagat.

### Com s'ha verificat

- **Codi real a Node**: còpia de `js/features/ranking.js` generada amb `sed` (només les 4 línies
  d'`import` canviades per stubs), alimentada amb les files reals de Normal de les 6 fotos
  empatades i els 26 votants. Abans del canvi: 5 posicions de 6 diferents. Després: 1, i és la
  parella de l'ulp. El banc de proves viu al directori de treball de la sessió, fora del repo; si
  es vol conservar, val la pena decidir on.
- **SQL sobre Normal, en lectura**: comparació repte per repte i foto per foto, amb precisió
  exacta i replicant també la coma flotant del navegador.
- **A la interfície, per Enric (29/07/2026, verd)**: notes i decimals correctes, commutació entre
  sistemes sense sorpreses, i **empat de punts = mateixa posició**. Amb un repte de prova muntat a
  Test expressament (dues fotos amb els mateixos totals per criteri —12/12/12— però repartiments
  per vot diferents, 13/13/10 contra 12/12/12, que és el que feia divergir la `valoracio`
  acumulada: 24,01 contra 24,00): les dues empaten a la 1a posició amb els dos sistemes, i la
  tercera queda 2a amb tots dos. Verificat també a la Classificació General de Test, sumant els
  punts repte per repte (33 / 32 / 28, idèntics amb «Antic» i amb «Nou»). Sense la correcció,
  aquell empat es trencava i la tercera foto queia a la 3a posició.
  Scripts de les dades de prova i de la seva marxa enrere: al directori de treball de la sessió.

---

## Annex B — Incidència 1.11: la revocació de sessions és diferida

Trobada el 29/07/2026 executant el punt 1.11 a Test, amb un compte d'un sol ús.

### El fet

Amb el compte de proves amb la sessió oberta en una finestra, un admin li fa **Reset** des del
panell de Socis. La finestra del soci **segueix activa**, i **recarregar la pàgina tampoc no la fa
fora**.

Al servidor, en canvi, tot s'ha fet:

| Comprovació | Resultat |
|---|---|
| Contrasenya nova a `public.users` i a `auth.users` | sí, i coincideixen |
| Contrasenya anterior | ja **no** valida |
| `auth.sessions` del soci | **0** |
| `auth.refresh_tokens` del soci | **0** |

### La causa

Supabase valida cada petició amb el **testimoni d'accés (JWT)** que el navegador ja té: la RLS en
llegeix `auth.uid()` a partir de la **signatura**, sense consultar `auth.sessions`. Per tant:

- Esborrar les files de sessió no invalida un testimoni ja emès.
- Recarregar la pàgina no ajuda: el SDK llegeix el testimoni de `localStorage` i, si no és a prop
  de caducar, no parla amb el servidor.
- El sondeig d'auto-refresc de l'app (cada 30 s, `startAutoRefresh()` a
  [router.js](../js/core/router.js)) fa consultes de **dades**, que amb un JWT vàlid funcionen: no
  detecta res.
- Qui acaba expulsant la finestra és el **primer intent de renovació** del testimoni: el refresh
  token ja no existeix, el SDK emet `SIGNED_OUT`, i `_listenAuthChanges()`
  ([login.js](../js/screens/login.js)) torna a la pantalla d'accés amb l'avís de sessió caducada.

O sigui: **la revocació funciona, però arriba tard** — fins a la durada del testimoni d'accés (el
valor per defecte de Supabase és 3600 s; el real es llegeix al tauler, Authentication → Sessions).
Mentrestant aquell soci pot seguir llegint **i escrivint**.

### Per què no s'havia vist el 28/07

Perquè es va verificar el que es podia verificar per SQL i per crida directa: que les files de
sessió havien desaparegut i que un **intent de renovació** donava `refresh_token_not_found`. Totes
dues coses són certes. El que no es va provar és el que ara s'ha provat: una finestra ja oberta,
sense tocar-la. És la mateixa lliçó del 27/07 amb les proves negatives, en una altra forma: **una
comprovació al servidor no demostra el que passa al client.**

### Opcions

1. **Afegir una validació de sessió al sondeig de 30 s**: cridar `sb.auth.getUser()` (que sí que
   va al servidor) i, si falla, forçar la sortida. Expulsió en menys de 30 s, cost d'una crida
   extra cada mig minut. És l'opció recomanada si es vol arreglar.
2. **Escurçar la caducitat del testimoni** al tauler de Supabase (per exemple 900 s). Acota la
   finestra per a tothom, a canvi de més renovacions. Es pot combinar amb l'1.
3. **Acceptar-ho i deixar-ho escrit.** Defensable: el cas d'ús normal del Reset és un soci que ha
   perdut l'accés, no un compte segrestat. Deixa de ser defensable el dia que el Reset es faci
   servir *per* fer fora algú.

Cap de les tres bloca el tall de domini. La correcció dels documents que prometien una expulsió
immediata (`docs/REFERENCIA_BD.md` i `ANALISI_Login_Navegacio.md` §1.5) sí que s'ha fet ja.

### Solució aplicada (29/07/2026): l'opció 1

Enric va triar l'opció 1. Al sondeig de 30 s d'`startAutoRefresh()`
([router.js](../js/core/router.js)) s'hi ha afegit una validació de la sessió contra el servidor
(`sb.auth.getUser()`) i, si el servidor la rebutja, es tanca la sessió local; el listener
`_listenAuthChanges()` de [login.js](../js/screens/login.js) ja s'encarrega de portar l'usuari a la
pantalla d'accés amb l'avís de sessió caducada. **Expulsió en 30 segons com a màxim** en lloc de
fins a una hora.

Dues condicions perquè el remei no fos pitjor que la malaltia:

- **Sense sessió local no es comprova res.** Qui entra pel camí de reserva (`fem_login`, sense
  sessió d'Auth) no en té, i no se l'ha de fer fora.
- **Només es tanca amb un rebuig d'autenticació.** Un error de xarxa no pot treure de l'app un
  soci amb mala cobertura, que amb aquest públic hauria estat pitjor que el problema original.

⚠️ **El codi de rebuig és 403, no 401** (comprovat contra el projecte de Test): 401 és el que
retorna `/auth/v1/user` quan **no** hi ha cap testimoni, i 403 quan n'hi ha un que no val. La
condició cobreix els dos; filtrant només per 401 el canvi no hauria fet res justament en el cas
que havia d'arreglar.

**Verificat a la interfície** (Enric, 29/07/2026): amb el compte de proves amb la sessió oberta i
un Reset fet des d'una altra finestra, la finestra del soci salta sola a la pantalla d'accés
—vist en directe, sense tocar-la—, amb el 403 de `/auth/v1/user` a la consola i tot seguit el
missatge de `_listenAuthChanges()`. Al servidor, `auth.sessions` i `auth.refresh_tokens` a 0 i la
contrasenya temporal coincidint a les dues taules.
