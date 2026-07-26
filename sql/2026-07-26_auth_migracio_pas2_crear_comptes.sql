-- Migració a Supabase Auth (opció C, ANALISI_Login_Navegacio.md §1.4) — Pas 2
-- Crea un compte a auth.users (+ auth.identities) per a cada fila de
-- public.users que encara no en tingui (auth_user_id IS NULL) i que tingui
-- contrasenya, preservant la contrasenya ACTUAL (decisió d'Enric: no forçar
-- un reset general, pel perfil d'usuari mitjà de ~65 anys).
--
-- Nota respecte al pla original: es preveia un script extern amb l'Admin
-- API (calia la clau service_role). En la pràctica s'ha fet per SQL directe
-- (INSERT a auth.users/auth.identities amb la contrasenya hashejada amb
-- pgcrypto — extensió ja activada al projecte), verificat que produeix
-- comptes 100% funcionals (login real provat via
-- POST /auth/v1/token?grant_type=password, amb un compte de prova creat i
-- esborrat abans d'aplicar-ho a tothom). No calia cap script extern.
--
-- Idempotent: només afecta files amb auth_user_id IS NULL, es pot re-executar
-- sense duplicar res si mai queda a mitges.

DO $$
DECLARE
  r record;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT id, email, password
    FROM public.users
    WHERE auth_user_id IS NULL
      AND password IS NOT NULL AND trim(password) <> ''
  LOOP
    new_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      is_sso_user, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
      lower(r.email), extensions.crypt(r.password, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
      '', '', '', '',
      false, false
    );

    INSERT INTO auth.identities (
      user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      new_id, new_id::text,
      jsonb_build_object('sub', new_id::text, 'email', lower(r.email)),
      'email', now(), now(), now()
    );

    UPDATE public.users SET auth_user_id = new_id WHERE id = r.id;
  END LOOP;
END $$;
