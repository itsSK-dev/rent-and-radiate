CREATE OR REPLACE FUNCTION public.is_delivery_partner_for_rental(_rental_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_assignments da
    JOIN public.delivery_partners dp ON dp.id = da.partner_id
    WHERE da.rental_id = _rental_id
      AND dp.user_id = auth.uid()
      AND dp.status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_delivery_partner_for_rental(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_delivery_partner_for_rental(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Delivery partners see assigned rentals" ON public.rentals;
CREATE POLICY "Delivery partners see assigned rentals"
ON public.rentals FOR SELECT
TO authenticated
USING (public.is_delivery_partner_for_rental(id));