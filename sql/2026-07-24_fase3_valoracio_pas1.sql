-- ═══════════════════════════════════════════════════════════════════════
-- Fase 3 (nou sistema de puntuació) — Pas 1: camp `valoracio` a `votes`
-- Acció NO destructiva: no toca ni elimina creativity/theme/composition.
-- Objectiu d'aquest pas (Enric, 2026-07-24): preparar la BD sense canviar
-- encara cap comportament de l'app. `valoracio` (0-10) es manté sincronitzat
-- automàticament (trigger) a partir de la ponderació dels 3 criteris actuals
-- (creativity+theme+composition, cadascun 0-5, suma 0-15 → 0-10 arrodonit).
-- Mentre la captura de vots segueixi fent-se amb els 3 criteris (encara no
-- s'ha tocat cap codi de captura), aquest camp es manté sol, sense que calgui
-- cap canvi a votacio.js/data.js/ranking.js.
-- Aplicar a Supabase (Test primer, després Normal), a l'editor SQL — mai des
-- del frontend (ADR-015).
-- ═══════════════════════════════════════════════════════════════════════

begin;

alter table public.votes
  add column if not exists valoracio integer
    check (valoracio is null or valoracio between 0 and 10);

comment on column public.votes.valoracio is
  'Nova nota única 0-10 (Fase 3). Mentre convisqui amb creativity/theme/composition, es manté sincronitzada automàticament pel trigger fem_sync_valoracio() — no l''escriu l''app.';

-- Backfill: normalitza tots els vots ja existents (històrics i actuals).
update public.votes
set valoracio = round((coalesce(creativity, 0) + coalesce(theme, 0) + coalesce(composition, 0)) * 10.0 / 15)::int;

-- Procediment que sincronitza `valoracio` en cada insert/update dels 3
-- criteris antics — així l'app pot seguir escrivint exactament igual que
-- avui (upsert de creativity/theme/composition) sense cap canvi de codi, i
-- `valoracio` queda sempre a punt per a quan calculem sobre ell (Pas 2/3).
create or replace function public.fem_sync_valoracio()
returns trigger as $$
begin
  new.valoracio := round((coalesce(new.creativity, 0) + coalesce(new.theme, 0) + coalesce(new.composition, 0)) * 10.0 / 15)::int;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_valoracio on public.votes;
create trigger trg_sync_valoracio
  before insert or update of creativity, theme, composition on public.votes
  for each row
  execute function public.fem_sync_valoracio();

commit;

-- Verificació manual suggerida després d'aplicar-ho:
--   select creativity, theme, composition, valoracio from public.votes limit 20;
--   -- valoracio ha de ser sempre round((creativity+theme+composition)*10.0/15)
