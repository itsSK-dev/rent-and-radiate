REVOKE ALL ON public.stores FROM anon;
GRANT SELECT (
  id, name, description, logo_url, address, city, lat, lng,
  rating, rating_count, approved, created_at, updated_at,
  status, is_active, is_blocked, is_verified
) ON public.stores TO anon;