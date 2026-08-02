-- Incidència 5.4 (docs/PROVES_Fase4.md) — "no deixa tornar a votar el mateix
-- repte" un cop enviada la votació definitiva, només es feia complir a la
-- interfície, no al servidor.
--
-- `handleStar()`/`_applyPuntuacio()` (votacio.js) comproven `isVotingSubmitted()`
-- abans de deixar clicar, però ni `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()`
-- ni la política RLS (`votes_insert_own`/`votes_update_own`, ja tocades per la
-- incidència 5.5) comprovaven `seguiment_votacio.es_esborrany`. Provat
-- l'01/08/2026 a Test: amb el compte de prova amb la votació ja **enviada**
-- (`es_esborrany=false`, `submitted_at` fixat), una crida `PATCH` directa a
-- l'API REST de Supabase (mateix testimoni de sessió normal, sense passar per
-- `handleStar`) va canviar `theme` d'un vot ja enviat — `200 OK`. Es trenca la
-- promesa literal del modal d'enviament: "Un cop enviada NO podràs canviar cap
-- vot." Revertit tot seguit.
--
-- Fix: el WITH CHECK exigeix, a més de les comprovacions de la 5.5, que NO hi
-- hagi cap fila a `seguiment_votacio` per aquest user_id/objective_id amb
-- `es_esborrany = false`. Es toca INSERT i UPDATE pel mateix motiu que a 5.5:
-- una crida directa podria tant actualitzar un vot existent com inserir-ne un
-- de nou (una foto que no s'havia arribat a puntuar) després d'enviar.
--
-- ⚠️ Mateix parany que a 5.5: `seguiment_votacio` també té columnes `user_id`
-- i `objective_id`. Tot qualificat explícitament amb `votes.` i `sv.` — cap
-- referència sense qualificar — i verificat amb pg_get_expr() abans de provar
-- res més, per no repetir el bloqueig accidental de tots els vots.
--
-- Company del canvi de client a `js/features/votacio.js` (`saveVoteOnClick()`
-- i `saveVoteOnClickPuntuacio()`), que afegeix la mateixa guarda que ja tenen
-- `handleStar()`/`_applyPuntuacio()` — purament defensiva, la protecció real
-- és aquesta política.
--
-- Rollback: sql/2026-08-01_incidencia_5.4_rls_vot_ja_enviat_rollback.sql
-- (recrea les dues polítiques tal com havien quedat després de la 5.5).

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
