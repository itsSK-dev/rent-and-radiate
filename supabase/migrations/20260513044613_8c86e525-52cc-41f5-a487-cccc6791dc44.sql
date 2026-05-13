
-- Recreate with hardened auth + audit logging
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
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized: authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'unauthorized: admin role required'
      USING ERRCODE = '42501';
  END IF;

  IF _target_user IS NULL OR _role IS NULL THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user, _role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_moderation_log
      (target_user_id, actor_id, action, from_value, to_value, reason)
    VALUES
      (_target_user, caller, 'role_grant',
       NULL, to_jsonb(_role::text),
       'admin_set_user_role grant');
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _target_user AND role = _role;

    INSERT INTO public.user_moderation_log
      (target_user_id, actor_id, action, from_value, to_value, reason)
    VALUES
      (_target_user, caller, 'role_revoke',
       to_jsonb(_role::text), NULL,
       'admin_set_user_role revoke');
  END IF;
END $$;

-- Lock down execute privileges: revoke from public/anon, allow only authenticated.
-- The body still re-checks admin role, so non-admin authenticated users get 401.
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) TO authenticated;
