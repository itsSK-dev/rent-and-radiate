
DROP POLICY IF EXISTS "Anyone views payment settings" ON public.payment_settings;

CREATE POLICY "Authenticated users view payment settings"
ON public.payment_settings
FOR SELECT
TO authenticated
USING (true);
