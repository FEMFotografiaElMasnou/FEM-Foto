-- ═══════════════════════════════════════════════════════════════════════════
-- Reset de contrasenya per l'admin — PART 2 (tancament)
-- 28/07/2026
--
-- Tanca el mecanisme de "contrasenya buida" que la PART 1 substitueix.
-- Vegeu el capçal de `2026-07-28_reset_admin_contrasenya_temporal.sql` per al
-- detall del forat i de com es va comprovar.
--
-- ⚠️ ORDRE OBLIGATORI: aquesta part s'aplica DESPRÉS que el codi nou estigui
-- desplegat a LES DUES apps (FEM-Foto i FEM-Reptes, que comparteixen aquesta
-- base de dades). Retira la via que el codi antic feia servir per tornar del
-- reset; mentre el codi antic sigui viu, aplicar-la abans deixaria sense sortida
-- qualsevol soci que ja tingués la contrasenya buida. El dia d'aplicar-la n'hi
-- havia 0 a tots dos entorns, però l'ordre és el que fa que això no depengui
-- de la sort:
--
--   1) PART 1 a la BD (additiva, no canvia res del comportament actual)
--   2) desplegar FEM-Foto i FEM-Reptes amb el Reset nou
--   3) PART 2 a la BD (aquest fitxer)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) fem_set_new_password: fora de l'abast de tothom ─────────────────────
-- No s'esborra (mateix criteri de "amagar, no esborrar" de la Fase 3 i del Pas
-- 4d): es queda al catàleg sense que ningú la pugui cridar. Era l'única via
-- anònima per escriure una contrasenya a partir només d'un id d'usuari, i això
-- no es pot fer segur — si el soci no té sessió, no té res amb què demostrar
-- qui és. El seu substitut segons el cas: fem_admin_reset_password() (l'admin
-- reinicia) o fem_set_own_password() (Pas 4c, identitat treta d'auth.uid()).
--
-- ⚠️ Cal incloure-hi PUBLIC: aquesta funció també té `=X/postgres` a la seva
-- ACL (EXECUTE a PUBLIC, que és el que rep tota funció nova per defecte).
-- Revocar-lo només a anon i authenticated no tancaria res.
REVOKE EXECUTE ON FUNCTION public.fem_set_new_password(text, text) FROM PUBLIC, anon, authenticated;

-- ── 2) fem_login: la contrasenya buida deixa de ser una porta ──────────────
-- Abans retornava 'reset_required' + el perfil sencer a qui ho demanés, sense
-- comprovar cap contrasenya. Ara una contrasenya buida a la BD és simplement
-- un compte pel qual no es pot entrar per aquest camí: 'invalid'.
--
-- El `IF ... = ''` s'ha de mantenir explícitament: sense ell, la comparació
-- de sota faria que una contrasenya buida a la BD encaixés amb un p_password
-- buit i tornés 'ok'. FEM-Reptes decideix l'accés amb el resultat d'aquesta
-- funció, així que això hi seria una entrada real sense contrasenya.
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

  -- Contrasenya buida a la BD: cap entrada per aquí (abans: 'reset_required').
  IF trim(coalesce(u.password, '')) = '' THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
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

-- ── 3) El text del modal de confirmació del Reset ──────────────────────────
-- `app_texts` (Fase 2) es fusiona PER SOBRE del diccionari de js/core/i18n.js
-- (mergeTranslations), i aquesta clau hi és des del 15/07/2026: canviar-la
-- només al codi no té cap efecte. Cal fer-ho aquí, o l'admin seguiria llegint
-- que "el soci haurà de crear-ne una de nova al pròxim accés", que amb la
-- contrasenya temporal ja no és el que passa.
--
-- Les claus noves (temp_pwd_*) NO s'hi afegeixen: no són a la BD, i el codi ja
-- és la xarxa de seguretat per a les claus que la BD no té.
UPDATE public.app_texts
   SET content = jsonb_set(content, '{member_reset_confirm_msg}',
         to_jsonb('Segur que vols resetejar la contrasenya de {name}? Se li assignarà una contrasenya temporal que li hauràs de fer arribar, i deixarà de poder entrar amb la que tenia. Les seves puntuacions i fotos NO es perden.'::text)),
       updated_at = now(),
       updated_by = 'migracio_reset_admin_28072026'
 WHERE lang = 'ca';

UPDATE public.app_texts
   SET content = jsonb_set(content, '{member_reset_confirm_msg}',
         to_jsonb('¿Seguro que quieres resetear la contraseña de {name}? Se le asignará una contraseña temporal que tendrás que hacerle llegar, y dejará de poder entrar con la que tenía. Sus puntuaciones y fotos NO se pierden.'::text)),
       updated_at = now(),
       updated_by = 'migracio_reset_admin_28072026'
 WHERE lang = 'es';

-- ── Verificació ────────────────────────────────────────────────────────────
--   select lang, left(content->>'member_reset_confirm_msg', 70) from public.app_texts;
--     → ha de parlar de "contrasenya temporal", no de "crear-ne una de nova"
--   select has_function_privilege('anon', 'public.fem_set_new_password(text,text)', 'execute');
--     → false   (i el mateix per a 'authenticated')
--   select * from public.fem_login('<email d'un soci real>', 'una-que-no-es');
--     → invalid
--   Amb un compte d'un sol ús amb la contrasenya buida a public.users:
--   select * from public.fem_login('<el seu email>', '');
--     → invalid   (abans: 'ok', que a FEM-Reptes era entrar sense contrasenya)
