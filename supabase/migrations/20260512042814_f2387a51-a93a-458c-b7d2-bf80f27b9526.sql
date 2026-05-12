-- Belt-and-suspenders trigger: prevent any non-admin from inserting/updating
-- a user_roles row to anything other than ('self', 'customer').
CREATE OR REPLACE FUNCTION public.guard_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
BEGIN
  IF is_service OR is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin path: only allow inserting own customer role
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS DISTINCT FROM auth.uid() OR NEW.role <> 'customer'::public.app_role THEN
      RAISE EXCEPTION 'Only admins can assign elevated roles';
    END IF;
    RETURN NEW;
  END IF;

  -- Block all UPDATE / DELETE from non-admins
  RAISE EXCEPTION 'Only admins can modify roles';
END $$;

DROP TRIGGER IF EXISTS guard_user_roles ON public.user_roles;
CREATE TRIGGER guard_user_roles
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles();

-- Tighten request_store_owner_role: must go through admin approval going forward.
-- Replace the auto-grant with an exception so client-side self-elevation cannot happen.
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
  -- Vendor applications must be approved by an admin (store approval flow).
  -- The store_owner role is now granted only via admin_set_user_role.
  RAISE EXCEPTION 'Store owner role can only be granted by an admin';
END $$;

-- Admin-only function to set/remove roles for any user.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _target_user uuid,
  _role public.app_role,
  _grant boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _target_user AND role = _role;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) TO authenticated;