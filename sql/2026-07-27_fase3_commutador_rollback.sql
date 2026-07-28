-- ═══════════════════════════════════════════════════════════════════════
-- Marxa enrere de `2026-07-27_fase3_commutador.sql`.
--
-- Esborra la fila de configuració del commutador de sistema de puntuació.
-- No toca cap altra fila d'app_settings ni cap altra taula.
--
-- Es pot executar amb tota tranquil·litat encara que el frontend ja llegeixi
-- la clau: `parseSetting('sistema_puntuacio_nou', false)` (js/core/data.js)
-- torna `false` quan la fila no hi és, o sigui SISTEMA ANTIC. Esborrar la
-- fila equival a deixar l'app com estava abans de la Fase 3.
-- ═══════════════════════════════════════════════════════════════════════

begin;

delete from public.app_settings
where id = 'cfg_sistema_puntuacio_nou';

commit;

-- Verificació després d'executar-ho:
--   select * from public.app_settings where key = 'sistema_puntuacio_nou';
--   -- ha de tornar 0 files.
