-- Incidència 4.2 (docs/PROVES_Fase4.md) — la pujada "tancada" només es feia
-- complir a la interfície, no al servidor.
--
-- La política `photo_submissions_insert_own` (Pas 3b/3c, 27/07/2026) només
-- comprovava `user_id = fem_current_user_id()`. Ni `previewFile()`/`uploadPhoto()`
-- (fotos.js) ni cap política comprovaven `uploads_enabled` del repte. Provat el
-- 31/07/2026 a Test: amb «Contrallums» tancat, disparant l'event `change` de
-- l'input de fitxer per consola (sense passar per cap botó visible) es va
-- inserir una fila igualment.
--
-- Fix: el WITH CHECK exigeix, a més del user_id propi, que el repte de destí
-- tingui `uploads_enabled = true` — o que qui escriu sigui admin (bypass volgut,
-- ja utilitzat pel client des del Pas D del commutador, punt 2.4 del guió de
-- proves: l'admin pot pujar encara que la pujada estigui tancada).
--
-- Company del canvi de client a `js/features/fotos.js` (`uploadPhoto()`), que
-- afegeix la mateixa guarda que ja tenen `deleteMyPhoto()`/`saveCaption()` —
-- purament defensiva, la protecció real és aquesta política.
--
-- Rollback: sql/2026-07-31_incidencia_4.2_rls_pujada_tancada_rollback.sql
-- (recrea la política tal com estava, capturada de pg_policies abans de tocar-la).

DROP POLICY IF EXISTS photo_submissions_insert_own ON public.photo_submissions;

CREATE POLICY photo_submissions_insert_own ON public.photo_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.fem_current_user_id()
    AND (
      public.fem_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.objectives o
        WHERE o.id = objective_id AND o.uploads_enabled = true
      )
    )
  );
