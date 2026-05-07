CREATE OR REPLACE FUNCTION public.guard_store_admin_controls()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                      OR (current_setting('role', true) = 'service_role');
BEGIN
  IF is_service OR is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
     OR NEW.approved IS DISTINCT FROM OLD.approved THEN
    RAISE EXCEPTION 'Only admins can change shop moderation controls';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_store_admin_controls ON public.stores;
CREATE TRIGGER trg_guard_store_admin_controls
BEFORE UPDATE ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.guard_store_admin_controls();

DROP POLICY IF EXISTS "Owners update their store" ON public.stores;
CREATE POLICY "Owners update their store"
ON public.stores
FOR UPDATE
USING ((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK ((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));