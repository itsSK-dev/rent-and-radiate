-- Restrict direct read access to rentals.qr_token so store owners can no
-- longer harvest handoff tokens via the rentals SELECT policy. Customers
-- fetch their own token through a security-definer RPC; store-owner
-- verification continues to flow through the verify-rental-qr edge function
-- (which uses the service role and bypasses column grants).

REVOKE SELECT (qr_token) ON public.rentals FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_rental_qr_token(_rental_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT qr_token
  FROM public.rentals
  WHERE id = _rental_id
    AND customer_id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.get_rental_qr_token(uuid) TO authenticated;