DROP POLICY IF EXISTS "Authenticated view category commissions" ON public.category_commissions;
CREATE POLICY "Admins and store owners view category commissions"
  ON public.category_commissions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'store_owner'::public.app_role)
  );