-- Marxa enrere de 2026-08-01_incidencia_5.4_rls_vot_ja_enviat.sql
-- Torna `votes_insert_own` i `votes_update_own` a l'estat de després de la
-- incidència 5.5 (self-vot bloquejat, però un vot ja enviat encara es podia
-- reobrir per crida directa).
--
-- ⚠️ Desfer això reobre la incidència 5.4: un soci amb una crida directa a
-- l'API podria tornar a canviar un vot ja enviat. Si es desfà, desfer també
-- la guarda afegida a `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()` a
-- js/features/votacio.js.

DROP POLICY IF EXISTS votes_insert_own ON public.votes;
DROP POLICY IF EXISTS votes_update_own ON public.votes;

CREATE POLICY votes_insert_own ON public.votes
  FOR INSERT TO authenticated
  WITH CHECK (
    votes.user_id = public.fem_current_user_id()
    AND NOT EXISTS (
      SELECT 1 FROM public.photo_submissions ps
      WHERE ps.id = votes.photo_id AND ps.user_id = votes.user_id
    )
  );

CREATE POLICY votes_update_own ON public.votes
  FOR UPDATE TO authenticated
  USING (votes.user_id = public.fem_current_user_id())
  WITH CHECK (
    votes.user_id = public.fem_current_user_id()
    AND NOT EXISTS (
      SELECT 1 FROM public.photo_submissions ps
      WHERE ps.id = votes.photo_id AND ps.user_id = votes.user_id
    )
  );
