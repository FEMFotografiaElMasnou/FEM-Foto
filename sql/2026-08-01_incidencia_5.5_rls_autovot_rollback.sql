-- Marxa enrere de 2026-08-01_incidencia_5.5_rls_autovot.sql
-- Torna `votes_insert_own` i `votes_update_own` a l'estat d'abans: només
-- comproven el user_id propi, sense mirar si la foto votada és seva.
--
-- ⚠️ Desfer això reobre la incidència 5.5: un soci amb la consola oberta
-- podria tornar a votar-se la pròpia foto. Si es desfà, desfer també la
-- guarda afegida a `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()` a
-- js/features/votacio.js.

DROP POLICY IF EXISTS votes_insert_own ON public.votes;
DROP POLICY IF EXISTS votes_update_own ON public.votes;

CREATE POLICY votes_insert_own ON public.votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.fem_current_user_id());

CREATE POLICY votes_update_own ON public.votes
  FOR UPDATE TO authenticated
  USING (user_id = public.fem_current_user_id());
