
-- Guard against advertisers escalating privileges by modifying admin-controlled fields
-- on advertisement_requests. Tighten the update policy and add a trigger enforcing
-- immutability of status/payment_status/set_price/admin_notes for non-admins.

DROP POLICY IF EXISTS "Advertiser updates own draft" ON public.advertisement_requests;

CREATE POLICY "Advertiser updates own draft"
ON public.advertisement_requests
FOR UPDATE
USING (
  ((advertiser_id = auth.uid())
    AND (status = ANY (ARRAY['draft'::ad_request_status, 'changes_requested'::ad_request_status])))
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  ((advertiser_id = auth.uid())
    AND (status = ANY (ARRAY['draft'::ad_request_status, 'changes_requested'::ad_request_status])))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE OR REPLACE FUNCTION public.prevent_advertiser_privileged_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can change anything.
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- For non-admins, block changes to admin-controlled fields.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only admins can change status';
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Only admins can change payment_status';
  END IF;
  IF NEW.set_price IS DISTINCT FROM OLD.set_price THEN
    RAISE EXCEPTION 'Only admins can change set_price';
  END IF;
  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    RAISE EXCEPTION 'Only admins can change admin_notes';
  END IF;
  IF NEW.advertiser_id IS DISTINCT FROM OLD.advertiser_id THEN
    RAISE EXCEPTION 'advertiser_id is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_advertiser_privileged_updates_trg ON public.advertisement_requests;
CREATE TRIGGER prevent_advertiser_privileged_updates_trg
BEFORE UPDATE ON public.advertisement_requests
FOR EACH ROW
EXECUTE FUNCTION public.prevent_advertiser_privileged_updates();
