
-- Status enum for stores
DO $$ BEGIN
  CREATE TYPE public.store_status AS ENUM ('pending','approved','rejected','deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS status public.store_status NOT NULL DEFAULT 'pending';

-- Backfill from legacy approved boolean
UPDATE public.stores SET status = 'approved' WHERE approved = true AND status = 'pending';

-- Keep approved boolean in sync with status for backwards compatibility
CREATE OR REPLACE FUNCTION public.sync_store_approved()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.approved := (NEW.status = 'approved');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_store_approved ON public.stores;
CREATE TRIGGER trg_sync_store_approved
BEFORE INSERT OR UPDATE OF status ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.sync_store_approved();

-- Update RLS: only show approved stores publicly; owners and admins see their own
DROP POLICY IF EXISTS "Anyone views approved stores" ON public.stores;
CREATE POLICY "Anyone views approved stores"
ON public.stores FOR SELECT
USING (status = 'approved' OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Update products visibility to require approved store
DROP POLICY IF EXISTS "Anyone views products of approved stores" ON public.products;
CREATE POLICY "Anyone views products of approved stores"
ON public.products FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id
      AND (s.status = 'approved' OR s.owner_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);
