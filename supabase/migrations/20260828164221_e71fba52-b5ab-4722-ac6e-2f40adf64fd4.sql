CREATE OR REPLACE FUNCTION public.enforce_rental_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  allowed text[];
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD.status::text
    WHEN 'pending'            THEN ARRAY['confirmed','accepted','cancelled']
    WHEN 'confirmed'          THEN ARRAY['accepted','packing','ready_for_pickup','assigned','cancelled']
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
    ELSE ARRAY[NEW.status::text]
  END;

  IF NOT (NEW.status::text = ANY(allowed)) THEN
    RAISE EXCEPTION 'Invalid rental status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;