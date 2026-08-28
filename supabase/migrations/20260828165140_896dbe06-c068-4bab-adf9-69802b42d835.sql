ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false;

GRANT SELECT (is_open) ON public.stores TO anon;
GRANT SELECT (is_open), UPDATE (is_open) ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

-- Only the owner (or admin/service) may flip availability; everyone else keeps the old value.
CREATE OR REPLACE FUNCTION public.guard_store_availability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role')
                     OR current_user IN ('postgres','supabase_admin');
BEGIN
  IF NEW.is_open IS DISTINCT FROM OLD.is_open THEN
    IF NOT (is_service OR is_admin OR auth.uid() = OLD.owner_id) THEN
      NEW.is_open := OLD.is_open;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_store_availability ON public.stores;
CREATE TRIGGER trg_guard_store_availability
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.guard_store_availability();

-- Backend enforcement: no NEW orders for a closed store.
CREATE OR REPLACE FUNCTION public.enforce_store_open_for_new_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s record;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT is_open, name, status, is_active, is_blocked INTO s
  FROM public.stores WHERE id = NEW.store_id;

  IF s IS NULL THEN
    RAISE EXCEPTION 'Store not found' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT s.is_open OR NOT s.is_active OR s.is_blocked OR s.status <> 'approved'::public.store_status THEN
    RAISE EXCEPTION '% is currently closed and is not accepting new orders.', s.name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_store_open_for_new_orders ON public.rentals;
CREATE TRIGGER trg_enforce_store_open_for_new_orders
BEFORE INSERT ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.enforce_store_open_for_new_orders();