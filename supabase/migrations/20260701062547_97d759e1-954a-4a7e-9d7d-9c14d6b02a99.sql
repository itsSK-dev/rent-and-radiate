
-- Revoke default execute privileges on every SECURITY DEFINER function in public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      r.proname, r.args
    );
  END LOOP;
END $$;

-- Re-grant EXECUTE only on the client-callable RPCs
GRANT EXECUTE ON FUNCTION public.get_public_platform_settings()        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_categories()               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rental_qr_token(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_commission(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_flag_subject(text, uuid, boolean, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_owner_of_rental(uuid, uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_eligible_settlements()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(
  uuid, public.notification_type, text, text, text, text, jsonb
) TO authenticated;
