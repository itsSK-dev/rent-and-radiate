-- Create rental_status_history table
CREATE TABLE public.rental_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  from_status public.rental_status,
  to_status public.rental_status NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rental_status_history_rental ON public.rental_status_history(rental_id, created_at);

ALTER TABLE public.rental_status_history ENABLE ROW LEVEL SECURITY;

-- Parties (customer, store owner, admin) can view history
CREATE POLICY "Parties view rental history"
ON public.rental_status_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rentals r
    WHERE r.id = rental_status_history.rental_id
      AND (
        r.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = r.store_id AND s.owner_id = auth.uid())
      )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- No INSERT/UPDATE/DELETE policies: only the trigger (SECURITY DEFINER) writes rows.

-- Trigger function to log status changes
CREATE OR REPLACE FUNCTION public.log_rental_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rental_status_history (rental_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, NEW.customer_id, 'Rental created');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.rental_status_history (rental_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_rental_status_change
AFTER INSERT OR UPDATE OF status ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.log_rental_status_change();

-- Backfill: one pending entry per existing rental
INSERT INTO public.rental_status_history (rental_id, from_status, to_status, changed_by, note, created_at)
SELECT id, NULL, status, customer_id, 'Backfilled initial status', created_at
FROM public.rentals
WHERE NOT EXISTS (
  SELECT 1 FROM public.rental_status_history h WHERE h.rental_id = rentals.id
);