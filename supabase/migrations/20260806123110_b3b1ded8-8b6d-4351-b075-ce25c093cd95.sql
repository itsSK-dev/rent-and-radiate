DROP POLICY IF EXISTS "Store owner updates pending refund" ON public.deposit_refunds;

CREATE POLICY "Store owner updates pending refund"
ON public.deposit_refunds
FOR UPDATE
TO authenticated
USING (
  status = 'pending_admin'::refund_status
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = deposit_refunds.store_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  status = 'pending_admin'::refund_status
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = deposit_refunds.store_id AND s.owner_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.guard_deposit_refund_store_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and server-side (service role) processes may change anything.
  IF public._is_service_role() OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount
     OR NEW.refund_amount IS DISTINCT FROM OLD.refund_amount
     OR NEW.refund_percent IS DISTINCT FROM OLD.refund_percent
     OR NEW.condition_tier IS DISTINCT FROM OLD.condition_tier
     OR NEW.late_fee IS DISTINCT FROM OLD.late_fee
     OR NEW.damage_charges IS DISTINCT FROM OLD.damage_charges
     OR NEW.total_deductions IS DISTINCT FROM OLD.total_deductions
     OR NEW.total_paid IS DISTINCT FROM OLD.total_paid
     OR NEW.rental_charges IS DISTINCT FROM OLD.rental_charges
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.razorpay_refund_id IS DISTINCT FROM OLD.razorpay_refund_id
     OR NEW.refunded_at IS DISTINCT FROM OLD.refunded_at
     OR NEW.refund_failure_reason IS DISTINCT FROM OLD.refund_failure_reason
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.rental_id IS DISTINCT FROM OLD.rental_id
  THEN
    RAISE EXCEPTION 'Only admins can change refund status, amounts or review fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_deposit_refund_store_updates ON public.deposit_refunds;
CREATE TRIGGER guard_deposit_refund_store_updates
BEFORE UPDATE ON public.deposit_refunds
FOR EACH ROW EXECUTE FUNCTION public.guard_deposit_refund_store_updates();