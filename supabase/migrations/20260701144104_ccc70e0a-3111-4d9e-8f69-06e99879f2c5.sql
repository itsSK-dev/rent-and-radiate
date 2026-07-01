DROP POLICY IF EXISTS "Owner updates own verification" ON public.store_verifications;
CREATE POLICY "Owner updates own verification"
ON public.store_verifications
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() AND status IN ('draft','rejected'))
WITH CHECK (owner_id = auth.uid() AND status IN ('draft','rejected'));