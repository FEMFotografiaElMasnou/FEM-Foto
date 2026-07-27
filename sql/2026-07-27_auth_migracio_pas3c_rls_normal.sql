-- Migració a Supabase Auth (opció C, ANALISI_Login_Navegacio.md §1.4) — Pas 3c
-- NOMÉS PROJECTE NORMAL (ogqqcgbgcqowvywaolln). Equivalent exacte de
-- sql/2026-07-27_auth_migracio_pas3b_rls_test.sql (ja provat a fons a Test),
-- adaptat perquè els DROP coincideixin amb els noms reals de les polítiques
-- de Normal (diferents dels de Test — vegeu ANALISI_Login_Navegacio.md §1.4
-- punt 3(a): Normal ja tenia un intent previ d'enduriment (`*_write`/`*_edit`/
-- `*_remove`, `auth.role()='anon'`) que convivia amb les polítiques originals
-- `USING(true)` sense bloquejar res de debò).
--
-- Rollback complet a sql/2026-07-27_auth_migracio_pas3c_rollback_normal.sql
-- (recrea exactament les polítiques de Normal capturades via pg_policies
-- el 27/07/2026, abans de tocar res).

-- ═══════════════════════════════════
-- FUNCIONS AUXILIARS (idèntiques a Test)
-- ═══════════════════════════════════
CREATE OR REPLACE FUNCTION public.fem_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.fem_current_user_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.fem_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fem_current_user_id() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.fem_set_new_password(p_user_id text, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cur text;
  v_auth_id uuid;
BEGIN
  SELECT password, auth_user_id INTO cur, v_auth_id FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF trim(coalesce(cur, '')) <> '' THEN RETURN false; END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 4 THEN RETURN false; END IF;

  UPDATE public.users SET password = p_new_password WHERE id = p_user_id;

  IF v_auth_id IS NOT NULL THEN
    UPDATE auth.users
      SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
          updated_at = now()
      WHERE id = v_auth_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_set_new_password(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.fem_admin_set_password(p_user_id text, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_auth_id uuid;
BEGIN
  IF NOT public.fem_is_admin() THEN RETURN false; END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 4 THEN RETURN false; END IF;

  SELECT auth_user_id INTO v_auth_id FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.users SET password = p_new_password WHERE id = p_user_id;

  IF v_auth_id IS NOT NULL THEN
    UPDATE auth.users
      SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
          updated_at = now()
      WHERE id = v_auth_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_admin_set_password(text, text) TO authenticated;

-- ═══════════════════════════════════
-- DROP de totes les polítiques permissives actuals de NORMAL
-- (inclou tant les originals "Permetre X" com l'intent previ *_write/_edit/_remove)
-- ═══════════════════════════════════
DROP POLICY IF EXISTS "settings_write" ON public.app_settings;
DROP POLICY IF EXISTS "settings_read" ON public.app_settings;
DROP POLICY IF EXISTS "settings_edit" ON public.app_settings;

DROP POLICY IF EXISTS "app_texts_select" ON public.app_texts;
DROP POLICY IF EXISTS "app_texts_update" ON public.app_texts;

DROP POLICY IF EXISTS "Permetre eliminació de objectives" ON public.objectives;
DROP POLICY IF EXISTS "obj_remove" ON public.objectives;
DROP POLICY IF EXISTS "Permetre creació de objectives" ON public.objectives;
DROP POLICY IF EXISTS "obj_write" ON public.objectives;
DROP POLICY IF EXISTS "Permetre lectura pública de objectives" ON public.objectives;
DROP POLICY IF EXISTS "obj_read" ON public.objectives;
DROP POLICY IF EXISTS "Permetre actualització de objectives" ON public.objectives;
DROP POLICY IF EXISTS "obj_edit" ON public.objectives;

DROP POLICY IF EXISTS "Permetre eliminació de photo_submissions" ON public.photo_submissions;
DROP POLICY IF EXISTS "photos_remove" ON public.photo_submissions;
DROP POLICY IF EXISTS "Permetre creació de photo_submissions" ON public.photo_submissions;
DROP POLICY IF EXISTS "photos_write" ON public.photo_submissions;
DROP POLICY IF EXISTS "Permetre lectura pública de photo_submissions" ON public.photo_submissions;
DROP POLICY IF EXISTS "photos_read" ON public.photo_submissions;
DROP POLICY IF EXISTS "Permetre actualització de photo_submissions" ON public.photo_submissions;
DROP POLICY IF EXISTS "photos_edit" ON public.photo_submissions;

DROP POLICY IF EXISTS "reptes_calendari_insert" ON public.reptes_calendari;
DROP POLICY IF EXISTS "reptes_calendari_select" ON public.reptes_calendari;
DROP POLICY IF EXISTS "reptes_calendari_update" ON public.reptes_calendari;

DROP POLICY IF EXISTS "Allow all on seguiment_votacio" ON public.seguiment_votacio;

DROP POLICY IF EXISTS "Permetre creació de settings" ON public.settings;
DROP POLICY IF EXISTS "Permetre lectura pública de settings" ON public.settings;
DROP POLICY IF EXISTS "Permetre actualització de settings" ON public.settings;

DROP POLICY IF EXISTS "Permetre eliminació de users" ON public.users;
DROP POLICY IF EXISTS "users_remove" ON public.users;
DROP POLICY IF EXISTS "Permetre creació de users" ON public.users;
DROP POLICY IF EXISTS "users_write" ON public.users;
DROP POLICY IF EXISTS "Permetre lectura pública de users" ON public.users;
DROP POLICY IF EXISTS "users_read" ON public.users;
DROP POLICY IF EXISTS "Permetre actualització de users" ON public.users;
DROP POLICY IF EXISTS "users_edit" ON public.users;

DROP POLICY IF EXISTS "Allow all on votes" ON public.votes;
DROP POLICY IF EXISTS "Permetre eliminació de votes" ON public.votes;
DROP POLICY IF EXISTS "votes_remove" ON public.votes;
DROP POLICY IF EXISTS "Permetre creació de votes" ON public.votes;
DROP POLICY IF EXISTS "votes_write" ON public.votes;
DROP POLICY IF EXISTS "Permetre lectura pública de votes" ON public.votes;
DROP POLICY IF EXISTS "votes_read" ON public.votes;
DROP POLICY IF EXISTS "Permetre actualització de votes" ON public.votes;

-- ═══════════════════════════════════
-- CREATE de les polítiques noves (idèntiques a Test)
-- ═══════════════════════════════════
CREATE POLICY users_select_all ON public.users
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY users_insert_self_register ON public.users
  FOR INSERT TO anon, authenticated
  WITH CHECK (role = 'participant');
CREATE POLICY users_insert_admin ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.fem_is_admin());
CREATE POLICY users_insert_bootstrap ON public.users
  FOR INSERT TO anon, authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM public.users LIMIT 1));
CREATE POLICY users_update_admin ON public.users
  FOR UPDATE TO authenticated
  USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());
CREATE POLICY users_delete_admin_or_self ON public.users
  FOR DELETE TO authenticated
  USING (public.fem_is_admin() OR auth_user_id = auth.uid());

CREATE POLICY objectives_select_all ON public.objectives
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY objectives_insert_admin ON public.objectives
  FOR INSERT TO authenticated WITH CHECK (public.fem_is_admin());
CREATE POLICY objectives_update_admin ON public.objectives
  FOR UPDATE TO authenticated USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());
CREATE POLICY objectives_delete_admin ON public.objectives
  FOR DELETE TO authenticated USING (public.fem_is_admin());

CREATE POLICY photo_submissions_select_all ON public.photo_submissions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY photo_submissions_insert_own ON public.photo_submissions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.fem_current_user_id());
CREATE POLICY photo_submissions_update_own_or_admin ON public.photo_submissions
  FOR UPDATE TO authenticated
  USING (user_id = public.fem_current_user_id() OR public.fem_is_admin());
CREATE POLICY photo_submissions_delete_own_or_admin ON public.photo_submissions
  FOR DELETE TO authenticated
  USING (user_id = public.fem_current_user_id() OR public.fem_is_admin());

CREATE POLICY votes_select_all ON public.votes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY votes_insert_own ON public.votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.fem_current_user_id());
CREATE POLICY votes_update_own ON public.votes
  FOR UPDATE TO authenticated
  USING (user_id = public.fem_current_user_id());
CREATE POLICY votes_delete_admin ON public.votes
  FOR DELETE TO authenticated USING (public.fem_is_admin());

CREATE POLICY seguiment_votacio_select_all ON public.seguiment_votacio
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY seguiment_votacio_insert_own ON public.seguiment_votacio
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.fem_current_user_id());
CREATE POLICY seguiment_votacio_update_own ON public.seguiment_votacio
  FOR UPDATE TO authenticated
  USING (user_id = public.fem_current_user_id());

CREATE POLICY app_settings_select_all ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY app_settings_write_admin ON public.app_settings
  FOR ALL TO authenticated
  USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());
CREATE POLICY app_settings_insert_bootstrap ON public.app_settings
  FOR INSERT TO anon, authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM public.users LIMIT 1));

CREATE POLICY app_texts_select_all ON public.app_texts
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY app_texts_update_admin ON public.app_texts
  FOR UPDATE TO authenticated
  USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());

CREATE POLICY settings_select_all ON public.settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY settings_write_admin ON public.settings
  FOR ALL TO authenticated
  USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());

CREATE POLICY reptes_calendari_select_all ON public.reptes_calendari
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY reptes_calendari_write_admin ON public.reptes_calendari
  FOR ALL TO authenticated
  USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());
