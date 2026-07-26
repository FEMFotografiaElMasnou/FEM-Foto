-- Migració a Supabase Auth (opció C, ANALISI_Login_Navegacio.md §1.4) — Pas 1
-- Columna pont entre la taula d'usuaris actual (public.users, id text tipus
-- "u_...") i els futurs comptes de Supabase Auth (auth.users, id uuid).
--
-- Zero canvi de comportament: columna nullable, cap ID ni clau forana
-- existent es toca (photo_submissions.user_id, votes.user_id,
-- objectives.created_by, zampa_user_ranks.user_id segueixen fent servir
-- l'id text actual, no aquesta columna).
--
-- ON DELETE SET NULL (no CASCADE): si mai s'esborrés un compte d'Auth, la
-- fila de public.users (i tot el seu historial de fotos/vots) es manté
-- intacta, només es desvincula.

ALTER TABLE public.users
  ADD COLUMN auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
