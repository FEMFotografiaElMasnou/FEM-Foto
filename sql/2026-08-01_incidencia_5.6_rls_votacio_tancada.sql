-- Incidència 5.6 (docs/PROVES_Fase4.md) — "votar amb la votació tancada.
-- No hi ha camí, i una crida directa tampoc no cola" — la segona part no era
-- certa: la crida directa sí que colava.
--
-- `handleStar()`/`_applyPuntuacio()` (votacio.js) comproven `state.settings
-- .voting_enabled` (mirall de `objectives.voting_enabled` del repte actiu)
-- abans de deixar clicar, però ni `saveVoteOnClick()`/`saveVoteOnClickPuntuacio()`
-- ni cap política RLS comprovaven mai `voting_enabled`. Provat l'01/08/2026 a
-- Test: amb «Repte de proves» tancat (`voting_mode='tancat'`,
-- `voting_enabled=false`) i el compte de prova «TEST Bloc5 B» sense cap
-- votació enviada encara, un `POST` directe a l'API REST (mateix testimoni
-- de sessió normal) va crear un vot nou sobre una foto que mai s'havia
-- votat — `201 Created`. Esborrat tot seguit.
--
-- Fix: el WITH CHECK exigeix, a més de les comprovacions de 5.4 i 5.5, que
-- el repte referenciat estigui `status='active'` I `voting_enabled=true`.
-- Es comprova també `status='active'` (no només `voting_enabled`) perquè un
-- repte `inactive` pot arrossegar `voting_enabled=true` de quan encara era
-- actiu — `fem_apply_calendar()` no toca els `inactive` (vist al bloc 3,
-- Tres coses que aquest bloc ha obligat a saber, docs/PROVES_Fase4.md).
-- Sense aquesta segona condició, aquest forat concret hauria quedat
-- parcialment obert.
--
-- Sense excepció d'admin: el client tampoc en té cap per a la votació (a
-- diferència de la pujada, 4.2) — `handleStar()`/`_applyPuntuacio()` bloquegen
-- qualsevol rol per igual quan `voting_enabled` és fals.
--
-- Company del canvi de client a `js/features/votacio.js` (`saveVoteOnClick()`
-- i `saveVoteOnClickPuntuacio()`), que afegeix la mateixa guarda que ja tenen
-- `handleStar()`/`_applyPuntuacio()` — purament defensiva, la protecció real
-- és aquesta política.
--
-- ⚠️ Mateix parany que a 5.4/5.5: `objectives` no repeteix cap nom de columna
-- amb `votes`, però tot i així es qualifica explícitament amb `votes.` i `o.`
-- per coherència i per no haver-ho de refiar de la sort. Verificat amb
-- pg_get_expr() abans de provar res.
--
-- Rollback: sql/2026-08-01_incidencia_5.6_rls_votacio_tancada_rollback.sql
-- (recrea les dues polítiques tal com havien quedat després de la 5.4).

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
    AND EXISTS (
      SELECT 1 FROM public.objectives o
      WHERE o.id = votes.objective_id
        AND o.status = 'active'
        AND o.voting_enabled = true
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
    AND EXISTS (
      SELECT 1 FROM public.objectives o
      WHERE o.id = votes.objective_id
        AND o.status = 'active'
        AND o.voting_enabled = true
    )
  );
