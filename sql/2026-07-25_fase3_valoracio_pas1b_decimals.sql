-- ═══════════════════════════════════════════════════════════════════════
-- Fase 3 — Pas 1b: corregeix la pèrdua de precisió del Pas 1 original
-- (2026-07-24_fase3_valoracio_pas1.sql).
--
-- Bug detectat (Enric, 2026-07-25): el Pas 1 guardava `valoracio` com a
-- `integer` i arrodonia amb round(...)::int tant al backfill com al trigger.
-- Això descartava exactament els decimals que la normalització 15→10 hauria
-- de conservar (exemple real: creativity 4,1 + theme 4 + composition 4,02 =
-- 12,12 → hauria de ser 8,08, però es guardava com a 8). Amb pocs votants
-- (o un de sol) l'error es notava molt, mostrant notes senceres on hi hauria
-- d'haver decimals.
--
-- Aquest pas NOMÉS canvia la precisió d'emmagatzematge (integer → numeric)
-- i torna a calcular el backfill i el trigger sense arrodonir a enter.
-- No toca creativity/theme/composition ni cap altra taula.
-- Aplicar a Supabase (Test primer, verificar, després Normal).
-- ═══════════════════════════════════════════════════════════════════════

begin;

alter table public.votes
  alter column valoracio type numeric(4,2) using valoracio::numeric(4,2);
-- El check existent (votes_valoracio_check: valoracio entre 0 i 10) es
-- revalida automàticament contra el nou tipus, no cal recrear-lo.

comment on column public.votes.valoracio is
  'Nova nota única 0-10 amb decimals (Fase 3). Mentre convisqui amb creativity/theme/composition, es manté sincronitzada automàticament pel trigger fem_sync_valoracio() — no l''escriu l''app.';

-- Backfill corregit: recalcula TOTS els vots ja existents SENSE arrodonir a
-- enter, només a 2 decimals.
update public.votes
set valoracio = round(((coalesce(creativity, 0) + coalesce(theme, 0) + coalesce(composition, 0)) * 10.0 / 15)::numeric, 2);

create or replace function public.fem_sync_valoracio()
returns trigger as $$
begin
  new.valoracio := round(((coalesce(new.creativity, 0) + coalesce(new.theme, 0) + coalesce(new.composition, 0)) * 10.0 / 15)::numeric, 2);
  return new;
end;
$$ language plpgsql;

commit;

-- Verificació manual suggerida després d'aplicar-ho:
--   select creativity, theme, composition, valoracio from public.votes limit 20;
--   -- valoracio ha de ser round((creativity+theme+composition)*10.0/15, 2), amb decimals.
