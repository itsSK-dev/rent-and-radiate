
CREATE POLICY "dp docs read own or admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-partner-docs' AND (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR auth.uid()::text = (storage.foldername(name))[1]
  ));
CREATE POLICY "dp docs insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-partner-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "dp docs update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'delivery-partner-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "dp docs delete own or admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'delivery-partner-docs' AND (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR auth.uid()::text = (storage.foldername(name))[1]
  ));
