
DROP POLICY IF EXISTS "Anyone views support contact" ON public.support_contact;

CREATE POLICY "Authenticated users view support contact"
ON public.support_contact
FOR SELECT
TO authenticated
USING (true);
