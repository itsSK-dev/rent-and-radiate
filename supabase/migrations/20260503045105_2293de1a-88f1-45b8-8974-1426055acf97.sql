
CREATE TABLE public.dispute_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL,
  from_status public.dispute_status,
  to_status public.dispute_status NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispute_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties view dispute history"
ON public.dispute_status_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    JOIN public.rentals r ON r.id = d.rental_id
    WHERE d.id = dispute_status_history.dispute_id
      AND (
        d.opened_by = auth.uid()
        OR r.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = r.store_id AND s.owner_id = auth.uid())
      )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.log_dispute_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.dispute_status_history (dispute_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, NEW.opened_by, 'Dispute opened');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.dispute_status_history (dispute_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_dispute_status
AFTER INSERT OR UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.log_dispute_status_change();
