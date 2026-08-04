-- Pas 4d de la migració d'Auth (ANALISI_Login_Navegacio.md §A): retirada del
-- sistema antic de contrasenyes en clar. Bloquejat des del 27/07/2026 fins
-- comprovar Zampa (nota de traspàs a §1.4) — comprovat el 04/08/2026:
--
--   · El login de Zampa ja és mort (el seu propi codi no demana la columna
--     `password` al SELECT des del REVOKE del 26/07 — sql/2026-07-26_login_
--     seguretat_fem_login.sql). Buidar la columna no li canvia res.
--   · El seu registre (`handleRegister`, independent del login) SÍ que
--     segueix escrivint directe a `public.users` amb la clau anon —
--     saltant-se el cens de socis FEM (`socis_fem_autoritzats`) i deixant una
--     fila sense `auth_user_id` que encara podria entrar a FOTO/REPTES pel
--     camí de reserva `fem_login()`. 0 files així avui (Normal 41/41, Test
--     confirmat sense orfes), però la porta hi és fins ara.
--   · FEM-Reptes (comprovat al seu codi font local) no llegeix mai
--     `users.password` ni fa cap INSERT/DELETE directe sobre `users` — tot
--     passa per les mateixes RPC que FEM-Foto. Sí que crida `fem_login()`
--     com a camí de reserva, però amb `rpcError` capturat i degradat al
--     mateix missatge de "credencials incorrectes" de sempre (login.js:192-197
--     de FEM-Reptes) — revocar-ne l'EXECUTE no li petarà res.
--
-- Rollback a sql/2026-08-04_pas4d_retirada_sistema_antic_rollback.sql.

-- ═══════════════════════════════════
-- 1) BUIDAR public.users.password
-- ═══════════════════════════════════
-- Ja no el llegeix cap camí legítim (login real via Supabase Auth per a tots
-- els comptes actuals). Deixa de tenir cap valor útil ni per a FOTO/REPTES
-- ni per a Zampa (que ja no la pot ni llegir).
UPDATE public.users SET password = '' WHERE password IS NOT NULL AND password <> '';

-- ═══════════════════════════════════
-- 2) RETIRAR LES POLÍTIQUES D'ESCRIPTURA DIRECTA QUE JA NO CAL NINGÚ
-- ═══════════════════════════════════
-- Altes i baixes (pròpies i des de l'admin) van totes per RPC des del Pas 4a
-- (fem_register_account/fem_admin_create_member/fem_delete_account, totes
-- SECURITY DEFINER — cap d'elles depèn d'aquestes polítiques). Tancar-les
-- tanca també la via del registre de Zampa (INSERT amb clau anon).
DROP POLICY IF EXISTS users_insert_self_register ON public.users;
DROP POLICY IF EXISTS users_insert_bootstrap      ON public.users;
DROP POLICY IF EXISTS users_insert_admin          ON public.users;
DROP POLICY IF EXISTS users_delete_admin_or_self  ON public.users;

-- ═══════════════════════════════════
-- 3) TANCAR fem_login() DEL TOT
-- ═══════════════════════════════════
-- No s'esborra (mateix criteri "amagar, no eliminar" ja aplicat a
-- fem_set_new_password el 28/07/2026) — es queda sense privilegis. Amb el
-- pas 2 fet, cap fila nova pot quedar mai sense auth_user_id, així que
-- aquest camí de reserva ja no té cap ús legítim pendent.
REVOKE EXECUTE ON FUNCTION public.fem_login(text, text) FROM PUBLIC, anon, authenticated;
