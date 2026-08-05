# Autenticació i navegació

Com funciona avui l'accés dels socis i el routing de l'app, i les regles que no s'han de tornar
a discutir. El detall tècnic pas a pas de la migració (ja tancada) és a
`docs/arxiu/HISTORIC_Auth_Migracio.md`.

## Estat actual

**Migració a Supabase Auth: tancada als dos entorns (04/08/2026).** `handleLogin()`
(`js/screens/login.js`) valida amb `supabase.auth.signInWithPassword()`. El camp d'accés accepta
email o nom complet (el nom es resol contra `state.users` primer, perquè Auth només entén
emails). La sessió és persistent: dura fins que es prem "Sortir". `fem_login()` es manté al
catàleg com a xarxa de seguretat però ja no és cridable per ningú (`EXECUTE` revocat per a
`anon`/`authenticated` des del 04/08/2026).

**Filtre d'alta — cens de socis FEM.** Ningú pot crear-se un compte si el seu email no és a
`socis_fem_autoritzats` (taula pròpia, admin-only per RLS, independent de `users`). Gestió
d'altes/baixes/rol des d'Admin → Socis → *Socis FEM*. Pendent d'afegir-hi els socis de la FEM
encara no usuaris de l'app quan Enric passi la llista completa.

**Navegació.** Routing per `hash` (`js/core/navigation.js`): refrescar es queda al mateix
panell, el botó enrere navega per dins l'app en lloc de sortir-ne. Pestanyes internes de
l'admin (`switchTab`) fora d'abast a propòsit — es pot ampliar més endavant.

Inventari de taules, funcions RPC, RLS i cron: `docs/REFERENCIA_BD.md`.

## Decisions vives

**Tota dada d'identitat que visqui a `public.users` i a `auth.users` alhora s'ha d'escriure a
totes dues dins la mateixa transacció.** Nascuda de quatre incidents seguits (contrasenya
reiniciada per admin, canvi d'email, reset per correu, Reset de l'admin): escriure'n només una
deixava el soci fora o, pitjor, hi deixava la contrasenya antiga vàlida. Si mai s'afegeix un
tercer camp compartit, mateix patró.

**Les contrasenyes existents es preserven; mai un reset massiu forçat.** Pel perfil d'usuari del
club (~65 anys de mitjana), la fricció d'obligar tothom a canviar pesa més que el guany.

**L'auto-registre és obert i immediat** per a qui ja és al cens de socis FEM: sense confirmació
per correu ni aprovació d'admin. L'aprovació és prèvia i col·lectiva —mantenir el cens al
dia—, no una cua de sol·licituds per revisar una a una; qui no hi és, no progressa, sense
excepcions des de l'RPC.

**Els comptes es creen per RPC, no amb `supabase.auth.signUp()`**: `signUp()` substituiria la
sessió de l'admin per la del soci acabat de crear i forçaria confirmació per correu.

**Mètode d'accés: contrasenya i enllaç màgic**, a triar per l'usuari. L'enllaç màgic és un botó
secundari, no l'opció principal — qui ja té el seu costum no ha de notar cap canvi.

**Les funcions noves porten doble barrera**: comprovació interna *i* `REVOKE EXECUTE ... FROM
PUBLIC, anon` (`FROM anon` tot sol no fa res — el permís arriba pel `GRANT` a `PUBLIC` que rep
tota funció nova). La comprovació d'identitat s'escriu sempre com `IF auth.uid() IS NULL THEN
RETURN false`, mai com una comparació directa: amb `NULL`, una comparació dona `NULL`, que
plpgsql tracta com a fals dins un `IF` i es salta el `RETURN` de denegació.

**Cas parat de navegació**: `state.adminViewingAsParticipant` només viu en memòria, mai s'ha
persistit. Es reconstrueix a l'arrencada a partir de la pròpia ruta del fragment
(`restoreRouteOrDefault`, `navigation.js`) — si la ruta és de participant i qui hi entra és un
admin real, és que hi era per aquest camí.
