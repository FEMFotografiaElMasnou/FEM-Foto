-- ROLLBACK de sql/2026-08-02_socis_fem_autoritzats.sql.
--
-- Torna fem_register_account a l'estat previ (rol sempre 'participant', sense
-- filtre de cens) i esborra la taula sencera (CASCADE se'n emporta les 4
-- polítiques). Torna a obrir el forat: qualsevol pot autoregistrar-se sense
-- ser del cens de la FEM.

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

  v_id := 'u_' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  PERFORM public.fem_create_account_row(v_id, v_name, v_email, p_password, 'participant');

  RETURN QUERY SELECT 'ok'::text, tbl.id, tbl.display_name, tbl.email, tbl.role, tbl.created_at
    FROM public.users tbl WHERE tbl.id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_register_account(text, text, text) TO anon, authenticated;

DROP TABLE IF EXISTS public.socis_fem_autoritzats CASCADE;
