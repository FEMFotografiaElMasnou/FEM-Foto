-- Fusió del compte duplicat de José Antonio Sancho Pastor (Normal/producció).
--
-- Diagnosticat 2026-07-25: la taula users (compartida amb l'app "Zampa") té
-- dues files per a la mateixa persona real:
--   - u_1779390719550  sanchopastor@gmail.com          -> 1 foto (Dominant vermell), 0 vots, 0 Zampa
--   - u_1779644516606  contacto@joseantoniosancho.com  -> 1 foto (Escales), 22 vots, 1 seguiment_votacio, 10 Zampa
--
-- Decisió d'Enric: el compte canònic és contacto@joseantoniosancho.com
-- (u_1779644516606) — és on hi ha tota l'activitat real (vots, Zampa). Es
-- reassigna l'única foto de l'altre compte (Dominant vermell) cap aquí i
-- s'esborra la fila buida. Cap altra taula referencia u_1779390719550
-- (verificat: 0 votes, 0 seguiment_votacio, 0 zampa_user_ranks,
-- 0 objectives.created_by) — la foto és l'única cosa a moure.
--
-- NOMÉS APLICABLE A NORMAL: a Test aquest compte duplicat (u_1779644516606)
-- no existeix — Test és una còpia anterior a la submissió de la foto
-- "Escales" (16/07/2026) i no reprodueix el problema (només hi ha un
-- tercer id, usr_1780600419902, sense cap dada associada). No cal tocar Test.

BEGIN;

UPDATE public.photo_submissions
SET user_id = 'u_1779644516606'
WHERE id = 'photo_1768464000000' AND user_id = 'u_1779390719550';

-- Verificació de seguretat: la fila ha de quedar òrfena de tot abans d'esborrar-la.
DO $$
DECLARE
  refs int;
BEGIN
  SELECT
    (SELECT count(*) FROM public.photo_submissions WHERE user_id = 'u_1779390719550') +
    (SELECT count(*) FROM public.votes WHERE user_id = 'u_1779390719550') +
    (SELECT count(*) FROM public.seguiment_votacio WHERE user_id = 'u_1779390719550') +
    (SELECT count(*) FROM public.zampa_user_ranks WHERE user_id = 'u_1779390719550') +
    (SELECT count(*) FROM public.objectives WHERE created_by = 'u_1779390719550')
  INTO refs;
  IF refs <> 0 THEN
    RAISE EXCEPTION 'u_1779390719550 encara té % referències — no s''esborra', refs;
  END IF;
END $$;

DELETE FROM public.users WHERE id = 'u_1779390719550';

COMMIT;
