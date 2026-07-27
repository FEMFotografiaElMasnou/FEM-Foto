-- Migració a Supabase Auth (opció C, ANALISI_Login_Navegacio.md §1.4) — Pas 4c
--
-- QUÈ AFEGEIX EL PAS 4c
-- Recuperació de contrasenya per correu (resetPasswordForEmail) i accés amb
-- enllaç màgic (signInWithOtp), tots dos desbloquejats pel Pas 4b.
--
-- PROBLEMA QUE TANCA AQUESTA MIGRACIÓ
-- El reset per correu de Supabase només canvia `auth.users.encrypted_password`.
-- A `public.users.password` hi quedaria la contrasenya ANTIGA en clar, i el
-- camí de reserva del Pas 4b (`fem_login()`, js/screens/login.js) l'acceptaria
-- perfectament: qui sabés la contrasenya vella seguiria entrant a l'app després
-- del reset (sense poder escriure, perquè no tindria sessió real d'Auth i la
-- RLS del Pas 3b/3c el bloquejaria, però veient totes les dades). Un reset que
-- no revoca la contrasenya anterior no és un reset.
--
-- És exactament el mateix patró de desincronització ja resolt al Pas 3b per al
-- reset fet per un admin (fem_set_new_password / fem_admin_set_password) i al
-- Pas 4b per a l'email (fem_admin_set_email): qualsevol dada d'identitat que
-- visqui a les dues taules s'ha d'escriure a totes dues alhora, dins la mateixa
-- transacció. Aquí en falta el tercer cas: el propi usuari canviant-se la
-- contrasenya des d'una sessió de recuperació.
--
-- PER QUÈ UNA RPC I NO `supabase.auth.updateUser({ password })`
-- updateUser només tocaria `auth.users` — deixaria el forat descrit a dalt
-- obert. Caldria una segona crida per a `public.users` i les dues no serien
-- atòmiques: si la segona fallés, l'usuari es quedaria amb dues contrasenyes
-- vàlides diferents. Amb la RPC és una sola crida i una sola transacció, i fa
-- servir la mateixa tècnica de bcrypt ja validada al Pas 2 i al Pas 3b.

-- ═══════════════════════════════════════════════════════════════════════════
-- fem_set_own_password — l'usuari autenticat es canvia la seva contrasenya
-- ═══════════════════════════════════════════════════════════════════════════
-- No rep cap identificador d'usuari: la identitat surt EXCLUSIVAMENT de
-- auth.uid(), és a dir de la sessió que el propi Supabase Auth ha establert en
-- validar l'enllaç del correu. Així ningú pot canviar la contrasenya d'un
-- tercer ni tot i cridant l'RPC directament per API.
CREATE OR REPLACE FUNCTION public.fem_set_own_password(p_new_password text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_user_id text;
BEGIN
  -- LLIÇÓ DEL PAS 4a (forat de fem_delete_account): amb un caller anònim
  -- auth.uid() és NULL, i qualsevol comparació amb NULL dona NULL — que plpgsql
  -- tracta com a fals dins un IF, saltant-se el RETURN de denegació. Per això la
  -- comprovació és explícitament `IS NULL` i surt aquí mateix, sense comparar
  -- res amb res.
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Mateix mínim que valida el modal de nova contrasenya del client.
  IF p_new_password IS NULL OR length(p_new_password) < 4 THEN
    RETURN false;
  END IF;

  SELECT id INTO v_user_id FROM public.users WHERE auth_user_id = v_uid;
  IF NOT FOUND THEN
    -- Sessió d'Auth sense fila a public.users: estat inconsistent, no hi ha
    -- res a sincronitzar i no s'ha de tocar auth.users a cegues.
    RETURN false;
  END IF;

  UPDATE public.users SET password = p_new_password WHERE id = v_user_id;

  UPDATE auth.users
     SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id = v_uid;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_set_own_password(text) TO authenticated;
-- `anon` no l'ha de poder cridar mai: sense sessió no hi ha res a canviar. La
-- funció ja ho comprova internament, però el privilegi és la segona barrera
-- (mateixa lliçó del forat detectat al Pas 4a amb fem_delete_account).
REVOKE EXECUTE ON FUNCTION public.fem_set_own_password(text) FROM PUBLIC, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK: sql/2026-07-27_auth_migracio_pas4c_rollback.sql
-- (additiu: crea una funció i no toca cap política RLS ni cap dada)
