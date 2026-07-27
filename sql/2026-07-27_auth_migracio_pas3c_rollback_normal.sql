-- ROLLBACK del Pas 3c (NOMÉS projecte NORMAL). Recrea exactament les
-- polítiques que hi havia abans d'aplicar
-- 2026-07-27_auth_migracio_pas3c_rls_normal.sql, capturades via
-- `pg_policies` el 27/07/2026 abans de tocar res. Aplicar aquest fitxer
-- sencer si el Pas 3c falla algun test i cal desfer-ho de seguida.

DROP POLICY IF EXISTS users_select_all ON public.users;
DROP POLICY IF EXISTS users_insert_self_register ON public.users;
DROP POLICY IF EXISTS users_insert_admin ON public.users;
DROP POLICY IF EXISTS users_insert_bootstrap ON public.users;
DROP POLICY IF EXISTS users_update_admin ON public.users;
DROP POLICY IF EXISTS users_delete_admin_or_self ON public.users;

DROP POLICY IF EXISTS objectives_select_all ON public.objectives;
DROP POLICY IF EXISTS objectives_insert_admin ON public.objectives;
DROP POLICY IF EXISTS objectives_update_admin ON public.objectives;
DROP POLICY IF EXISTS objectives_delete_admin ON public.objectives;

DROP POLICY IF EXISTS photo_submissions_select_all ON public.photo_submissions;
DROP POLICY IF EXISTS photo_submissions_insert_own ON public.photo_submissions;
DROP POLICY IF EXISTS photo_submissions_update_own_or_admin ON public.photo_submissions;
DROP POLICY IF EXISTS photo_submissions_delete_own_or_admin ON public.photo_submissions;

DROP POLICY IF EXISTS votes_select_all ON public.votes;
DROP POLICY IF EXISTS votes_insert_own ON public.votes;
DROP POLICY IF EXISTS votes_update_own ON public.votes;
DROP POLICY IF EXISTS votes_delete_admin ON public.votes;

DROP POLICY IF EXISTS seguiment_votacio_select_all ON public.seguiment_votacio;
DROP POLICY IF EXISTS seguiment_votacio_insert_own ON public.seguiment_votacio;
DROP POLICY IF EXISTS seguiment_votacio_update_own ON public.seguiment_votacio;

DROP POLICY IF EXISTS app_settings_select_all ON public.app_settings;
DROP POLICY IF EXISTS app_settings_write_admin ON public.app_settings;
DROP POLICY IF EXISTS app_settings_insert_bootstrap ON public.app_settings;

DROP POLICY IF EXISTS app_texts_select_all ON public.app_texts;
DROP POLICY IF EXISTS app_texts_update_admin ON public.app_texts;

DROP POLICY IF EXISTS settings_select_all ON public.settings;
DROP POLICY IF EXISTS settings_write_admin ON public.settings;

DROP POLICY IF EXISTS reptes_calendari_select_all ON public.reptes_calendari;
DROP POLICY IF EXISTS reptes_calendari_write_admin ON public.reptes_calendari;

-- Recreació EXACTA de les polítiques originals de Normal (pg_policies, 27/07/2026)
CREATE POLICY "settings_write" ON public.app_settings FOR INSERT TO public WITH CHECK (auth.role() = 'anon'::text);
CREATE POLICY "settings_read" ON public.app_settings FOR SELECT TO public USING (true);
CREATE POLICY "settings_edit" ON public.app_settings FOR UPDATE TO public USING (auth.role() = 'anon'::text);

CREATE POLICY "app_texts_select" ON public.app_texts FOR SELECT TO public USING (true);
CREATE POLICY "app_texts_update" ON public.app_texts FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Permetre eliminació de objectives" ON public.objectives FOR DELETE TO public USING (true);
CREATE POLICY "obj_remove" ON public.objectives FOR DELETE TO public USING (auth.role() = 'anon'::text);
CREATE POLICY "Permetre creació de objectives" ON public.objectives FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "obj_write" ON public.objectives FOR INSERT TO public WITH CHECK (auth.role() = 'anon'::text);
CREATE POLICY "Permetre lectura pública de objectives" ON public.objectives FOR SELECT TO public USING (true);
CREATE POLICY "obj_read" ON public.objectives FOR SELECT TO public USING (true);
CREATE POLICY "Permetre actualització de objectives" ON public.objectives FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "obj_edit" ON public.objectives FOR UPDATE TO public USING (auth.role() = 'anon'::text);

CREATE POLICY "Permetre eliminació de photo_submissions" ON public.photo_submissions FOR DELETE TO public USING (true);
CREATE POLICY "photos_remove" ON public.photo_submissions FOR DELETE TO public USING (auth.role() = 'anon'::text);
CREATE POLICY "Permetre creació de photo_submissions" ON public.photo_submissions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "photos_write" ON public.photo_submissions FOR INSERT TO public WITH CHECK (auth.role() = 'anon'::text);
CREATE POLICY "Permetre lectura pública de photo_submissions" ON public.photo_submissions FOR SELECT TO public USING (true);
CREATE POLICY "photos_read" ON public.photo_submissions FOR SELECT TO public USING (true);
CREATE POLICY "Permetre actualització de photo_submissions" ON public.photo_submissions FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "photos_edit" ON public.photo_submissions FOR UPDATE TO public USING (auth.role() = 'anon'::text);

CREATE POLICY "reptes_calendari_insert" ON public.reptes_calendari FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "reptes_calendari_select" ON public.reptes_calendari FOR SELECT TO public USING (true);
CREATE POLICY "reptes_calendari_update" ON public.reptes_calendari FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on seguiment_votacio" ON public.seguiment_votacio FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permetre creació de settings" ON public.settings FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Permetre lectura pública de settings" ON public.settings FOR SELECT TO public USING (true);
CREATE POLICY "Permetre actualització de settings" ON public.settings FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Permetre eliminació de users" ON public.users FOR DELETE TO public USING (true);
CREATE POLICY "users_remove" ON public.users FOR DELETE TO public USING (auth.role() = 'anon'::text);
CREATE POLICY "Permetre creació de users" ON public.users FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "users_write" ON public.users FOR INSERT TO public WITH CHECK (auth.role() = 'anon'::text);
CREATE POLICY "Permetre lectura pública de users" ON public.users FOR SELECT TO public USING (true);
CREATE POLICY "users_read" ON public.users FOR SELECT TO public USING (true);
CREATE POLICY "Permetre actualització de users" ON public.users FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "users_edit" ON public.users FOR UPDATE TO public USING (auth.role() = 'anon'::text);

CREATE POLICY "Allow all on votes" ON public.votes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permetre eliminació de votes" ON public.votes FOR DELETE TO public USING (true);
CREATE POLICY "votes_remove" ON public.votes FOR DELETE TO public USING (auth.role() = 'anon'::text);
CREATE POLICY "Permetre creació de votes" ON public.votes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "votes_write" ON public.votes FOR INSERT TO public WITH CHECK (auth.role() = 'anon'::text);
CREATE POLICY "Permetre lectura pública de votes" ON public.votes FOR SELECT TO public USING (true);
CREATE POLICY "votes_read" ON public.votes FOR SELECT TO public USING (true);
CREATE POLICY "Permetre actualització de votes" ON public.votes FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Les funcions fem_is_admin/fem_current_user_id/fem_set_new_password/
-- fem_admin_set_password es deixen (no fan cap mal si no s'usen); esborrar-les
-- només si cal netejar del tot:
-- DROP FUNCTION IF EXISTS public.fem_is_admin();
-- DROP FUNCTION IF EXISTS public.fem_current_user_id();
-- DROP FUNCTION IF EXISTS public.fem_set_new_password(text, text);
-- DROP FUNCTION IF EXISTS public.fem_admin_set_password(text, text);
