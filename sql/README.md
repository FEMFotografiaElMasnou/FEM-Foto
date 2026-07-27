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

**Pas 3b i 3c són la mateixa migració** aplicada a cada entorn per separat: els noms de les
polítiques de Normal havien divergit dels de Test (per un enduriment parcial anterior) i calia
adaptar-los.

## Marxa enrere

| Rollback | Desfà |
|---|---|
| `2026-07-27_auth_migracio_pas3b_rollback_test.sql` | Pas 3b (Test) |
| `2026-07-27_auth_migracio_pas3c_rollback_normal.sql` | Pas 3c (Normal) |
| `2026-07-27_auth_migracio_pas4a_rollback.sql` | Pas 4a |
| `2026-07-27_auth_migracio_pas4c_rollback.sql` | Pas 4c |

Les migracions del Pas 4b i anteriors són additives (creen funcions o columnes sense tocar
dades ni polítiques); desfer-les és un `DROP` de la funció, indicat al peu de cada fitxer.

⚠️ Desfer una migració que hagi tocat funcions **obliga a revertir també el codi de client que
les crida**. Cada rollback ho indica al capdamunt.

## Superades (no tornar a executar)

`reptes_calendari.sql`, `reptes_calendari_fase2.sql`, `reptes_calendari_tz_fix.sql` — de
l'època en què el calendari vivia a la taula `reptes_calendari`, absorbida per `objectives` el
24/07/2026. Es conserven com a historial del disseny anterior.
