CREATE OR REPLACE FUNCTION public.store_visible_or_owned(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _store_id
      AND (
        (s.status = 'approved' AND s.is_verified = true AND s.is_active = true AND s.is_blocked = false)
        OR s.owner_id = auth.uid()
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_owner_of_store(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _store_id AND s.owner_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.store_visible_or_owned(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_owner_of_store(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_visible_or_owned(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_owner_of_store(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Anyone views products of approved stores" ON public.products;
CREATE POLICY "Anyone views products of approved stores"
ON public.products FOR SELECT
USING (public.store_visible_or_owned(store_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Store owners manage their products" ON public.products;
CREATE POLICY "Store owners manage their products"
ON public.products FOR ALL
USING (public.is_owner_of_store(store_id))
WITH CHECK (public.is_owner_of_store(store_id));