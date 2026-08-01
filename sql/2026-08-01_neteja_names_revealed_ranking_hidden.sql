-- Elimina del tot names_revealed i ranking_hidden — cap dels dos protegia ni
-- mostrava res.
--
-- Origen: provant el punt 4.9 del guió de Fase 4 (docs/PROVES_Fase4.md) es va
-- trobar que `names_revealed` no controlava res que un soci o un admin
-- poguessin arribar a veure mai a FEM-Foto (l'única pantalla que el
-- consultava ja era codi mort). Investigant `rankingHidden` (punt 7.7) es va
-- trobar exactament el mateix. En comprovar-ho també a FEM-Reptes (l'app
-- antiga, que comparteix aquesta base), es va confirmar que allà tampoc hi
-- havia cap consumidor real: el codi que els llegia vivia dins
-- showParticipantClassificacio(), marcada al propi comentari de FEM-Reptes
-- com "vista interna antiga; ja no enllaçada". La Classificació General real
-- de FEM-Reptes es carrega per iframe des de fem-resultats.vercel.app, que
-- no els llegeix. Decisió d'Enric el 01/08/2026: fer-los desaparèixer de tot
-- arreu (codi de les dues apps, funcions de servidor, taules).
--
-- Ordre obligatori (com sempre amb columnes que un SELECT explícit demana):
--   1. Desplegar el codi net de FEM-Foto i FEM-Reptes (ja fet, 01/08/2026;
--      FEM-Reptes commit 88ca8de, verificat en viu a femfotografiaelmasnou.cat)
--   2. Aquesta migració — Test primer, Normal després
-- Fer-ho al revés (BD abans que codi) trenca loadAllData() de totes dues
-- apps amb "column does not exist", el mateix patró que l'incident del
-- 26/07/2026 amb `users.password`.
--
-- Dues funcions de servidor també les esmentaven (cercat amb
-- pg_proc.prosrc ILIKE '%revealed%'/'%ranking_hidden%' a les dues bases):
--   - fem_apply_calendar() — el cron nocturn (fem-calendar, 00:05 UTC)
--     escrivia `names_revealed` a cada repte actiu. Sense aquest pas, el
--     cron fallaria cada nit després del DROP COLUMN.
--   - fem_bootstrap_admin() — només s'executa amb la taula d'usuaris buida
--     (primera instal·lació); inserïa la fila 'cfg_revealed' a app_settings.
-- Cap altra funció ni política de RLS n'esmenta cap dels dos.
--
-- Rollback: sql/2026-08-01_neteja_names_revealed_ranking_hidden_rollback.sql

-- 1) fem_apply_calendar(): treu la clàusula de names_revealed de l'UPDATE i
--    la variable want_reveal, que ja no es fa servir enlloc.
CREATE OR REPLACE FUNCTION public.fem_apply_calendar()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cal record;
  today date := (now() at time zone 'Europe/Madrid')::date;
  want_upload boolean;
  want_voting boolean;
  final_upload boolean;
  final_voting boolean;
begin
  for cal in
    select id, cal_upload_start as upload_start, cal_upload_end as upload_end,
           cal_voting_start as voting_start, cal_voting_end as voting_end,
           upload_mode, voting_mode
      from public.objectives
     where status = 'active'
  loop
    want_upload := cal.upload_start is not null and cal.upload_end is not null
                   and today >= cal.upload_start and today <= cal.upload_end;
    want_voting := cal.voting_start is not null and cal.voting_end is not null
                   and today >= cal.voting_start and today <= cal.voting_end;

    final_upload := case cal.upload_mode when 'obert' then true when 'tancat' then false else want_upload end;
    final_voting := case cal.voting_mode when 'obert' then true when 'tancat' then false else want_voting end;

    update public.objectives
       set uploads_enabled = final_upload,
           voting_enabled  = final_voting
     where id = cal.id;
  end loop;
end;
$function$;

-- 2) fem_bootstrap_admin(): treu la fila 'cfg_revealed' de l'INSERT inicial.
CREATE OR REPLACE FUNCTION public.fem_bootstrap_admin(p_name text, p_email text, p_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name  text := trim(coalesce(p_name, ''));
BEGIN
  IF EXISTS (SELECT 1 FROM public.users LIMIT 1) THEN RETURN false; END IF;
  IF v_name = '' OR v_email = '' OR coalesce(p_password, '') = '' THEN RETURN false; END IF;

  PERFORM public.fem_create_account_row('u_admin_1', v_name, v_email, p_password, 'admin');

  INSERT INTO public.app_settings (id, key, value, updated_at, updated_by) VALUES
    ('cfg_uploads',  'uploads_enabled', 'true',  now(), 'system'),
    ('cfg_voting',   'voting_enabled',  'false', now(), 'system')
  ON CONFLICT (id) DO NOTHING;

  RETURN true;
END;
$function$;

-- 3) Files d'app_settings — ja no les escriu cap dels dos clients.
DELETE FROM public.app_settings WHERE key IN ('ranking_hidden', 'names_revealed');

-- 4) Columnes — ja no les demana cap SELECT ni les escriu cap upsert.
ALTER TABLE public.objectives DROP COLUMN names_revealed;
ALTER TABLE public.photo_submissions DROP COLUMN revealed;
