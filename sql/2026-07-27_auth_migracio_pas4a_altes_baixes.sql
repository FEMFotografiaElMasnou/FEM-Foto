-- Migració a Supabase Auth (opció C, ANALISI_Login_Navegacio.md §1.4) — Pas 4a
-- APLICADA a Test (xxydxdsiunfwzkcffdai) i a Normal (ogqqcgbgcqowvywaolln)
-- el 27/07/2026, en aquest ordre, amb la correcció del forat d'autorització
-- de fem_delete_account (vegeu el comentari dins d'aquella funció) aplicada
-- als dos projectes.
--
-- PROBLEMA QUE TANCA
-- Després del Pas 3b/3c, les escriptures de l'app depenen d'auth.uid() (sessió
-- real de Supabase Auth). Però els camins que CREEN comptes segueixen inserint
-- només a public.users, sense crear la fila corresponent a auth.users:
--   · handleRegister()  (login.js) — auto-registre públic
--   · saveMember()      (socis.js) — "Nou Soci" des del panell d'admin
--   · initializeDB()    (login.js) — admin per defecte amb la BD buida
-- Conseqüència: aquests comptes poden entrar (fem_login mira public.users) però
-- MAI poden establir sessió real d'Auth, i per tant qualsevol escriptura seva
-- (votar, pujar foto) rebria un 403. Avui encara no ha passat amb ningú real
-- (verificat 27/07/2026: 0 files amb auth_user_id IS NULL a Test i a Normal —
-- ningú s'ha registrat des del Pas 2), però el proper soci que es doni d'alta
-- es trobaria un compte a mitges.
--
-- I el simètric, a les baixes: esborrar la fila de public.users
-- (handleUnsubscribe / deleteMember) deixava el compte d'auth.users ORFE —
-- l'adreça quedava ocupada per sempre a Auth i aquella persona no podria
-- tornar-se a donar d'alta mai més amb el mateix correu. (Verificat 27/07/2026:
-- 0 orfes avui als dos projectes, però el camí hi és.)
--
-- COM ES RESOL
-- Quatre funcions SECURITY DEFINER, mateix patró que fem_login /
-- fem_set_new_password / fem_admin_set_password (Pas 1.3 i 3b) i mateixa
-- tècnica de creació de comptes ja validada al Pas 2 (INSERT directe a
-- auth.users + auth.identities amb la contrasenya hashejada amb pgcrypto,
-- que és exactament el format que verifica GoTrue).
--
-- Per què RPC i no supabase.auth.signUp() des del client:
--   · signUp() SUBSTITUEIX la sessió activa del navegador per la del compte
--     acabat de crear — l'admin que crea un soci nou des del panell quedaria
--     loguejat com aquell soci.
--   · signUp() obliga a confirmació per correu (o a deixar-la desactivada per
--     a tothom); Enric ha decidit (27/07/2026) mantenir l'alta immediata i
--     sense correus, igual que avui.
--   · Un sol camí (RPC) serveix igual per a l'auto-registre i per a l'alta feta
--     per l'admin, i deixa la creació de les dues files (public.users +
--     auth.users) dins d'UNA transacció: o es creen totes dues o cap.
--
-- ABAST DELIBERADAMENT LIMITAT: aquesta migració NO toca cap política RLS.
-- Un cop el client només creï/esborri comptes via aquestes RPC, les polítiques
-- users_insert_self_register / users_insert_admin / users_insert_bootstrap /
-- users_delete_admin_or_self es podrien eliminar (tancaria l'últim camí
-- d'escriptura anònima que queda a public.users). NO es fa aquí perquè la
-- taula `users` és compartida amb Zampa i no sabem encara si Zampa dona altes
-- pel seu compte — cal comprovar-ho abans (vegeu la nota de traspàs a
-- ANALISI_Login_Navegacio.md §1.4). Queda apuntat com a feina de Pas 4d.

-- ═══════════════════════════════════
-- HELPER INTERN — crea el compte a les dues taules
-- ═══════════════════════════════════
-- NO és SECURITY DEFINER a propòsit: quan el criden les funcions de sota
-- (que sí ho són) hereta els seus privilegis, però si algú l'invoqués
-- directament amb la clau anon s'executaria com a anon i l'INSERT a
-- auth.users fallaria per manca de permisos. Tot i així es revoca
-- explícitament l'EXECUTE a PUBLIC, perquè per defecte Postgres el concedeix.
CREATE OR REPLACE FUNCTION public.fem_create_account_row(
  p_id       text,
  p_name     text,
  p_email    text,
  p_password text,
  p_role     text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := gen_random_uuid();
  v_email   text := lower(trim(p_email));
BEGIN
  -- Neteja d'un possible compte orfe a Auth amb aquesta mateixa adreça (restes
  -- d'una baixa feta abans d'aquesta migració, quan public.users s'esborrava
  -- però auth.users no). Sense això, l'INSERT de sota xocaria amb la restricció
  -- d'unicitat d'email d'Auth i la persona no es podria tornar a donar d'alta.
  DELETE FROM auth.users au
    WHERE lower(au.email) = v_email
      AND NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.auth_user_id = au.id);

  -- ORDRE OBLIGATORI: primer auth.users, després public.users. La clau forana
  -- users_auth_user_id_fkey (Pas 1) es comprova immediatament, així que inserir
  -- primer la fila de public.users amb l'auth_user_id apuntant a un compte que
  -- encara no existeix falla amb un 23503 (detectat provant-ho, 27/07/2026).
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', '',
    false, false
  );

  INSERT INTO auth.identities (
    user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_auth_id, v_auth_id::text,
    jsonb_build_object('sub', v_auth_id::text, 'email', v_email),
    'email', now(), now(), now()
  );

  INSERT INTO public.users (id, display_name, email, role, password, created_at, auth_user_id)
    VALUES (p_id, trim(p_name), v_email, p_role, p_password, now(), v_auth_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fem_create_account_row(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════
-- 1) AUTO-REGISTRE PÚBLIC (handleRegister)
-- ═══════════════════════════════════
-- Obert a anon, com avui: l'auto-registre és una funció pública intencionada.
-- El rol SEMPRE és 'participant' — el paràmetre no existeix, així que no es pot
-- escalar privilegis ni cridant l'RPC directament per API.
CREATE OR REPLACE FUNCTION public.fem_register_account(
  p_name text, p_email text, p_password text
)
RETURNS TABLE (
  status       text,
  id           text,
  display_name text,
  email        text,
  role         text,
  created_at   timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := trim(coalesce(p_name, ''));
  v_id    text;
BEGIN
  -- Mateixes validacions que ja fa el formulari al client (defensa al servidor:
  -- l'RPC és cridable directament per API, no només des del formulari).
  IF v_name = '' OR v_email = '' OR coalesce(p_password, '') = ''
     OR length(p_password) < 6
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users tbl WHERE lower(tbl.email) = v_email) THEN
    RETURN QUERY SELECT 'email_exists'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- Mateix format d'id que generava el client ('u_' + Date.now()).
  v_id := 'u_' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  PERFORM public.fem_create_account_row(v_id, v_name, v_email, p_password, 'participant');

  RETURN QUERY SELECT 'ok'::text, tbl.id, tbl.display_name, tbl.email, tbl.role, tbl.created_at
    FROM public.users tbl WHERE tbl.id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_register_account(text, text, text) TO anon, authenticated;

-- ═══════════════════════════════════
-- 2) ALTA FETA PER L'ADMIN (saveMember, "Nou Soci")
-- ═══════════════════════════════════
-- Només admins autenticats (mateixa comprovació fem_is_admin() que ja fan les
-- polítiques RLS del Pas 3b). Aquí sí es pot triar el rol.
CREATE OR REPLACE FUNCTION public.fem_admin_create_member(
  p_name text, p_email text, p_password text, p_role text
)
RETURNS TABLE (
  status       text,
  id           text,
  display_name text,
  email        text,
  role         text,
  created_at   timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := trim(coalesce(p_name, ''));
  v_role  text := coalesce(p_role, 'participant');
  v_id    text;
BEGIN
  IF NOT public.fem_is_admin() THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_name = '' OR v_email = '' OR coalesce(p_password, '') = ''
     OR length(p_password) < 4
     OR v_role NOT IN ('participant', 'admin', 'expert') THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users tbl WHERE lower(tbl.email) = v_email) THEN
    RETURN QUERY SELECT 'email_exists'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  v_id := 'u_' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  PERFORM public.fem_create_account_row(v_id, v_name, v_email, p_password, v_role);

  RETURN QUERY SELECT 'ok'::text, tbl.id, tbl.display_name, tbl.email, tbl.role, tbl.created_at
    FROM public.users tbl WHERE tbl.id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_admin_create_member(text, text, text, text) TO authenticated;

-- ═══════════════════════════════════
-- 3) BAIXA (handleUnsubscribe pròpia / deleteMember d'admin)
-- ═══════════════════════════════════
-- Esborra les DUES files (public.users i auth.users) dins la mateixa
-- transacció. Les fotos i vots segueixen esborrant-se per CASCADE des de
-- public.users, exactament com avui; auth.identities/sessions cauen per
-- CASCADE des d'auth.users.
CREATE OR REPLACE FUNCTION public.fem_delete_account(p_user_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_auth_id uuid;
  v_is_self boolean;
  v_caller  uuid := auth.uid();
BEGIN
  SELECT auth_user_id INTO v_auth_id FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- ⚠️ FORAT DE SEGURETAT DETECTAT I CORREGIT EL 27/07/2026, verificant a
  -- Normal. La primera versió feia directament
  --     v_is_self := (auth_user_id IS NOT NULL AND auth_user_id = auth.uid())
  --     IF NOT (public.fem_is_admin() OR v_is_self) THEN RETURN false;
  -- Per a un cridant ANÒNIM, auth.uid() és NULL, així que
  -- "auth_user_id = auth.uid()" no val false sinó **NULL**; aleshores
  -- "NOT (false OR NULL)" també val NULL, i plpgsql tracta un IF NULL com a
  -- fals → el RETURN false no s'executava i **qualsevol persona amb la clau
  -- anon podia esborrar el compte de qualsevol soci** (amb les seves fotos i
  -- vots per CASCADE). Ara la comparació només es fa si hi ha realment un
  -- cridant autenticat, i a més es revoca l'EXECUTE a `anon` (defensa doble:
  -- el privilegi barra la crida abans i tot d'arribar a aquesta lògica).
  --
  -- Lliçó per a proves futures: la prova que "demostrava" que això estava
  -- tancat a Test era falsa — feia servir un id d'usuari INEXISTENT, així que
  -- sortia pel RETURN false de "NOT FOUND" sense arribar mai a avaluar
  -- l'autorització. Cal provar sempre amb una fila que existeixi de debò.
  v_is_self := (v_caller IS NOT NULL AND v_auth_id IS NOT NULL AND v_auth_id = v_caller);

  -- Mateixa regla que la política users_delete_admin_or_self del Pas 3b.
  IF NOT (public.fem_is_admin() OR coalesce(v_is_self, false)) THEN
    RETURN false;
  END IF;

  DELETE FROM public.users WHERE id = p_user_id;
  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_delete_account(text) TO authenticated;
-- Les dues baixes de l'app (pròpia i d'admin) sempre es fan des d'una sessió
-- iniciada, així que `anon` no necessita cridar-la mai.
REVOKE EXECUTE ON FUNCTION public.fem_delete_account(text) FROM PUBLIC, anon;

-- ═══════════════════════════════════
-- 4) BOOTSTRAP AMB LA BD BUIDA (initializeDB)
-- ═══════════════════════════════════
-- Només executable mentre public.users està buida — el mateix invariant que ja
-- fan servir el client (state.users.length === 0) i les polítiques
-- users_insert_bootstrap / app_settings_insert_bootstrap del Pas 3b.
--
-- Crea TAMBÉ les tres files d'app_settings dins la mateixa crida, i no per
-- separat des del client: la política app_settings_insert_bootstrap exigeix que
-- `users` estigui buida, així que un cop creat l'admin el client ja no les
-- podria inserir (l'ordre actual d'initializeDB() hi topava — bug latent del
-- Pas 3b que aquesta funció tanca de passada).
CREATE OR REPLACE FUNCTION public.fem_bootstrap_admin(
  p_name text, p_email text, p_password text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := trim(coalesce(p_name, ''));
BEGIN
  IF EXISTS (SELECT 1 FROM public.users LIMIT 1) THEN RETURN false; END IF;
  IF v_name = '' OR v_email = '' OR coalesce(p_password, '') = '' THEN RETURN false; END IF;

  PERFORM public.fem_create_account_row('u_admin_1', v_name, v_email, p_password, 'admin');

  INSERT INTO public.app_settings (id, key, value, updated_at, updated_by) VALUES
    ('cfg_uploads',  'uploads_enabled', 'true',  now(), 'system'),
    ('cfg_voting',   'voting_enabled',  'false', now(), 'system'),
    ('cfg_revealed', 'names_revealed',  'false', now(), 'system')
  ON CONFLICT (id) DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_bootstrap_admin(text, text, text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK: sql/2026-07-27_auth_migracio_pas4a_rollback.sql (esborra les
-- funcions). Com que aquesta migració és purament additiva (cap política ni
-- taula tocada), desfer-la només requereix tornar enrere el codi de client
-- (git revert) — l'app tornaria a inserir directament a public.users, que les
-- polítiques del Pas 3b encara permeten.
--
-- CANVIS DE CLIENT QUE ACOMPANYEN AQUESTA MIGRACIÓ (no desplegar a Normal fins
-- que la migració hi sigui aplicada):
--   · js/screens/login.js  — handleRegister(), initializeDB(), handleUnsubscribe()
--   · js/features/socis.js — saveMember() (branca d'alta nova), deleteMember()
