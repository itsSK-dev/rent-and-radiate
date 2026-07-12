
-- delivery-proofs bucket policies. Path format: {partner_user_id}/{assignment_id}/{filename}
CREATE POLICY "Partner uploads own proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'delivery-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Partner reads own proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'delivery-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admin reads all proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'delivery-proofs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customer reads rental proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND EXISTS (
    SELECT 1 FROM public.delivery_proofs dp
    JOIN public.rentals r ON r.id = dp.rental_id
    WHERE dp.file_path = storage.objects.name
      AND (r.customer_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = r.store_id AND s.owner_id = auth.uid()))
  )
);
