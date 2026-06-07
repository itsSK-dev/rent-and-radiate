
CREATE POLICY "Advertiser uploads own asset" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'advertiser-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Advertiser reads own asset" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'advertiser-assets' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'::public.app_role)));
CREATE POLICY "Advertiser updates own asset" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'advertiser-assets' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'::public.app_role)));
CREATE POLICY "Advertiser deletes own asset" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'advertiser-assets' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'::public.app_role)));
