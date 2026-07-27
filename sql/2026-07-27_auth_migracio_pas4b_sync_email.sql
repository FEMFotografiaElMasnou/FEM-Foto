-- Migració a Supabase Auth (opció C, ANALISI_Login_Navegacio.md §1.4) — Pas 4b
--
-- PROBLEMA QUE TANCA
-- A partir del Pas 4b, qui decideix l'accés és Supabase Auth
-- (signInWithPassword) i la identitat es resol per EMAIL. Però el panell de
-- Socis (`saveMember()`, js/features/socis.js) canviava l'email amb un UPDATE
-- directe sobre `public.users`, sense tocar `auth.users`. Efecte: aquell soci
-- es quedava amb l'email nou a l'app i el vell a Auth, així que
-- signInWithPassword amb l'adreça nova fallaria sempre — cauria al camí de
-- reserva (fem_login), entraria sense sessió real i no podria votar ni pujar
-- fotos. És el mateix patró de desincronització que ja es va haver de resoldre
-- per a les contrasenyes al Pas 3b (fem_set_new_password /
-- fem_admin_set_password): qualsevol dada d'identitat que visqui a les dues
-- taules s'ha d'escriure a totes dues alhora.
--
-- Igual que aquelles, es fa amb una funció SECURITY DEFINER: el client no té
-- (ni ha de tenir) accés d'escriptura a l'esquema `auth`.

CREATE OR REPLACE FUNCTION public.fem_admin_set_email(p_user_id text, p_new_email text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_auth_id uuid;
  v_email   text := lower(trim(coalesce(p_new_email, '')));
BEGIN
  IF NOT public.fem_is_admin() THEN RETURN false; END IF;

  IF v_email = '' OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN false;
  END IF;

  SELECT auth_user_id INTO v_auth_id FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- L'adreça no pot ser la d'un altre soci (la restricció UNIQUE de
  -- public.users ja ho garantiria, però així retornem false en lloc de petar).
  IF EXISTS (
    SELECT 1 FROM public.users tbl
     WHERE lower(tbl.email) = v_email AND tbl.id <> p_user_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.users SET email = v_email WHERE id = p_user_id;

  IF v_auth_id IS NOT NULL THEN
    UPDATE auth.users
       SET email = v_email, updated_at = now()
     WHERE id = v_auth_id;

    -- identity_data guarda una còpia de l'email; deixar-la enrere no trenca el
    -- login, però sí que confon qualsevol diagnòstic futur al tauler d'Auth.
    UPDATE auth.identities
       SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_email)),
           updated_at = now()
     WHERE user_id = v_auth_id AND provider = 'email';
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_admin_set_email(text, text) TO authenticated;
-- Nomes un admin autenticat; `anon` no l'ha de poder cridar mai (la funcio ja
-- ho comprova internament, pero el privilegi es una segona barrera — mateixa
-- lliçó del forat detectat al Pas 4a amb fem_delete_account).
REVOKE EXECUTE ON FUNCTION public.fem_admin_set_email(text, text) FROM PUBLIC, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK: DROP FUNCTION IF EXISTS public.fem_admin_set_email(text, text);
-- (additiu, no toca cap política ni cap dada; cal revertir també el codi de
-- client que la crida — js/features/socis.js, saveMember)
