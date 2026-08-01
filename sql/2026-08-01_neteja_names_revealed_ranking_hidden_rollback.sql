-- Marxa enrere de 2026-08-01_neteja_names_revealed_ranking_hidden.sql
--
-- ⚠️ Desfer això per si sol NO restaura la funcionalitat: el codi de client
-- de FEM-Foto i FEM-Reptes que llegia/escrivia aquestes columnes i files ja
-- ha estat eliminat (commit 88ca8de a FEM-Reptes, i els canvis corresponents
-- a FEM-Foto). Cal desfer també aquells commits si es vol tornar exactament
-- a l'estat d'abans. Aquest rollback només torna la BD a un estat compatible
-- amb el codi vell, per si calgués desplegar-lo de nou.
--
-- Valors capturats abans d'aplicar la migració (01/08/2026, mateixos a Test
-- i a Normal): app_settings.names_revealed = 'false', app_settings.ranking_hidden = 'true'.

-- 1) Columnes — es recreen amb el mateix tipus i default que tenien.
ALTER TABLE public.photo_submissions ADD COLUMN revealed boolean DEFAULT false;
ALTER TABLE public.objectives ADD COLUMN names_revealed boolean NOT NULL DEFAULT false;

-- 2) Files d'app_settings — recreades amb els valors que tenien just abans
--    d'aplicar la migració.
INSERT INTO public.app_settings (id, key, value, updated_at, updated_by) VALUES
  ('cfg_revealed',      'names_revealed',  'false', now(), 'system_rollback'),
  ('cfg_ranking_hidden','ranking_hidden',  'true',  now(), 'system_rollback')
ON CONFLICT (id) DO NOTHING;

-- 3) fem_bootstrap_admin(): torna a inserir 'cfg_revealed' a l'alta inicial.
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
    ('cfg_voting',   'voting_enabled',  'false', now(), 'system'),
    ('cfg_revealed', 'names_revealed',  'false', now(), 'system')
  ON CONFLICT (id) DO NOTHING;

  RETURN true;
END;
$function$;

-- 4) fem_apply_calendar(): torna a escriure names_revealed a cada repte actiu.
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
  want_reveal boolean;
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
    want_reveal := cal.voting_end is not null and today > cal.voting_end;

    final_upload := case cal.upload_mode when 'obert' then true when 'tancat' then false else want_upload end;
    final_voting := case cal.voting_mode when 'obert' then true when 'tancat' then false else want_voting end;

    update public.objectives
       set uploads_enabled = final_upload,
           voting_enabled  = final_voting,
           names_revealed  = names_revealed or (cal.voting_mode = 'calendari' and want_reveal)
     where id = cal.id;
  end loop;
end;
$function$;
