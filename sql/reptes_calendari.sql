-- ═══════════════════════════════════════════════════════════════════
-- FEM VOTACIONS — Calendari automatitzat de reptes
-- Aplicar UNA vegada a l'editor SQL de Supabase (projecte Normal i, si vols, Test).
--
-- ⚠️ ABANS DE RES: comprova el TIPUS de objectives.id.
--    Aquí s'assumeix TEXT (ids com 'obj_...'). Si al teu projecte objectives.id
--    és UUID, canvia "objective_id text" per "objective_id uuid" a la taula.
--
-- Versió NETA (sense snapshot): la taula només guarda les 4 dates + el switch.
-- Els comptadors de participants/votants NO es congelen: es recalculen sempre
-- des de photo_submissions i seguiment_votacio, que no s'esborren mai (ADR-015).
-- ═══════════════════════════════════════════════════════════════════


-- 1) TAULA ─────────────────────────────────────────────────────────
-- Només programació: 4 dates + switch d'automatització per repte.
create table if not exists public.reptes_calendari (
  id                  text primary key default gen_random_uuid()::text,
  objective_id        text not null unique
                        references public.objectives(id) on delete cascade,
  upload_start        date,        -- ventana de SUBIDA de fotos (obre)
  upload_end          date,        -- ventana de SUBIDA de fotos (tanca)
  voting_start        date,        -- ventana de VOTACIÓ (obre)
  voting_end          date,        -- ventana de VOTACIÓ (tanca)
  automation_enabled  boolean not null default true,  -- switch per repte
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);


-- 2) RLS ───────────────────────────────────────────────────────────
-- L'app fa servir la clau anon. Aquestes polítiques permeten llegir/escriure
-- des del frontend, igual que fa amb votes/photos/app_settings.
-- Si les teves altres taules tenen RLS DESACTIVAT, pots saltar-te aquest bloc.
alter table public.reptes_calendari enable row level security;

create policy "reptes_calendari_select" on public.reptes_calendari
  for select using (true);
create policy "reptes_calendari_insert" on public.reptes_calendari
  for insert with check (true);
create policy "reptes_calendari_update" on public.reptes_calendari
  for update using (true) with check (true);


-- 3) pg_cron ───────────────────────────────────────────────────────
-- Si dóna error, activa'l abans a: Database → Extensions → "pg_cron" (Enable).
create extension if not exists pg_cron;


-- 4) FUNCIÓ ─────────────────────────────────────────────────────────
-- Mira la data d'avui i, pel repte ACTIU amb automatització ON:
--   · posa uploads_enabled / voting_enabled a app_settings segons les ventanes
--   · en passar voting_end: revela els noms (names_revealed = true)
-- Tot és idempotent: es pot executar cada dia sense efectes secundaris.
--
-- PLA MULTI-REPTE — FASE 2 FETA (vegeu FEM_reptes.md): aquesta funció d'aquí
-- baix és la versió ANTIGA (un sol repte, `limit 1`, escriu a app_settings).
-- Ha quedat SUBSTITUÏDA per la de sql/reptes_calendari_fase2.sql, que cal
-- aplicar A SOBRE d'aquest fitxer (Normal i Test): itera tots els reptes
-- actius amb automatització ON i escriu a `objectives.uploads_enabled/
-- voting_enabled/names_revealed` per objective_id, no a app_settings.
-- Aquest fitxer (reptes_calendari.sql) es deixa intacte com a referència
-- històrica de la taula/RLS/cron original; no cal tornar-lo a aplicar si ja
-- ho vas fer (v0.1.17) — només cal aplicar el fase2 per sobre.
create or replace function public.fem_apply_calendar()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cal         record;
  want_upload boolean;
  want_voting boolean;
begin
  -- Repte actiu amb calendari i automatització activada
  select c.*
    into cal
    from public.reptes_calendari c
    join public.objectives o on o.id = c.objective_id
   where o.status = 'active'
     and c.automation_enabled = true
   limit 1;

  if not found then
    return;   -- res a fer
  end if;

  want_upload := cal.upload_start is not null and cal.upload_end is not null
                 and current_date >= cal.upload_start and current_date <= cal.upload_end;
  want_voting := cal.voting_start is not null and cal.voting_end is not null
                 and current_date >= cal.voting_start and current_date <= cal.voting_end;

  -- Flags globals que llegeix el frontend (valors 'true'/'false' com a text)
  update public.app_settings
     set value = case when want_upload then 'true' else 'false' end,
         updated_at = now(), updated_by = 'system'
   where key = 'uploads_enabled';

  update public.app_settings
     set value = case when want_voting then 'true' else 'false' end,
         updated_at = now(), updated_by = 'system'
   where key = 'voting_enabled';

  -- Passada la data de tancament de votació → revelar noms (idempotent)
  if cal.voting_end is not null and current_date > cal.voting_end then
    update public.app_settings
       set value = 'true', updated_at = now(), updated_by = 'system'
     where key = 'names_revealed';
  end if;
end;
$$;


-- 5) PROGRAMACIÓ ───────────────────────────────────────────────────
-- Executa la funció cada dia a les 00:05 (UTC). Per dia/mes n'hi ha prou.
-- (Si ja existeix, primer: select cron.unschedule('fem-calendar');)
select cron.schedule('fem-calendar', '5 0 * * *', $$ select public.fem_apply_calendar(); $$);


-- ── ÚTILS ──────────────────────────────────────────────────────────
-- Provar-la manualment ara mateix:      select public.fem_apply_calendar();
-- Veure els jobs programats:            select * from cron.job;
-- Veure l'historial d'execucions:       select * from cron.job_run_details order by start_time desc limit 20;
-- Treure la programació:                select cron.unschedule('fem-calendar');
