REVOKE SELECT ON public.stores FROM anon;
REVOKE SELECT ON public.stores FROM PUBLIC;

GRANT SELECT (
  id, name, description, logo_url, address, city, lat, lng,
  rating, rating_count, approved, created_at, updated_at,
  status, is_active, is_blocked, is_verified
) ON public.stores TO anon;

GRANT SELECT ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;