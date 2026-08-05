# Migracions SQL

Migracions escrites a mà i aplicades amb les eines MCP de Supabase (**mai des del frontend**,
ADR-015). Criteri fix: **Test primer, verificar, després Normal**, i cada migració amb el seu
script de marxa enrere escrit *abans* d'aplicar-la.

Els fitxers no s'esborren un cop aplicats: queden com a referència i com a registre del que
s'ha executat a cada entorn.

## Aplicades

| Fitxer | Normal | Test | Què fa |
|---|:---:|:---:|---|
| `2026-07-24_racionalitzacio_objectives.sql` | ✅ | ✅ | `objectives` absorbeix `reptes_calendari` |
| `2026-07-24_repte_cover_image.sql` | ✅ | ✅ | `objectives.cover_image_url` |
| `2026-07-24_fase3_valoracio_pas1.sql` | ✅ | ✅ | Fase 3 Pas 1: `votes.valoracio` + trigger `fem_sync_valoracio()` |
| `2026-07-25_fase3_valoracio_pas1b_decimals.sql` | ✅ | ✅ | Pas 1b: `valoracio` passa a `numeric(4,2)` (es perdien decimals) |
| `2026-07-25_merge_duplicate_user_sancho.sql` | ✅ | — | Correcció de dades puntual (usuari duplicat). Test no tenia el cas |
| `2026-07-26_login_seguretat_fem_login.sql` | ✅ | ✅ | Fase 1.3: `fem_login()` i revocació de `SELECT` sobre `users.password` |
| `2026-07-26_auth_migracio_pas1_bridge_column.sql` | ✅ | ✅ | Pas 1: columna pont `users.auth_user_id` |
| `2026-07-26_auth_migracio_pas2_crear_comptes.sql` | ✅ | ✅ | Pas 2: creació dels comptes a `auth.users` (41 i 50) |
| `2026-07-27_auth_migracio_pas3b_rls_test.sql` | — | ✅ | Pas 3b: RLS amb `auth.uid()` |
| `2026-07-27_auth_migracio_pas3c_rls_normal.sql` | ✅ | — | Pas 3c: la mateixa RLS, adaptada als noms de política de Normal |
| `2026-07-27_auth_migracio_pas4a_altes_baixes.sql` | ✅ | ✅ | Pas 4a: RPC d'altes i baixes (crea/esborra les dues files) |
| `2026-07-27_auth_migracio_pas4b_sync_email.sql` | ✅ | ✅ | Pas 4b: `fem_admin_set_email()` |
| `2026-07-27_auth_migracio_pas4c_reset_contrasenya.sql` | ✅ | ✅ | Pas 4c: `fem_set_own_password()` |
| `2026-07-27_fase3_commutador.sql` | ✅* | ✅ | Fase 3 Pas A: clau `sistema_puntuacio_nou` a `app_settings` (interruptor antic/nou) |
| `2026-07-28_reset_admin_contrasenya_temporal.sql` | ✅ | ✅ | Reset de l'admin Part 1: `fem_admin_reset_password()` (contrasenya temporal a les dues taules) |
| `2026-07-28_reset_admin_part2_tancament.sql` | ✅ | ✅ | Reset de l'admin Part 2: tanca `fem_set_new_password`, `fem_login` deixa de retornar `reset_required`, text del modal |
| `2026-07-31_incidencia_4.2_rls_pujada_tancada.sql` | ✅ | ✅ | Incidència 4.2 (Fase 4): `photo_submissions_insert_own` exigeix `uploads_enabled=true` o admin — abans no comprovava res més enllà del `user_id`. Aplicada a Normal l'01/08/2026, comprovat abans que FEM-Reptes gateja el seu propi formulari amb la mateixa columna `objectives.uploads_enabled` i el mateix bypass d'admin, així que no li toca res |
| `2026-08-01_neteja_names_revealed_ranking_hidden.sql` | ✅ | ✅ | Elimina `objectives.names_revealed`, `photo_submissions.revealed` i les files `app_settings.ranking_hidden`/`names_revealed` — cap consumidor real a FEM-Foto ni a FEM-Reptes. Reescriu `fem_apply_calendar()` i `fem_bootstrap_admin()`, que també les esmentaven. Coordinada amb un canvi de codi a FEM-Reptes (commit `88ca8de`, desplegat abans que la BD) |
| `2026-08-01_incidencia_5.5_rls_autovot.sql` | ✅ | ✅ | Incidència 5.5 (Fase 4): `votes_insert_own` i `votes_update_own` exigeixen que la foto votada no sigui del mateix votant — abans no comprovaven res més enllà del `user_id`. Aplicada primer a Test amb un bug d'ambigüitat de columna (vegeu nota al fitxer) que bloquejava **tots** els vots; corregit al mateix moment, abans de tocar Normal. Comprovat abans que FEM-Reptes ja amaga les estrelles de la pròpia foto i no té cap camí que hi escrigui, així que no li toca res |
| `2026-08-01_incidencia_5.4_rls_vot_ja_enviat.sql` | ✅ | ✅ | Incidència 5.4 (Fase 4): les mateixes dues polítiques exigeixen, a més, que no existeixi `seguiment_votacio` amb `es_esborrany=false` per aquest user_id/objective_id — abans, un vot ja enviat es podia tornar a canviar amb una crida directa a l'API. Comprovat abans que FEM-Reptes sempre passa per `isVotingSubmitted()` al seu únic camí d'escriptura a `votes`, així que no li toca res |
| `2026-08-01_incidencia_5.6_rls_votacio_tancada.sql` | ✅ | ✅ | Incidència 5.6 (Fase 4): les mateixes polítiques exigeixen, a més, que el repte referenciat estigui `status='active'` i `voting_enabled=true` — abans, es podia votar amb la votació tancada per crida directa. La condició `status='active'` (no només `voting_enabled`) cobreix el cas d'un repte `inactive` amb `voting_enabled` arrossegat (vist al bloc 3 del guió de proves). Comprovat abans que FEM-Reptes usa exactament el mateix mirall (`voting_enabled` de l'objectiu actiu) i no té cap camí que hi escrigui per fora d'això |
| `2026-08-02_socis_fem_autoritzats.sql` | ✅ | ✅ | Filtre d'alta: taula nova `socis_fem_autoritzats` (email + rol per defecte, RLS només-admin), carregada d'entrada amb els emails ja existents a `users` (52 a Test, 41 a Normal). `fem_register_account()` rebutja amb `'not_authorized'` qualsevol email que no hi sigui, i ja no força `role='participant'`: el pren de `rol_per_defecte`. No toca `public.users` (compartida amb Zampa) ni `fem_admin_create_member` (l'alta feta per l'admin segueix sense filtre, decisió explícita). Verificat a Test amb un email de prova (rebuig i acceptació amb rol `expert`), net després; aplicada a Normal el 02/08/2026 i verificat el camí de rebuig (sense crear cap compte real) |
| `2026-08-04_pas4d_retirada_sistema_antic.sql` | ✅ | ✅ | Pas 4d de l'Auth (bloquejat des del 27/07): buida `users.password` (52/52 a Test, 41/41 a Normal), retira 4 polítiques RLS d'escriptura directa (`users_insert_self_register`/`_bootstrap`/`_admin`, `users_delete_admin_or_self` — ja no en necessita cap client, tot va per RPC des del Pas 4a) i revoca l'`EXECUTE` de `fem_login()` per a `anon`/`authenticated`. De pas tanca un forat real: el registre de Zampa (`handleRegister`, codi font comprovat en local) escrivia directe a `users` amb la clau anon, saltant-se el cens de socis FEM i deixant una fila que podia entrar per `fem_login()` — 0 files així trobades a cap entorn, però la porta hi era. Verificat amb crides reals (API) als dos entorns: `fem_login()` i l'`INSERT` estil Zampa → `permission denied`; login real (`signInWithPassword`) i `fem_register_account()` → intactes. Detall a `docs/arxiu/HISTORIC_Auth_Migracio.md` §1.7 |

**\* `2026-07-27_fase3_commutador.sql` a Normal**: la fila no la va crear l'script, la va crear
la pròpia app el 28/07/2026 en provar el commutador des del panell d'admin (l'`upsert` de
`saveSistemaPuntuacio()` la insereix si no hi és). Va quedar a `true`; **restaurada a `false`**
el mateix dia, que és el valor que li toca fins al tall. L'script segueix sent idempotent
(`on conflict do nothing`), així que executar-lo ara no faria res.

**Pas 3b i 3c són la mateixa migració** aplicada a cada entorn per separat: els noms de les
polítiques de Normal havien divergit dels de Test (per un enduriment parcial anterior) i calia
adaptar-los.

**Reset de l'admin (28/07/2026) — per què va en dues parts i quin ordre porten.** La Part 1
és additiva i es pot aplicar amb el codi antic desplegat. La Part 2 retira la via que el codi
antic feia servir, i per això va **després** de desplegar el codi nou de **les dues** apps
(FEM-Foto i FEM-Reptes: comparteixen aquesta base de dades i totes dues tenien el mateix Reset).
Ordre: Part 1 → desplegar les dues apps → Part 2. **Executat així a Normal el 28/07/2026**, i
verificat al final a l'app antiga en viu (login del soci, Reset des del panell i una escriptura
amb la sessió resultant).

⚠️ **Parany comprovat aquí (i ja vist el 26/07 amb els permisos de columna)**: `REVOKE EXECUTE
... FROM anon` **no fa res** en una funció nova. Tota funció neix amb `EXECUTE` concedit a
`PUBLIC`, i `anon` hi arriba per aquí (`=X/postgres` a `pg_proc.proacl`). Cal
`REVOKE ... FROM PUBLIC, anon` i després `GRANT` explícit als rols que la necessiten. Verificar-ho
sempre amb `has_function_privilege('anon', ...)`, no donar el `REVOKE` per bo.

## Marxa enrere

| Rollback | Desfà |
|---|---|
| `2026-07-27_auth_migracio_pas3b_rollback_test.sql` | Pas 3b (Test) |
| `2026-07-27_auth_migracio_pas3c_rollback_normal.sql` | Pas 3c (Normal) |
| `2026-07-27_auth_migracio_pas4a_rollback.sql` | Pas 4a |
| `2026-07-27_auth_migracio_pas4c_rollback.sql` | Pas 4c |
| `2026-07-27_fase3_commutador_rollback.sql` | Fase 3 Pas A (esborra la fila; l'app torna al sistema antic per defecte) |
| `2026-07-28_reset_admin_rollback.sql` | Les dues parts del Reset de l'admin. ⚠️ Torna a obrir el forat que tanquen |
| `2026-07-31_incidencia_4.2_rls_pujada_tancada_rollback.sql` | Incidència 4.2. ⚠️ Torna a obrir el forat: cal desfer també la guarda de `uploadPhoto()` a `fotos.js` |
| `2026-08-01_neteja_names_revealed_ranking_hidden_rollback.sql` | Recrea les columnes/files i les dues funcions. ⚠️ No recupera el codi de client: cal desfer també el commit `88ca8de` a FEM-Reptes i el corresponent a FEM-Foto |
| `2026-08-01_incidencia_5.5_rls_autovot_rollback.sql` | Incidència 5.5. ⚠️ Torna a obrir el forat: cal desfer també la guarda de `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()`/`handleStar()`/`_applyPuntuacio()` a `votacio.js` |
| `2026-08-01_incidencia_5.4_rls_vot_ja_enviat_rollback.sql` | Incidència 5.4. ⚠️ Torna a obrir el forat: cal desfer també la guarda afegida a `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()` per a aquesta incidència concreta a `votacio.js` |
| `2026-08-01_incidencia_5.6_rls_votacio_tancada_rollback.sql` | Incidència 5.6. ⚠️ Torna a obrir el forat: cal desfer també la guarda afegida a `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()` per a aquesta incidència concreta a `votacio.js` |
| `2026-08-02_socis_fem_autoritzats_rollback.sql` | Filtre d'alta. ⚠️ Torna a obrir el forat: qualsevol pot autoregistrar-se sense ser del cens. Esborra la taula sencera (CASCADE) |
| `2026-08-04_pas4d_retirada_sistema_antic_rollback.sql` | Pas 4d. Recrea les 4 polítiques i torna a concedir `EXECUTE` de `fem_login()`. ⚠️ No recupera cap contrasenya (buidades, irrecuperables — cap camí legítim les llegia). Torna a obrir el forat del registre de Zampa |

Les migracions del Pas 4b i anteriors són additives (creen funcions o columnes sense tocar
dades ni polítiques); desfer-les és un `DROP` de la funció, indicat al peu de cada fitxer.

⚠️ Desfer una migració que hagi tocat funcions **obliga a revertir també el codi de client que
les crida**. Cada rollback ho indica al capdamunt.

## Superades (no tornar a executar)

`reptes_calendari.sql`, `reptes_calendari_fase2.sql`, `reptes_calendari_tz_fix.sql` — de
l'època en què el calendari vivia a la taula `reptes_calendari`, absorbida per `objectives` el
24/07/2026. Es conserven com a historial del disseny anterior.
