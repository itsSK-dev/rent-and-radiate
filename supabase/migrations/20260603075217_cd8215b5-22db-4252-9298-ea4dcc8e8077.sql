-- Prevent anonymous users from reading store owner_id (correlation risk).
-- Authenticated users (incl. owners/admins) keep full access via existing RLS.
REVOKE SELECT (owner_id) ON public.stores FROM anon;