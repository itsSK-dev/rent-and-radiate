-- Restore EXECUTE on has_role for RLS policies.
-- has_role() is referenced inside SELECT RLS policies on many tables
-- (e.g., product_categories, platform_settings admin bypass). RLS predicates
-- run as the calling role, so anon/authenticated need EXECUTE, otherwise
-- every read falls through with "permission denied for function has_role".
-- The function is SECURITY DEFINER with a fixed search_path and only reads
-- public.user_roles, so it's safe to expose to authenticated + anon.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

-- Public metadata RPCs used by the customer app.
GRANT EXECUTE ON FUNCTION public.get_public_platform_settings() TO anon, authenticated;