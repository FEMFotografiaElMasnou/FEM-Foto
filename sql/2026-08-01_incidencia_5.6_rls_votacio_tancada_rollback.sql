-- Marxa enrere de 2026-08-01_incidencia_5.6_rls_votacio_tancada.sql
-- Torna `votes_insert_own` i `votes_update_own` a l'estat de després de la
-- incidència 5.4 (autovot i vot ja enviat bloquejats, però es podia votar
-- amb la votació tancada per crida directa).
--
-- ⚠️ Desfer això reobre la incidència 5.6: un soci amb una crida directa a
-- l'API podria tornar a votar fora de termini. Si es desfà, desfer també la
-- guarda afegida a `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()` per a
-- aquesta incidència concreta a js/features/votacio.js.

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
    AND NOT EXISTS (
      SELECT 1 FROM public.seguiment_votacio sv
      WHERE sv.user_id = votes.user_id
        AND sv.objective_id = votes.objective_id
        AND sv.es_esborrany = false
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
    AND NOT EXISTS (
      SELECT 1 FROM public.seguiment_votacio sv
      WHERE sv.user_id = votes.user_id
        AND sv.objective_id = votes.objective_id
        AND sv.es_esborrany = false
    )
  );
