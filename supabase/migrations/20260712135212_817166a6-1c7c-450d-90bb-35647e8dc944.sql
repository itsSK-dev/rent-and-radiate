-- 1) Zero out product-level discounts: shop owner uploads the final price.
UPDATE public.products SET discount_percent = 0, discount_flat = 0
WHERE discount_percent <> 0 OR discount_flat <> 0;

-- 2) Update rental price-enforcement trigger:
--    * no additional discount on rentals
--    * rental protection plan disabled (always 0)
--    * include client-sent platform_fee in grand_total
CREATE OR REPLACE FUNCTION public.enforce_rental_prices()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_platform_fee numeric := 0;
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
BEGIN
  IF is_service OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.late_fee_applied := 0;
    NEW.late_fee_hours := 0;
    NEW.qr_token := COALESCE(NEW.qr_token, gen_random_uuid());
    NEW.rent_to_own_credit := 0;
  ELSE
    NEW.late_fee_applied := OLD.late_fee_applied;
    NEW.late_fee_hours := OLD.late_fee_hours;
    NEW.qr_token := OLD.qr_token;
    NEW.rent_to_own_credit := OLD.rent_to_own_credit;
    NEW.converted_to_purchase_rental_id := OLD.converted_to_purchase_rental_id;
  END IF;

  SELECT price_per_day, actual_price, discount_percent, discount_flat, security_deposit
    INTO p FROM public.products WHERE id = NEW.product_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Unknown product'; END IF;

  SELECT gst_percent, gst_enabled, delivery_fee, commission_percent
    INTO s FROM public.platform_settings WHERE id = true;
  IF s IS NULL THEN
    s.gst_percent := 0; s.gst_enabled := false; s.delivery_fee := 50; s.commission_percent := 10;
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
    NEW.protection_plan := false;
  ELSE
    -- Rental: no additional discount, protection plan disabled
    days := GREATEST(1, COALESCE(NEW.days, 1));
    base := COALESCE(p.price_per_day,0) * days * qty;
    total_disc := 0;
    v_subtotal := base;
    v_deposit := COALESCE(p.security_deposit,0) * qty;
    NEW.days := days;
    NEW.protection_plan := false;
  END IF;

  IF COALESCE(s.gst_enabled, true) THEN
    v_gst := ROUND((v_subtotal * COALESCE(s.gst_percent,0) / 100) * 100) / 100;
  ELSE
    v_gst := 0;
  END IF;
  v_commission := ROUND((v_subtotal * COALESCE(s.commission_percent,0) / 100) * 100) / 100;

  IF NEW.delivery_method = 'delivery' AND COALESCE(NEW.delivery_fee, 0) > 0 THEN
    v_delivery := COALESCE(NEW.delivery_fee, 0);
  ELSE
    v_delivery := 0;
  END IF;

  -- Trust the client-computed platform fee (slab-based); floor at 0
  v_platform_fee := GREATEST(0, COALESCE(NEW.platform_fee, 0));

  NEW.subtotal := ROUND(v_subtotal * 100) / 100;
  NEW.discount_amount := ROUND(total_disc * 100) / 100;
  NEW.gst_amount := v_gst;
  NEW.commission_amount := v_commission;
  NEW.delivery_fee := v_delivery;
  NEW.deposit := ROUND(v_deposit * 100) / 100;
  NEW.protection_plan_fee := 0;
  NEW.platform_fee := ROUND(v_platform_fee * 100) / 100;
  NEW.rental_total := NEW.subtotal;
  NEW.grand_total := ROUND(
    (NEW.subtotal + NEW.gst_amount + NEW.delivery_fee + NEW.deposit + NEW.platform_fee) * 100
  ) / 100;

  RETURN NEW;
END;
$function$;