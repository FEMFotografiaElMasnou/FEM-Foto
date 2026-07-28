-- ═══════════════════════════════════════════════════════════════════════════
-- Reset de contrasenya per l'admin — PART 1 (additiva)
-- 28/07/2026
--
-- Substitueix el mecanisme de "contrasenya buida" per una contrasenya
-- TEMPORAL, escrita a public.users I a auth.users alhora.
--
-- MOTIU (comprovat en viu a Test el 28/07/2026, amb files que existien de
-- debò — no amb ids inventats):
--
--   1) El Reset actual (`update users set password=''` des de socis.js) no
--      toca auth.users, i des del Pas 4b handleLogin() valida primer amb
--      signInWithPassword(). Resultat: la contrasenya VELLA seguia entrant
--      (HTTP 200) i el modal de "crea'n una de nova" no s'obria mai. El
--      reset no revocava res.
--
--   2) Pitjor: qualsevol amb la clau anon pública i l'email del soci podia
--      segrestar un compte reiniciat. fem_login(email, <qualsevol cosa>)
--      retorna 'reset_required' + l'id sense comprovar cap contrasenya (per
--      disseny: buida = n'ha de triar una), i fem_set_new_password(id, pw)
--      estava concedida a `anon` i només comprovava que la guardada fos
--      buida — cap prova d'identitat. Provat: anon va posar contrasenya nova
--      i va obtenir sessió real com aquell soci.
--
--   3) La finestra només era oberta per als comptes amb contrasenya buida,
--      és a dir entre el Reset i el moment que el soci en triava una de nova
--      (Normal 0 de 41 i Test 0 de 50 el dia de la comprovació).
--
-- CONSEQÜÈNCIA D'ORDRE, important: el Pas 4d NO pot buidar users.password
-- mentre fem_set_new_password sigui cridable per anon — posaria els 41
-- comptes reals en estat segrestable de cop. La PART 2 d'aquesta migració
-- (fitxer _part2_tancament.sql) tanca justament això, i s'aplica DESPRÉS de
-- desplegar el codi nou de les dues apps.
--
-- Aquesta part és purament additiva: crea una funció nova i no toca cap
-- dada, ni cap política, ni cap permís existent. Es pot aplicar amb el codi
-- actual desplegat sense que res canviï de comportament.
-- ═══════════════════════════════════════════════════════════════════════════

-- Reinicia la contrasenya d'un soci amb una TEMPORAL generada al servidor i
-- la retorna a l'admin, que és qui l'ha de fer arribar al soci.
--
-- Per què retornar-la enlloc de deixar-la buida: una contrasenya buida
-- obligava a tenir una via oberta a l'anònim per posar-ne una de nova (no hi
-- ha sessió amb què demostrar la identitat en aquell moment), i això no es
-- pot fer segur. Amb una temporal, el soci entra pel camí normal i ja té
-- sessió real; si la vol canviar, té "Has oblidat la contrasenya?" (Pas 4c).
CREATE OR REPLACE FUNCTION public.fem_admin_reset_password(p_user_id text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  -- Sense caràcters ambigus (O/0, I/l/1): la contrasenya es dicta per telèfon
  -- o s'escriu en un missatge, i el públic real són socis de ~65 anys.
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_len      constant int  := 8;
  v_n        constant int  := length(v_alphabet);
  v_max      constant int  := (256 / v_n) * v_n;   -- 248: evita el biaix del mòdul
  v_auth_id  uuid;
  v_temp     text := '';
  v_byte     int;
BEGIN
  IF NOT public.fem_is_admin() THEN RETURN NULL; END IF;

  SELECT auth_user_id INTO v_auth_id FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- gen_random_bytes (pgcrypto) i no random(): random() no és criptogràfica i
  -- aquí el valor ÉS una credencial, encara que sigui de vida curta.
  WHILE length(v_temp) < v_len LOOP
    v_byte := get_byte(extensions.gen_random_bytes(1), 0);
    CONTINUE WHEN v_byte >= v_max;
    v_temp := v_temp || substr(v_alphabet, 1 + (v_byte % v_n), 1);
  END LOOP;

  -- Les DUES taules a la mateixa transacció. És la regla que aquesta migració
  -- ve a fer complir: qualsevol camp d'identitat que viu a public.users i a
  -- auth.users s'escriu als dos llocs alhora, o el canvi no revoca res.
  UPDATE public.users SET password = v_temp WHERE id = p_user_id;

  IF v_auth_id IS NOT NULL THEN
    UPDATE auth.users
      SET encrypted_password = extensions.crypt(v_temp, extensions.gen_salt('bf')),
          updated_at = now()
      WHERE id = v_auth_id;

    -- Des del Pas 4b la sessió és PERSISTENT: canviar la contrasenya no tanca
    -- les sessions ja obertes, així que sense això un soci amb l'app oberta al
    -- mòbil seguiria dins després del "reset". Un reset ha de tallar l'accés.
    DELETE FROM auth.refresh_tokens WHERE user_id = v_auth_id::text;
    DELETE FROM auth.sessions       WHERE user_id = v_auth_id;
  END IF;

  RETURN v_temp;
END;
$$;

-- Doble barrera, com les funcions del Pas 4a/4b/4c: la comprovació interna
-- fem_is_admin() I el permís retirat a l'anònim.
--
-- ⚠️ `FROM PUBLIC, anon`, no només `FROM anon`. Tota funció nova neix amb
-- EXECUTE concedit a PUBLIC, i `anon` hi arriba per aquí: revocar-li el permís
-- a ell sol no fa RES (comprovat el 28/07/2026 a Test — has_function_privilege
-- seguia dient true, i a pg_proc.proacl hi havia `=X/postgres`, que és PUBLIC).
-- És el mateix parany que el REVOKE de columna del 26/07: si el permís ve d'una
-- concessió més ampla, revocar el cas particular no la sobreescriu.
REVOKE EXECUTE ON FUNCTION public.fem_admin_reset_password(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fem_admin_reset_password(text) TO authenticated;

-- ── Verificació ────────────────────────────────────────────────────────────
--   select has_function_privilege('anon', 'public.fem_admin_reset_password(text)', 'execute');
--     → false
--   select has_function_privilege('authenticated', 'public.fem_admin_reset_password(text)', 'execute');
--     → true
--
-- Prova negativa: fer-la SEMPRE amb un usuari que existeixi de debò. El
-- 27/07/2026 una prova amb un id inexistent va donar verd sense provar res
-- (la funció sortia pel camí "no trobat" abans d'arribar a l'autorització).
