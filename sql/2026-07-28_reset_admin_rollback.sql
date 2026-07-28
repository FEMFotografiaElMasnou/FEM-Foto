-- ═══════════════════════════════════════════════════════════════════════════
-- MARXA ENRERE del Reset de contrasenya per l'admin (28/07/2026)
-- Desfà les PARTS 1 i 2 de `2026-07-28_reset_admin_contrasenya_temporal.sql`
-- i `2026-07-28_reset_admin_part2_tancament.sql`.
--
-- ⚠️ Executar-lo torna a obrir el forat que aquelles migracions tanquen: amb
-- això aplicat, qualsevol amb la clau anon pública i l'email d'un soci que
-- tingui la contrasenya buida li pot posar una de nova i entrar-hi. Només té
-- sentit si cal tornar al codi antic de les dues apps.
--
-- ORDRE de la reversió (l'invers de l'aplicació):
--   1) aquest fitxer a la BD
--   2) revertir el codi de les dues apps (git revert del commit del Reset nou)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Desfà la PART 2: fem_login torna a retornar 'reset_required' ────────
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

-- ── 1b) Desfà la PART 2: text del modal de confirmació del Reset ──────────
UPDATE public.app_texts
   SET content = jsonb_set(content, '{member_reset_confirm_msg}',
         to_jsonb('Segur que vols resetejar la contrasenya de {name}? El soci haurà de crear-ne una de nova al pròxim accés. Les seves puntuacions i fotos NO es perden.'::text)),
       updated_at = now(),
       updated_by = 'rollback_reset_admin_28072026'
 WHERE lang = 'ca';

UPDATE public.app_texts
   SET content = jsonb_set(content, '{member_reset_confirm_msg}',
         to_jsonb('¿Seguro que quieres resetear la contraseña de {name}? El socio tendrá que crear una nueva en el próximo acceso. Sus puntuaciones y fotos NO se pierden.'::text)),
       updated_at = now(),
       updated_by = 'rollback_reset_admin_28072026'
 WHERE lang = 'es';

-- ── 2) Desfà la PART 2: torna a obrir fem_set_new_password ────────────────
GRANT EXECUTE ON FUNCTION public.fem_set_new_password(text, text) TO anon, authenticated;

-- ── 3) Desfà la PART 1: retira la funció nova ─────────────────────────────
DROP FUNCTION IF EXISTS public.fem_admin_reset_password(text);

-- ── Verificació ───────────────────────────────────────────────────────────
--   select has_function_privilege('anon', 'public.fem_set_new_password(text,text)', 'execute');
--     → true
--   select to_regprocedure('public.fem_admin_reset_password(text)');
--     → NULL
