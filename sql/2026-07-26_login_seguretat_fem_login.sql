-- Tanca l'exposició detectada a ANALISI_Login_Navegacio.md §1.2 (2026-07-26):
-- avui qualsevol persona amb la clau anon (pública per disseny) pot llegir
-- en clar la contrasenya de qualsevol usuari via l'API REST de Supabase,
-- perquè handleLogin() la compara en JS al client.
--
-- fem_login() mou la verificació al servidor: rep identitat+contrasenya i
-- retorna només status ('ok' | 'reset_required' | 'invalid') + dades no
-- sensibles de l'usuari — mai la contrasenya. Un cop el client deixa de
-- necessitar llegir-la per fer login, es revoca l'accés directe a la
-- columna per a anon/authenticated.
--
-- No toca cap altra política RLS (les escriptures obertes detectades a
-- l'anàlisi queden fora d'abast d'aquest canvi, decisió explícita d'Enric).

CREATE OR REPLACE FUNCTION public.fem_login(p_identity text, p_password text)
RETURNS TABLE (
  status       text,
  id           text,
  display_name text,
  email        text,
  role         text,
  created_at   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u record;
BEGIN
  -- Àlies "tbl" obligatori: sense ell, "email"/"display_name"/"id" són
  -- ambigus contra els paràmetres de sortida (RETURNS TABLE) del mateix nom.
  SELECT tbl.* INTO u FROM public.users tbl
    WHERE lower(tbl.email) = lower(trim(p_identity))
       OR lower(tbl.display_name) = lower(trim(p_identity))
    ORDER BY tbl.id
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF trim(coalesce(u.password, '')) = '' THEN
    RETURN QUERY SELECT 'reset_required'::text, u.id, u.display_name, u.email, u.role, u.created_at;
    RETURN;
  END IF;

  IF trim(u.password) = trim(coalesce(p_password, '')) THEN
    RETURN QUERY SELECT 'ok'::text, u.id, u.display_name, u.email, u.role, u.created_at;
  ELSE
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_login(text, text) TO anon, authenticated;

-- Amaga la columna password de qualsevol lectura directa des del client.
-- Les escriptures (INSERT/UPDATE per registre, reset, edició d'admin) no es
-- toquen — no calen permisos de SELECT per fer-les.
--
-- IMPORTANT (verificat 2026-07-26 a Test): un REVOKE de columna sol NO fa
-- res si el rol ja té SELECT a nivell de taula (l'accés ve del permís de
-- taula, no es crea cap ACL de columna a revocar — comprovat amb
-- has_column_privilege(), seguia donant true després del REVOKE). Cal
-- revocar la taula sencera i re-concedir explícitament totes les columnes
-- EXCEPTE password (la taula es comparteix amb Zampa — vegeu risc ja
-- documentat a FEM-Foto_Unificacio_Pla-desenvolupament.md §6 — per això es
-- mantenen totes les altres columnes, incloent zampa_role/submitted_at,
-- en lloc de restringir-ho només a les que fa servir Foto).
REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT SELECT (id, display_name, email, role, zampa_role, submitted_at, created_at)
  ON public.users TO anon, authenticated;
