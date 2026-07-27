-- Migració a Supabase Auth (opció C, ANALISI_Login_Navegacio.md §1.4) — Pas 3b
-- NOMÉS PROJECTE TEST (xxydxdsiunfwzkcffdai). No aplicar a Normal fins al Pas 3c.
--
-- Reescriu les polítiques RLS permissives (USING/WITH CHECK true) detectades
-- a §1.2 perquè comprovin auth.uid() (via la columna pont auth_user_id, Pas 1)
-- en lloc de confiar en un user_id que envia el client. Depèn del Pas 3a
-- (sessió real d'Auth en paral·lel al login) ja verificat a Test i Normal.
--
-- Mapeig d'operacions d'escriptura usat com a base (agent Explore, 27/07/2026,
-- vegeu ANALISI_Login_Navegacio.md §1.4 punt 3): cada política nova reflecteix
-- un patró real trobat al codi, no una suposició.
--
-- Decisions de disseny que van més enllà d'una traducció mecànica 1:1
-- (marcades perquè Enric les revisi explícitament):
--
--   (D1) INSERT obert a `users` es manté per a l'auto-registre (handleRegister,
--        una funció pública intencionada, no un forat) però ara amb
--        WITH CHECK (role = 'participant') — abans qualsevol podia enviar
--        role:'admin' directament via l'API i escalar privilegis; ara no.
--   (D2) INSERT a `users`/`app_settings` es manté obert NOMÉS quan la taula
--        `users` està buida (bootstrap sense sessió, initializeDB()) —
--        lligat al mateix invariant que ja fa servir el client
--        (state.users.length === 0), no es pot explotar un cop hi ha comptes.
--   (D3) La contrasenya nova que tria un usuari després d'un reset d'admin
--        (saveNewPassword, "reset_required") no té sessió real d'Auth en
--        aquell moment (encara no ha fet signInWithPassword amb èxit, ja que
--        la contrasenya vella és buida). Es tanca UPDATE de `users` a
--        admin-only i es crea fem_set_new_password() com a via alternativa,
--        SECURITY DEFINER, que només permet escriure quan la contrasenya
--        actual ja és buida (mateix invariant que "reset_required" al servidor
--        fem_login) — necessita un petit canvi a login.js (saveNewPassword),
--        veure nota d'aplicació al peu d'aquest fitxer.
--   (D4) `settings`/`reptes_calendari` són taules retirades (cap lectura ni
--        escriptura al codi actual, "Racionalització BD 2026-07" / absorbides
--        a `objectives`) — es tanquen a admin-only per higiene, sense cap risc
--        funcional real.
--   (D5) `zampa_*` queda FORA d'abast (Zampa el gestiona Enric per separat,
--        vegeu la nota de traspàs a §1.4).
--
-- Rollback complet disponible a
-- sql/2026-07-27_auth_migracio_pas3b_rollback_test.sql (recrea exactament
-- les polítiques d'avui, capturades via pg_policies abans de tocar res).

-- ═══════════════════════════════════
-- FUNCIONS AUXILIARS
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

-- Via alternativa per fixar la contrasenya nova després d'un reset d'admin
-- (D3): només funciona mentre la contrasenya actual sigui buida, així que no
-- es pot fer servir per prendre el control d'un compte actiu.
--
-- FIX aplicat durant les proves de Pas 3b (27/07/2026): la primera versió
-- només actualitzava public.users.password. Provant el cicle complet
-- (admin reseteja -> usuari tria nova contrasenya -> vota) es va detectar
-- que el `saveNewPassword()` del client NO passa per `handleLogin()` (Pas 3a),
-- així que calia establir la sessió real d'Auth també des d'aquest punt —
-- però `signInWithPassword()` fallava perquè `auth.users` encara tenia la
-- contrasenya ANTIGA (el reset només havia tocat `public.users`). Fix:
-- aquesta funció ara sincronitza también `auth.users.encrypted_password`
-- amb `pgcrypto`, el mateix mecanisme del Pas 2.
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

-- Mateix problema, altra porta d'entrada: quan un admin canvia la contrasenya
-- d'un soci directament des del formulari "Editar soci" (socis.js saveMember),
-- un UPDATE de client directe també deixaria auth.users desincronitzat.
-- Aquesta RPC és l'equivalent admin-gated d'aquell cas.
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
-- DROP de totes les polítiques permissives actuals
-- ═══════════════════════════════════
DROP POLICY IF EXISTS "allow_anon_write" ON public.app_settings;
DROP POLICY IF EXISTS "allow_anon_read" ON public.app_settings;

DROP POLICY IF EXISTS "app_texts_select" ON public.app_texts;
DROP POLICY IF EXISTS "app_texts_update" ON public.app_texts;

DROP POLICY IF EXISTS "allow_anon_write" ON public.objectives;
DROP POLICY IF EXISTS "Permetre eliminació de objectives" ON public.objectives;
DROP POLICY IF EXISTS "Permetre creació de objectives" ON public.objectives;
DROP POLICY IF EXISTS "Permetre lectura pública de objectives" ON public.objectives;
DROP POLICY IF EXISTS "allow_anon_read" ON public.objectives;
DROP POLICY IF EXISTS "Permetre actualització de objectives" ON public.objectives;

DROP POLICY IF EXISTS "allow_anon_write" ON public.photo_submissions;
DROP POLICY IF EXISTS "Permetre eliminació de photo_submissions" ON public.photo_submissions;
DROP POLICY IF EXISTS "Permetre creació de photo_submissions" ON public.photo_submissions;
DROP POLICY IF EXISTS "Permetre lectura pública de photo_submissions" ON public.photo_submissions;
DROP POLICY IF EXISTS "allow_anon_read" ON public.photo_submissions;
DROP POLICY IF EXISTS "Permetre actualització de photo_submissions" ON public.photo_submissions;

DROP POLICY IF EXISTS "reptes_calendari_insert" ON public.reptes_calendari;
DROP POLICY IF EXISTS "reptes_calendari_select" ON public.reptes_calendari;
DROP POLICY IF EXISTS "reptes_calendari_update" ON public.reptes_calendari;

DROP POLICY IF EXISTS "allow_insert" ON public.seguiment_votacio;
DROP POLICY IF EXISTS "allow_select" ON public.seguiment_votacio;
DROP POLICY IF EXISTS "allow_update" ON public.seguiment_votacio;

DROP POLICY IF EXISTS "Permetre creació de settings" ON public.settings;
DROP POLICY IF EXISTS "Permetre lectura pública de settings" ON public.settings;
DROP POLICY IF EXISTS "Permetre actualització de settings" ON public.settings;

DROP POLICY IF EXISTS "allow_anon_write" ON public.users;
DROP POLICY IF EXISTS "Permetre eliminació de users" ON public.users;
DROP POLICY IF EXISTS "Permetre creació de users" ON public.users;
DROP POLICY IF EXISTS "Permetre lectura pública de users" ON public.users;
DROP POLICY IF EXISTS "allow_anon_read" ON public.users;
DROP POLICY IF EXISTS "Permetre actualització de users" ON public.users;

DROP POLICY IF EXISTS "allow_anon_write" ON public.votes;
DROP POLICY IF EXISTS "Permetre eliminació de votes" ON public.votes;
DROP POLICY IF EXISTS "Permetre creació de votes" ON public.votes;
DROP POLICY IF EXISTS "Permetre lectura pública de votes" ON public.votes;
DROP POLICY IF EXISTS "allow_anon_read" ON public.votes;
DROP POLICY IF EXISTS "Permetre actualització de votes" ON public.votes;

-- ═══════════════════════════════════
-- CREATE de les polítiques noves
-- ═══════════════════════════════════

-- users
CREATE POLICY users_select_all ON public.users
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY users_insert_self_register ON public.users
  FOR INSERT TO anon, authenticated
  WITH CHECK (role = 'participant');  -- D1

CREATE POLICY users_insert_admin ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.fem_is_admin());

CREATE POLICY users_insert_bootstrap ON public.users
  FOR INSERT TO anon, authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM public.users LIMIT 1));  -- D2

CREATE POLICY users_update_admin ON public.users
  FOR UPDATE TO authenticated
  USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());  -- D3

CREATE POLICY users_delete_admin_or_self ON public.users
  FOR DELETE TO authenticated
  USING (public.fem_is_admin() OR auth_user_id = auth.uid());

-- objectives (admin-only write, lectura pública)
CREATE POLICY objectives_select_all ON public.objectives
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY objectives_insert_admin ON public.objectives
  FOR INSERT TO authenticated WITH CHECK (public.fem_is_admin());
CREATE POLICY objectives_update_admin ON public.objectives
  FOR UPDATE TO authenticated USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());
CREATE POLICY objectives_delete_admin ON public.objectives
  FOR DELETE TO authenticated USING (public.fem_is_admin());

-- photo_submissions (propi usuari o admin)
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

-- votes (propi usuari vota; només admin esborra, per neteja en cascada)
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

-- seguiment_votacio (propi usuari; sense delete, cap ús trobat al codi)
CREATE POLICY seguiment_votacio_select_all ON public.seguiment_votacio
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY seguiment_votacio_insert_own ON public.seguiment_votacio
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.fem_current_user_id());
CREATE POLICY seguiment_votacio_update_own ON public.seguiment_votacio
  FOR UPDATE TO authenticated
  USING (user_id = public.fem_current_user_id());

-- app_settings (admin-only write + bootstrap sense sessió quan no hi ha usuaris)
CREATE POLICY app_settings_select_all ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY app_settings_write_admin ON public.app_settings
  FOR ALL TO authenticated
  USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());
CREATE POLICY app_settings_insert_bootstrap ON public.app_settings
  FOR INSERT TO anon, authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM public.users LIMIT 1));  -- D2

-- app_texts (admin-only write)
CREATE POLICY app_texts_select_all ON public.app_texts
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY app_texts_update_admin ON public.app_texts
  FOR UPDATE TO authenticated
  USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());

-- settings (D4: taula retirada, ningú hi escriu — tancat per higiene)
CREATE POLICY settings_select_all ON public.settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY settings_write_admin ON public.settings
  FOR ALL TO authenticated
  USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());

-- reptes_calendari (D4: taula retirada, ningú hi escriu — tancat per higiene)
CREATE POLICY reptes_calendari_select_all ON public.reptes_calendari
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY reptes_calendari_write_admin ON public.reptes_calendari
  FOR ALL TO authenticated
  USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());

-- NOTA D3 — canvis de client necessaris (fets en local, NO desplegats
-- encara — pendents de push fins al Pas 3c, quan aquesta migració ja
-- estigui aplicada a Normal):
--   1. `login.js` `saveNewPassword()`: crida `fem_set_new_password` en lloc
--      de l'UPDATE directe, i A MÉS crida `sb.auth.signInWithPassword()`
--      just després (aquest camí no passa per `handleLogin()`/Pas 3a, calia
--      afegir-ho aquí també — trobat provant el cicle complet).
--   2. `socis.js` `saveMember()`: quan l'admin canvia la contrasenya d'un
--      soci des del formulari "Editar soci", crida `fem_admin_set_password`
--      en lloc d'incloure `password` a l'UPDATE genèric de client.
-- Si es fes `push` d'aquests canvis abans que la migració arribi a Normal,
-- aquestes tres funcions no hi existirien encara i els fluxos de gestió de
-- contrasenyes es trencarien per a membres reals.
