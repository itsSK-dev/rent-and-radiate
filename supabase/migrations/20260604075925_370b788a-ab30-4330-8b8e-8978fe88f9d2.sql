
-- 1) stores: revoke broad anon SELECT, regrant only non-sensitive columns (exclude owner_id)
REVOKE ALL ON public.stores FROM anon;
GRANT SELECT (id, name, status, address, logo_url, description, approved, rating_count, rating, lng, lat, is_active, is_blocked, is_verified, city, created_at, updated_at) ON public.stores TO anon;

-- 2) ratings: restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone views ratings" ON public.ratings;
CREATE POLICY "Authenticated users view ratings"
  ON public.ratings
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.ratings FROM anon;
GRANT SELECT ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
