-- Allow SECURITY DEFINER server-side functions (running as the postgres role)
-- to bypass the role guard, while still blocking client-side self-elevation.
CREATE OR REPLACE FUNCTION public.guard_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role')
                     OR current_user = 'postgres'
                     OR current_user = 'supabase_admin';
BEGIN
  IF is_service OR is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS DISTINCT FROM auth.uid() OR NEW.role <> 'customer'::public.app_role THEN
      RAISE EXCEPTION 'Only admins can assign elevated roles';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only admins can modify roles';
END $$;

-- Restore vendor self-onboarding (store still requires admin approval before going live).
CREATE OR REPLACE FUNCTION public.request_store_owner_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'store_owner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;