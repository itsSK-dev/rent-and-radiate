
-- 1) Server-side pricing for rentals
CREATE OR REPLACE FUNCTION public.compute_rental_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  s RECORD;
  qty int;
  days int;
  final_unit numeric;
  base numeric;
  pct numeric;
  flat numeric;
  per_unit_disc numeric;
  total_disc numeric;
  v_subtotal numeric;
  v_deposit numeric;
  v_gst numeric;
  v_commission numeric;
  v_delivery numeric;
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
BEGIN
  -- Admins and service role may set any values (e.g. backfills, refunds).
  IF is_service OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  SELECT price_per_day, actual_price, discount_percent, discount_flat, security_deposit
    INTO p FROM public.products WHERE id = NEW.product_id;
  IF p IS NULL THEN
    RAISE EXCEPTION 'Unknown product';
  END IF;

  SELECT gst_percent, delivery_fee, commission_percent
    INTO s FROM public.platform_settings WHERE id = true;
  IF s IS NULL THEN
    s.gst_percent := 18; s.delivery_fee := 50; s.commission_percent := 10;
  END IF;

  qty := GREATEST(1, COALESCE(NEW.quantity, 1));
  pct := GREATEST(0, LEAST(100, COALESCE(p.discount_percent, 0)));
  flat := GREATEST(0, COALESCE(p.discount_flat, 0));

  IF NEW.kind = 'buy' THEN
    final_unit := GREATEST(0,
      ROUND(((COALESCE(p.actual_price,0) - (COALESCE(p.actual_price,0) * pct / 100)) - flat) * 100) / 100);
    base := COALESCE(p.actual_price,0) * qty;
    v_subtotal := final_unit * qty;
    total_disc := GREATEST(0, base - v_subtotal);
    v_deposit := 0;
    days := NULL;
  ELSE
    days := GREATEST(1, COALESCE(NEW.days, 1));
    base := COALESCE(p.price_per_day,0) * days * qty;
    per_unit_disc := (COALESCE(p.price_per_day,0) * days * pct / 100) + flat;
    total_disc := GREATEST(0, LEAST(base, per_unit_disc * qty));
    v_subtotal := GREATEST(0, base - total_disc);
    v_deposit := COALESCE(p.security_deposit,0) * qty;
    NEW.days := days;
  END IF;

  v_gst := ROUND((v_subtotal * COALESCE(s.gst_percent,0) / 100) * 100) / 100;
  v_commission := ROUND((v_subtotal * COALESCE(s.commission_percent,0) / 100) * 100) / 100;

  -- Delivery is optional and capped to platform setting.
  IF NEW.delivery_method = 'delivery' AND COALESCE(NEW.delivery_fee, 0) > 0 THEN
    v_delivery := LEAST(COALESCE(s.delivery_fee, 0), COALESCE(NEW.delivery_fee, 0));
  ELSE
    v_delivery := 0;
  END IF;

  NEW.subtotal := ROUND(v_subtotal * 100) / 100;
  NEW.discount_amount := ROUND(total_disc * 100) / 100;
  NEW.gst_amount := v_gst;
  NEW.commission_amount := v_commission;
  NEW.delivery_fee := v_delivery;
  NEW.deposit := ROUND(v_deposit * 100) / 100;
  NEW.rental_total := NEW.subtotal;
  NEW.grand_total := ROUND((NEW.subtotal + NEW.gst_amount + NEW.delivery_fee + NEW.deposit) * 100) / 100;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_rental_pricing ON public.rentals;
CREATE TRIGGER trg_compute_rental_pricing
  BEFORE INSERT ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.compute_rental_pricing();

-- 2) Guard manual_payments inserts so customers can't pre-mark records verified
CREATE OR REPLACE FUNCTION public.guard_manual_payment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rental_total numeric;
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
BEGIN
  IF is_service OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Force safe defaults
  NEW.status := 'pending_verification'::public.manual_payment_status;
  NEW.payout_status := 'unpaid'::public.payout_status;
  NEW.verified_by := NULL;
  NEW.verified_at := NULL;
  NEW.payout_amount := NULL;
  NEW.payout_paid_at := NULL;
  NEW.payout_notes := NULL;
  NEW.admin_notes := NULL;
  NEW.commission_amount := 0;

  -- Force amount to match rental.grand_total
  SELECT grand_total INTO rental_total FROM public.rentals WHERE id = NEW.rental_id;
  IF rental_total IS NULL THEN
    RAISE EXCEPTION 'Unknown rental';
  END IF;
  NEW.amount := rental_total;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_manual_payment_insert ON public.manual_payments;
CREATE TRIGGER trg_guard_manual_payment_insert
  BEFORE INSERT ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_manual_payment_insert();

-- 3) Enforce refund amounts against tier and rental deposit
CREATE OR REPLACE FUNCTION public.enforce_deposit_refund_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rental_deposit numeric;
  expected_pct int;
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
BEGIN
  IF is_service OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  expected_pct := CASE NEW.condition_tier::text
    WHEN 'perfect' THEN 100
    WHEN 'minor' THEN 75
    WHEN 'moderate' THEN 40
    WHEN 'severe' THEN 0
    ELSE -1 END;
  IF expected_pct < 0 THEN
    RAISE EXCEPTION 'Invalid condition tier';
  END IF;

  SELECT deposit INTO rental_deposit FROM public.rentals WHERE id = NEW.rental_id;
  IF rental_deposit IS NULL THEN
    RAISE EXCEPTION 'Unknown rental';
  END IF;

  NEW.deposit_amount := rental_deposit;
  NEW.refund_percent := expected_pct;
  NEW.refund_amount := ROUND(rental_deposit * expected_pct / 100.0);
  NEW.status := 'pending_admin'::public.refund_status;
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.admin_notes := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_deposit_refund_amounts ON public.deposit_refunds;
CREATE TRIGGER trg_enforce_deposit_refund_amounts
  BEFORE INSERT ON public.deposit_refunds
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deposit_refund_amounts();

-- 4) Profile update policy: add WITH CHECK so users can't rewrite their id
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
