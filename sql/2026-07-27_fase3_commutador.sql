-- ═══════════════════════════════════════════════════════════════════════
-- Fase 3 — Commutador de sistema de puntuació (Pas A)
--
-- Crea UNA fila de configuració a `app_settings`. Res més: no toca `votes`,
-- ni `users`, ni cap esquema, ni cap funció, ni cap política.
--
-- Què és: l'interruptor global que decidirà quin sistema de puntuació veuen
-- els socis a la pantalla d'inici — l'antic (3 criteris 0-5) o el nou (1 sola
-- nota 0-10). Fins ara aquesta decisió estava escrita al codi
-- (js/screens/participant.js) i canviar-la exigia desplegar; a partir d'aquí
-- serà un clic al panell d'admin, amb marxa enrere immediata.
--
--   false → sistema ANTIC (el d'avui). És el valor amb què s'aplica.
--   true  → sistema NOU (0-10).
--
-- Per què booleana i no un text 'antic'/'nou': `parseSetting()` (js/core/
-- data.js) NOMÉS entén booleans — literalment `r.value === 'true'`. Qualsevol
-- altre text (inclòs 'nou') es llegiria com a `false`, és a dir sistema antic,
-- sense cap error ni avís enlloc. Amb "true"/"false" es comporta exactament
-- com les claus `force_hide_*`, que ja funcionen així.
--
-- Aquesta migració NO canvia res de cap manera visible: en aplicar-la, cap
-- part del client encara no llegeix la clau (això arriba al Pas B), i quan la
-- llegeixi, el valor `false` és el comportament actual.
--
-- Aplicar a Supabase (Test primer, verificar, després Normal).
-- Marxa enrere: `2026-07-27_fase3_commutador_rollback.sql`.
-- ═══════════════════════════════════════════════════════════════════════

begin;

insert into public.app_settings (id, key, value, updated_at, updated_by)
values ('cfg_sistema_puntuacio_nou', 'sistema_puntuacio_nou', 'false', now(), 'migracio')
on conflict (id) do nothing;

commit;

-- Verificació manual suggerida després d'aplicar-ho:
--   select id, key, value from public.app_settings where key = 'sistema_puntuacio_nou';
--   -- ha de tornar exactament 1 fila amb value = 'false'.
