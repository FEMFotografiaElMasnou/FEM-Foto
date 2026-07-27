-- ROLLBACK del Pas 4a (sql/2026-07-27_auth_migracio_pas4a_altes_baixes.sql).
--
-- El Pas 4a és purament additiu: només crea funcions, no toca cap política RLS,
-- cap taula ni cap dada. Desfer-lo és, per tant, esborrar les funcions.
--
-- IMPORTANT: abans (o alhora) cal tornar enrere el codi de client que les crida
-- (`git revert` del commit corresponent — login.js handleRegister/initializeDB/
-- handleUnsubscribe i socis.js saveMember/deleteMember). Si s'esborren les
-- funcions amb el client nou desplegat, les altes i baixes deixarien de
-- funcionar. Amb el client antic, l'app torna a inserir/esborrar directament a
-- public.users, cosa que les polítiques del Pas 3b segueixen permetent — és a
-- dir, es torna exactament a l'estat previ (amb el forat dels comptes sense
-- auth.users obert de nou, però l'app operativa).
--
-- Els comptes creats mentre el Pas 4a estava actiu NO s'han de tocar: són
-- comptes correctes i complets (public.users + auth.users), millors que els que
-- crearia el codi antic.

DROP FUNCTION IF EXISTS public.fem_bootstrap_admin(text, text, text);
DROP FUNCTION IF EXISTS public.fem_delete_account(text);
DROP FUNCTION IF EXISTS public.fem_admin_create_member(text, text, text, text);
DROP FUNCTION IF EXISTS public.fem_register_account(text, text, text);
DROP FUNCTION IF EXISTS public.fem_create_account_row(text, text, text, text, text);
