-- Incidència 5.5 (docs/PROVES_Fase4.md) — "no pots votar la teva pròpia foto"
-- només es feia complir a la interfície, no al servidor.
--
-- Les polítiques `votes_insert_own` i `votes_update_own` només comprovaven
-- `user_id = fem_current_user_id()`. Cap comprovava que `photo_id` no fos
-- una foto del mateix votant. Provat l'01/08/2026 a Test: amb la sessió
-- normal d'un compte de prova, cridant per consola `window.handleStar(
-- '<foto pròpia>', 'creativity', 5, ...)` (funció global, sense cap
-- comprovació de propietat en tot el seu camí) es va desar un vot sobre la
-- pròpia foto amb normalitat.
--
-- Fix: el WITH CHECK exigeix, a més del user_id propi, que la foto votada
-- NO pertanyi al mateix votant. Sense excepció d'admin: a diferència de la
-- pujada (4.2), aquí no hi ha cap bypass legítim documentat — un admin que
-- vota, vota com qualsevol soci.
--
-- Es toquen INSERT i UPDATE (no només INSERT com a 4.2): l'`upsert()` del
-- client fa UPDATE quan ja existeix fila per (user_id, photo_id,
-- objective_id), i una política UPDATE sense WITH CHECK propi hereta el
-- USING com a comprovació — que tampoc mirava `photo_id`. Sense tocar-la,
-- una crida directa (no pas l'`upsert()` normal, que mai apunta a una foto
-- pròpia) podria reassignar `photo_id` cap a una foto pròpia en una fila ja
-- existent.
--
-- Company del canvi de client a `js/features/votacio.js` (`saveVoteOnClick()`
-- i `saveVoteOnClickPuntuacio()`), que afegeix la mateixa guarda que ja té
-- `uploadPhoto()` des de la 4.2 — purament defensiva, la protecció real és
-- aquesta política.
--
-- ⚠️ `photo_submissions` també té una columna `user_id`: dins del NOT EXISTS,
-- `user_id` sense qualificar és ambigu i el resol contra l'`ps` de la
-- subconsulta (l'escopi més intern guanya), no contra la fila de `votes`.
-- La primera versió d'aquesta migració (aplicada i corregida el mateix
-- moment, 01/08/2026, abans de tocar cap altra fila) queia en això:
-- `ps.user_id = user_id` es tornava `ps.user_id = ps.user_id`, sempre cert,
-- i com que `photo_id` sempre existeix (FK), el NOT EXISTS quedava sempre
-- fals — bloquejant **tots** els vots, no només els propis. Cal qualificar
-- explícitament amb `votes.user_id` i `votes.photo_id`.
--
-- Rollback: sql/2026-08-01_incidencia_5.5_rls_autovot_rollback.sql
-- (recrea les dues polítiques tal com estaven).

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
