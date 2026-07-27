-- ROLLBACK del Pas 4c (sql/2026-07-27_auth_migracio_pas4c_reset_contrasenya.sql)
--
-- La migració del Pas 4c és purament additiva: crea una funció nova i no toca
-- cap política RLS, cap taula ni cap dada. Desfer-la és, per tant, esborrar la
-- funció.
--
-- IMPORTANT: cal revertir TAMBÉ el codi de client que la crida
-- (js/screens/login.js, saveNewPassword() en mode recuperació). Si es deixa el
-- client nou amb la funció esborrada, el flux de "he oblidat la contrasenya"
-- fallaria en desar la contrasenya nova — l'usuari es quedaria amb la sessió de
-- recuperació oberta i la contrasenya sense canviar.

DROP FUNCTION IF EXISTS public.fem_set_own_password(text);
