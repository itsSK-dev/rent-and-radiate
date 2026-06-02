
-- 1) Restrict payment_settings (bank details) to admins only.
DROP POLICY IF EXISTS "Authenticated users view payment settings" ON public.payment_settings;

CREATE POLICY "Admins view payment settings"
ON public.payment_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Expose only non-sensitive fields (UPI/QR/instructions) to authenticated users
-- via a SECURITY DEFINER function. Bank account number, IFSC and bank name are NOT returned.
CREATE OR REPLACE FUNCTION public.get_public_payment_settings()
RETURNS TABLE (
  upi_id text,
  payee_name text,
  qr_image_url text,
  instructions text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT upi_id, payee_name, qr_image_url, instructions
  FROM public.payment_settings
  WHERE id = true
$$;

REVOKE ALL ON FUNCTION public.get_public_payment_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_payment_settings() TO authenticated;

-- 2) Tighten rentals UPDATE policy with a WITH CHECK clause mirroring USING.
DROP POLICY IF EXISTS "Customer or store updates rental" ON public.rentals;

CREATE POLICY "Customer or store updates rental"
ON public.rentals
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = customer_id)
  OR (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = rentals.store_id AND s.owner_id = auth.uid()))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (auth.uid() = customer_id)
  OR (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = rentals.store_id AND s.owner_id = auth.uid()))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 3) Add DELETE policy for rental-proofs storage bucket (uploader or admin only).
CREATE POLICY "Uploader or admin can delete rental proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'rental-proofs'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

-- 4) Fix mutable search_path on pgmq wrapper functions.
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
