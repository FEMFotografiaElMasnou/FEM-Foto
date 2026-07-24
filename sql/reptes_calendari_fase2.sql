-- ═══════════════════════════════════════════════════════════════════
-- FEM VOTACIONS — Fase 2: reptes actius simultanis (BD)
-- Aplicar UNA vegada a l'editor SQL de Supabase (Normal i, si vols, Test),
-- DESPRÉS d'haver aplicat ja sql/reptes_calendari.sql en el seu moment
-- (v0.1.17, "Calendari EN PRODUCCIÓ"). Vegeu el pla complet a FEM_reptes.md,
-- secció "Pla — Revisió de l'admin i suport multi-repte".
--
-- QUÈ FA:
--  1) Afegeix objectives.names_revealed (uploads_enabled/voting_enabled ja
--     existien a la taula `objectives`, però eren lletra morta: es carregaven
--     i es desaven des del frontend, però cap part de l'app els llegia per
--     decidir res — tot es feia amb 2 flags GLOBALS a `app_settings`).
--  2) Backfill puntual: el repte que AVUI és 'active' hereta els valors
--     actuals d'app_settings (uploads_enabled/voting_enabled/names_revealed),
--     perquè no es perdi l'estat en curs en aplicar aquesta migració.
--  3) Reescriu fem_apply_calendar(): en lloc d'agafar NOMÉS un repte
--     (`limit 1`) i escriure a app_settings, ara itera TOTS els reptes amb
--     status='active' i automation_enabled=true, i cadascun escriu al SEU
--     propi objectives.uploads_enabled/voting_enabled/names_revealed.
--     La programació del cron (`fem-calendar`, 00:05 UTC) NO canvia — ja
--     existeix des de sql/reptes_calendari.sql; `create or replace function`
--     reaprofita el mateix job, no cal tornar a fer `cron.schedule(...)`.
--
-- NOTA: les claus 'uploads_enabled'/'voting_enabled'/'names_revealed' a
-- `app_settings` queden com a residu de l'etapa pre-Fase-2 (el frontend ja
-- no en depèn per a res). No s'esborren (ADR-015: no eliminar dades de
-- Supabase des del frontend); si mai vols netejar-les manualment tu mateix
-- des de l'editor SQL, no hi ha cap problema en fer-ho.
-- ═══════════════════════════════════════════════════════════════════


-- 1) COLUMNA NOVA ──────────────────────────────────────────────────
alter table public.objectives
  add column if not exists names_revealed boolean not null default false;


-- 2) BACKFILL del repte actiu (si n'hi ha un) ──────────────────────
update public.objectives o
   set uploads_enabled = coalesce((select value = 'true' from public.app_settings where key = 'uploads_enabled'), false),
       voting_enabled  = coalesce((select value = 'true' from public.app_settings where key = 'voting_enabled'), false),
       names_revealed  = coalesce((select value = 'true' from public.app_settings where key = 'names_revealed'), false)
 where o.status = 'active';


-- 3) CRON REESCRIT (multi-repte) ───────────────────────────────────
create or replace function public.fem_apply_calendar()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cal          record;
  want_upload  boolean;
  want_voting  boolean;
  want_reveal  boolean;
begin
  -- TOTS els reptes actius amb automatització ON (abans: `limit 1`, un de sol)
  for cal in
    select c.*
      from public.reptes_calendari c
      join public.objectives o on o.id = c.objective_id
     where o.status = 'active'
       and c.automation_enabled = true
  loop
    want_upload := cal.upload_start is not null and cal.upload_end is not null
                   and current_date >= cal.upload_start and current_date <= cal.upload_end;
    want_voting := cal.voting_start is not null and cal.voting_end is not null
                   and current_date >= cal.voting_start and current_date <= cal.voting_end;
    want_reveal := cal.voting_end is not null and current_date > cal.voting_end;

    -- Cadascun escriu al SEU propi repte a `objectives` (no a app_settings).
    -- names_revealed mai torna a false sola (OR): un cop revelat, es queda
    -- revelat fins que algú finalitzi el repte (mateixa lògica que abans).
    update public.objectives
       set uploads_enabled = want_upload,
           voting_enabled  = want_voting,
           names_revealed  = names_revealed or want_reveal
     where id = cal.objective_id;
  end loop;
end;
$$;


-- ── ÚTILS ──────────────────────────────────────────────────────────
-- Provar-la manualment ara mateix:   select public.fem_apply_calendar();
-- Comprovar l'estat per repte:
--   select id, name, status, uploads_enabled, voting_enabled, names_revealed
--     from public.objectives order by created_at desc;
-- Veure els jobs programats (ja existent, sense canvis):  select * from cron.job;
