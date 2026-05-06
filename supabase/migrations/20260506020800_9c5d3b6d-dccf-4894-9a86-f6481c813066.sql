
-- 1) Restrict product-images bucket uploads to store owners
DROP POLICY IF EXISTS "Owners upload product images" ON storage.objects;
CREATE POLICY "Owners upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND public.has_role(auth.uid(), 'store_owner')
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid())
);

-- 2) Restrict rental-proofs bucket uploads to parties of the rental (or admin)
DROP POLICY IF EXISTS "Auth upload rental proofs" ON storage.objects;
CREATE POLICY "Parties upload rental proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rental-proofs'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.rentals r
      LEFT JOIN public.stores s ON s.id = r.store_id
      WHERE (
        r.id::text = (storage.foldername(name))[1]
        OR (
          (storage.foldername(name))[1] = 'disputes'
          AND r.id::text = (storage.foldername(name))[2]
        )
      )
      AND (r.customer_id = auth.uid() OR s.owner_id = auth.uid())
    )
  )
);

-- 3) Restrict store-logos bucket uploads to store owners (owner-prefixed path)
DROP POLICY IF EXISTS "Auth upload store logos" ON storage.objects;
CREATE POLICY "Owners upload store logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND public.has_role(auth.uid(), 'store_owner')
);

-- 4) Prevent self-assigning the store_owner role; only 'customer' may be self-assigned.
--    store_owner role is granted via the secure RPC below after submitting a store.
DROP POLICY IF EXISTS "Users self-assign customer or store_owner" ON public.user_roles;
CREATE POLICY "Users self-assign customer role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'customer'::public.app_role);

-- Secure RPC: caller can grant themselves store_owner only after submitting a store
CREATE OR REPLACE FUNCTION public.request_store_owner_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'store_owner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.request_store_owner_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_store_owner_role() TO authenticated;

-- 5) Lock down trigger SECURITY DEFINER functions from being callable directly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_refund_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_rental_proof_images() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_rental_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_dispute_status_change() FROM PUBLIC, anon, authenticated;

-- has_role and is_store_owner_of_rental are used inside RLS policies; they must remain
-- callable by authenticated. Revoke from anon to limit attack surface.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_store_owner_of_rental(uuid, uuid) FROM anon;
