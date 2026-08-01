-- Marxa enrere de 2026-07-31_incidencia_4.2_rls_pujada_tancada.sql
-- Torna `photo_submissions_insert_own` a l'estat d'abans (Pas 3b/3c, 27/07/2026):
-- només comprova el user_id propi, sense mirar `uploads_enabled` del repte.
--
-- ⚠️ Desfer això reobre la incidència 4.2: un soci amb la consola oberta podria
-- tornar a pujar fotos amb la pujada tancada. Si es desfà, desfer també la
-- guarda afegida a `uploadPhoto()` a js/features/fotos.js.

DROP POLICY IF EXISTS photo_submissions_insert_own ON public.photo_submissions;

CREATE POLICY photo_submissions_insert_own ON public.photo_submissions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.fem_current_user_id());
