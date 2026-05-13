
DROP POLICY IF EXISTS "Parties upload rental proofs" ON storage.objects;
DROP POLICY IF EXISTS "Parties list rental proofs" ON storage.objects;

CREATE POLICY "Parties upload rental proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rental-proofs'
  AND auth.uid() = owner
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.rentals r
      LEFT JOIN public.stores s ON s.id = r.store_id
      WHERE (r.customer_id = auth.uid() OR s.owner_id = auth.uid())
        AND (
          r.id::text = (storage.foldername(storage.objects.name))[1]
          OR (
            (storage.foldername(storage.objects.name))[1] = 'disputes'
            AND r.id::text = (storage.foldername(storage.objects.name))[2]
          )
        )
    )
  )
);

CREATE POLICY "Parties list rental proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rental-proofs'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR auth.uid() = owner
    OR EXISTS (
      SELECT 1
      FROM public.rentals r
      LEFT JOIN public.stores s ON s.id = r.store_id
      WHERE (r.customer_id = auth.uid() OR s.owner_id = auth.uid())
        AND (
          r.id::text = (storage.foldername(storage.objects.name))[1]
          OR (
            (storage.foldername(storage.objects.name))[1] = 'disputes'
            AND r.id::text = (storage.foldername(storage.objects.name))[2]
          )
        )
    )
  )
);
