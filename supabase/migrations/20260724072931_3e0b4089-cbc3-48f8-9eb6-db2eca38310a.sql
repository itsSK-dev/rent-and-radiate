-- 1) Enforce rental status transition order
CREATE OR REPLACE FUNCTION public.enforce_rental_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed text[];
  is_admin boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Service role (edge functions / admin scripts) bypasses the check
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins bypass the check
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD.status::text
    WHEN 'pending'            THEN ARRAY['confirmed','cancelled']
    WHEN 'confirmed'          THEN ARRAY['packing','ready_for_pickup','assigned','cancelled']
    WHEN 'packing'            THEN ARRAY['ready_for_pickup','cancelled']
    WHEN 'ready_for_pickup'   THEN ARRAY['assigned','shipped','cancelled']
    WHEN 'assigned'           THEN ARRAY['picked_up','cancelled']
    WHEN 'picked_up'          THEN ARRAY['out_for_delivery','shipped']
    WHEN 'shipped'            THEN ARRAY['out_for_delivery','delivered']
    WHEN 'out_for_delivery'   THEN ARRAY['delivered']
    WHEN 'delivered'          THEN ARRAY['return_scheduled','returned','completed']
    WHEN 'return_scheduled'   THEN ARRAY['return_picked_up']
    WHEN 'return_picked_up'   THEN ARRAY['returned']
    WHEN 'returned'           THEN ARRAY['completed']
    WHEN 'accepted'           THEN ARRAY['confirmed','packing','ready_for_pickup','cancelled']
    WHEN 'rejected'           THEN ARRAY['cancelled']
    WHEN 'completed'          THEN ARRAY[]::text[]
    WHEN 'cancelled'          THEN ARRAY[]::text[]
    ELSE ARRAY[NEW.status::text]  -- unknown legacy state: allow
  END;

  IF NOT (NEW.status::text = ANY(allowed)) THEN
    RAISE EXCEPTION 'Invalid rental status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_rental_status_transition ON public.rentals;
CREATE TRIGGER trg_enforce_rental_status_transition
BEFORE UPDATE OF status ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.enforce_rental_status_transition();

-- 2) Sync assigned_partner_id when a delivery assignment is accepted
CREATE OR REPLACE FUNCTION public.sync_rental_assigned_partner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE public.rentals
       SET assigned_partner_id = NEW.partner_id
     WHERE id = NEW.rental_id;

    -- Auto-reject other pending assignments for the same rental
    UPDATE public.delivery_assignments
       SET status = 'rejected'
     WHERE rental_id = NEW.rental_id
       AND id <> NEW.id
       AND status IN ('pending','broadcast','offered');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rental_assigned_partner ON public.delivery_assignments;
CREATE TRIGGER trg_sync_rental_assigned_partner
AFTER UPDATE OF status ON public.delivery_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_rental_assigned_partner();