DROP POLICY IF EXISTS "Anyone can view active categories" ON public.product_categories;

CREATE POLICY "Anyone can view categories"
ON public.product_categories
FOR SELECT
USING (true);

GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT ALL ON public.product_categories TO service_role;