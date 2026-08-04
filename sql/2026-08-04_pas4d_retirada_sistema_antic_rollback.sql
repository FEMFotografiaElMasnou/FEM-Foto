-- ROLLBACK de sql/2026-08-04_pas4d_retirada_sistema_antic.sql.
--
-- No recupera les contrasenyes en clar buidades (irrecuperable, i no calia
-- cap còpia — cap camí legítim les llegia ja abans d'aquesta migració).
-- Recupera l'accés (polítiques + EXECUTE) exactament com estava.

CREATE POLICY users_insert_self_register ON public.users
  FOR INSERT TO anon, authenticated
  WITH CHECK (role = 'participant');
CREATE POLICY users_insert_bootstrap ON public.users
  FOR INSERT TO anon, authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM public.users LIMIT 1));
CREATE POLICY users_insert_admin ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.fem_is_admin());
CREATE POLICY users_delete_admin_or_self ON public.users
  FOR DELETE TO authenticated
  USING (public.fem_is_admin() OR auth_user_id = auth.uid());

GRANT EXECUTE ON FUNCTION public.fem_login(text, text) TO anon, authenticated;
