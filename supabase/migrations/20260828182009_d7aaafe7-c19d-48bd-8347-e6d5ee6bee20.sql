CREATE OR REPLACE FUNCTION public.sync_rental_assigned_partner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE public.rentals
       SET assigned_partner_id = NEW.partner_id
     WHERE id = NEW.rental_id;

    UPDATE public.delivery_assignments
       SET status = 'rejected'::public.delivery_assignment_status
     WHERE rental_id = NEW.rental_id
       AND id <> NEW.id
       AND status = 'broadcast'::public.delivery_assignment_status;
  END IF;
  RETURN NEW;
END;
$fn$;