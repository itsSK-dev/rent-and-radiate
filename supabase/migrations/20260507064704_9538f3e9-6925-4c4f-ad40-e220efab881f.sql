
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- Update public visibility policy on stores
DROP POLICY IF EXISTS "Anyone views approved stores" ON public.stores;
CREATE POLICY "Anyone views approved stores"
ON public.stores
FOR SELECT
USING (
  ((status = 'approved'::store_status) AND is_active = true AND is_blocked = false)
  OR (owner_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update products visibility policy to mirror store visibility
DROP POLICY IF EXISTS "Anyone views products of approved stores" ON public.products;
CREATE POLICY "Anyone views products of approved stores"
ON public.products
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id
      AND (
        ((s.status = 'approved'::store_status) AND s.is_active = true AND s.is_blocked = false)
        OR s.owner_id = auth.uid()
      )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);
