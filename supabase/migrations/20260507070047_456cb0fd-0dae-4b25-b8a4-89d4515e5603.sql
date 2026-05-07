ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

UPDATE public.stores
SET is_verified = COALESCE(is_verified, false) OR approved OR (status = 'approved'::public.store_status);

CREATE OR REPLACE FUNCTION public.sync_store_admin_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    NEW.approved := true;
    NEW.is_verified := true;
  ELSIF NEW.status IN ('pending', 'rejected', 'deleted') THEN
    NEW.approved := false;
    NEW.is_verified := false;
  END IF;

  IF NEW.is_verified = true AND NEW.status <> 'approved' THEN
    NEW.status := 'approved';
    NEW.approved := true;
  ELSIF NEW.is_verified = false AND NEW.status = 'approved' THEN
    NEW.status := 'pending';
    NEW.approved := false;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_store_approved ON public.stores;
DROP TRIGGER IF EXISTS trg_sync_store_admin_flags ON public.stores;
CREATE TRIGGER trg_sync_store_admin_flags
BEFORE INSERT OR UPDATE OF status, is_verified, is_active, is_blocked ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.sync_store_admin_flags();

DROP POLICY IF EXISTS "Anyone views approved stores" ON public.stores;
CREATE POLICY "Anyone views approved stores"
ON public.stores
FOR SELECT
USING (
  ((status = 'approved'::public.store_status) AND is_verified = true AND is_active = true AND is_blocked = false)
  OR owner_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Anyone views products of approved stores" ON public.products;
CREATE POLICY "Anyone views products of approved stores"
ON public.products
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = products.store_id
      AND (
        ((s.status = 'approved'::public.store_status) AND s.is_verified = true AND s.is_active = true AND s.is_blocked = false)
        OR s.owner_id = auth.uid()
      )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);