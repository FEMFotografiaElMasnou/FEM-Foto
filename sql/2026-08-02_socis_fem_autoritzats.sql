-- Filtre d'alta: només socis de la FEM poden crear-se un compte a l'app.
--
-- Decisió (vegeu conversa 02/08/2026): taula separada (opció A), NO una
-- columna a `public.users`. `users` és compartida amb l'app Zampa i una fila
-- hi vol dir "compte real" (fem_register_account en crea l'auth.users a la
-- mateixa transacció); el cens ha d'incloure socis que ENCARA NO són usuaris
-- de l'app, cosa que amb una columna a `users` hauria obligat a pre-carregar-hi
-- files sense compte real — trencant aquesta invariant i el que ja llegeix
-- Zampa. Una taula a part no toca `users` per res.
--
-- Rollback a sql/2026-08-02_socis_fem_autoritzats_rollback.sql.

-- ═══════════════════════════════════
-- 1) TAULA
-- ═══════════════════════════════════
-- Només email + rol per defecte (el rol amb què es crearà el compte si mai
-- s'autoregistra amb aquest email). Sense columna de nom: és un cens
-- d'autorització, no una fitxa de soci.
CREATE TABLE public.socis_fem_autoritzats (
  email          text PRIMARY KEY,
  rol_per_defecte text NOT NULL DEFAULT 'participant'
                   CHECK (rol_per_defecte IN ('participant', 'expert', 'admin')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.socis_fem_autoritzats ENABLE ROW LEVEL SECURITY;

-- Només admins autenticats hi tenen accés directe (ni tan sols lectura per a
-- anon/authenticated normal): així no es pot fer servir per confirmar si un
-- email concret és o no del cens abans de provar-lo a fem_register_account.
CREATE POLICY socis_fem_autoritzats_select_admin ON public.socis_fem_autoritzats
  FOR SELECT TO authenticated USING (public.fem_is_admin());
CREATE POLICY socis_fem_autoritzats_insert_admin ON public.socis_fem_autoritzats
  FOR INSERT TO authenticated WITH CHECK (public.fem_is_admin());
CREATE POLICY socis_fem_autoritzats_update_admin ON public.socis_fem_autoritzats
  FOR UPDATE TO authenticated USING (public.fem_is_admin()) WITH CHECK (public.fem_is_admin());
CREATE POLICY socis_fem_autoritzats_delete_admin ON public.socis_fem_autoritzats
  FOR DELETE TO authenticated USING (public.fem_is_admin());

-- ═══════════════════════════════════
-- 2) CÀRREGA INICIAL
-- ═══════════════════════════════════
-- Tothom que ja té compte avui queda autoritzat amb el seu rol actual, perquè
-- ningú actual quedi tancat fora si mai calgués tornar-se a registrar. Sense
-- duplicats ni emails buits comprovat abans (Test i Normal, 02/08/2026).
INSERT INTO public.socis_fem_autoritzats (email, rol_per_defecte)
SELECT lower(trim(email)), role
FROM public.users
WHERE email IS NOT NULL AND trim(email) <> ''
ON CONFLICT (email) DO NOTHING;

-- ═══════════════════════════════════
-- 3) FILTRE A L'AUTO-REGISTRE
-- ═══════════════════════════════════
-- Mateixa funció, amb dues novetats:
--   · si l'email no és al cens, retorna 'not_authorized' abans de crear res;
--   · el rol ja no és sempre 'participant': el pren de rol_per_defecte, cosa
--     que permet pre-autoritzar un Expert (o futur rol) abans que s'hagi
--     registrat mai. Segueix sense ser un paràmetre de la crida — només un
--     admin pot escriure a socis_fem_autoritzats (RLS de dalt), així que no
--     es pot escalar privilegis cridant l'RPC directament per API.
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
  v_role  text;
BEGIN
  -- Mateixes validacions que ja fa el formulari al client (defensa al servidor:
  -- l'RPC és cridable directament per API, no només des del formulari).
  IF v_name = '' OR v_email = '' OR coalesce(p_password, '') = ''
     OR length(p_password) < 6
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT sfa.rol_per_defecte INTO v_role
    FROM public.socis_fem_autoritzats sfa WHERE sfa.email = v_email;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_authorized'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users tbl WHERE lower(tbl.email) = v_email) THEN
    RETURN QUERY SELECT 'email_exists'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- Mateix format d'id que generava el client ('u_' + Date.now()).
  v_id := 'u_' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  PERFORM public.fem_create_account_row(v_id, v_name, v_email, p_password, v_role);

  RETURN QUERY SELECT 'ok'::text, tbl.id, tbl.display_name, tbl.email, tbl.role, tbl.created_at
    FROM public.users tbl WHERE tbl.id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fem_register_account(text, text, text) TO anon, authenticated;
