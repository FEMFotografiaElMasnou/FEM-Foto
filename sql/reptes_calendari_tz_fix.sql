-- ═══════════════════════════════════════════════════════════════
-- FEM VOTACIONS — Fix de fus horari al cron (fem_apply_calendar)
-- Consolida la correcció de v0.1.38 (js/features/calendari.js: "avui" es
-- calcula en hora local del navegador, no en UTC) també al costat de
-- Supabase, perquè el "cron" (tasca automàtica diària que aplica el
-- calendari fins i tot si ningú obre l'app) faci servir el mateix "avui"
-- que veuen els socis (hora de Madrid), no la data en UTC de la base de
-- dades.
--
-- S'aplica DESPRÉS de sql/reptes_calendari_fase4.sql (ja aplicat). No cal
-- tornar a executar cap script anterior; aquest només reemplaça el cos de
-- la funció fem_apply_calendar() (substitueix `current_date` per la data
-- d'avui en hora de Madrid).
-- ═══════════════════════════════════════════════════════════════

create or replace function public.fem_apply_calendar()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cal record;
  -- "Avui" en hora de Madrid, NO current_date (que depèn del fus horari de
  -- la base de dades, normalment UTC — vegeu v0.1.38 del CHANGELOG per al
  -- mateix problema al costat del navegador).
  today date := (now() at time zone 'Europe/Madrid')::date;
  want_upload boolean;
  want_voting boolean;
  want_reveal boolean;
  final_upload boolean;
  final_voting boolean;
begin
  for cal in
    select c.*
      from public.reptes_calendari c
      join public.objectives o on o.id = c.objective_id
     where o.status = 'active'
  loop
    want_upload := cal.upload_start is not null and cal.upload_end is not null
                   and today >= cal.upload_start and today <= cal.upload_end;
    want_voting := cal.voting_start is not null and cal.voting_end is not null
                   and today >= cal.voting_start and today <= cal.voting_end;
    want_reveal := cal.voting_end is not null and today > cal.voting_end;

    final_upload := case cal.upload_mode
                      when 'obert'  then true
                      when 'tancat' then false
                      else want_upload   -- 'calendari'
                    end;
    final_voting := case cal.voting_mode
                      when 'obert'  then true
                      when 'tancat' then false
                      else want_voting   -- 'calendari'
                    end;

    update public.objectives
       set uploads_enabled = final_upload,
           voting_enabled  = final_voting,
           names_revealed  = names_revealed or (cal.voting_mode = 'calendari' and want_reveal)
     where id = cal.objective_id;
  end loop;
end;
$$;

-- No cal tocar la programació (cron.schedule('fem-calendar', '5 0 * * *', ...),
-- ja creada a reptes_calendari.sql): segueix disparant-se cada dia a les
-- 00:05 UTC (≈ 01:05-02:05 hora de Madrid segons horari d'estiu/hivern, un
-- moment de baixa activitat) — només canvia la data que la funció fa servir
-- internament per decidir si cada fase toca obrir-se o tancar-se.
