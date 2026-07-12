-- 1) New toggle: rental platform fee (off by default per current policy)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS rental_platform_fee_enabled boolean NOT NULL DEFAULT false;

-- 2) Expose it through the public settings helper
CREATE OR REPLACE FUNCTION public.get_public_platform_settings()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'gst_percent', gst_percent,
    'gst_enabled', gst_enabled,
    'delivery_fee', delivery_fee,
    'commission_percent', commission_percent,
    'rental_price_percent', rental_price_percent,
    'deposit_percent_of_price', deposit_percent_of_price,
    'protection_plan_percent', protection_plan_percent,
    'protection_plan_min', protection_plan_min,
    'late_fee_multiplier', late_fee_multiplier,
    'late_fee_grace_hours', late_fee_grace_hours,
    'rent_to_own_enabled', rent_to_own_enabled,
    'rent_to_own_credit_percent', rent_to_own_credit_percent,
    'rewards_enabled', rewards_enabled,
    'reward_earn_rate_percent', reward_earn_rate_percent,
    'reward_redeem_value', reward_redeem_value,
    'reward_max_redeem_percent', reward_max_redeem_percent,
    'referrals_enabled', referrals_enabled,
    'referral_signup_bonus', referral_signup_bonus,
    'referral_referrer_bonus', referral_referrer_bonus,
    'referral_min_order_amount', referral_min_order_amount,
    'platform_fee_slabs', platform_fee_slabs,
    'delivery_fee_slabs', delivery_fee_slabs,
    'rental_platform_fee_enabled', rental_platform_fee_enabled
  )
  FROM public.platform_settings WHERE id = true;
$function$;

-- 3) Enforce trigger: zero out rental platform fee when disabled; buy unchanged
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

  SELECT gst_percent, gst_enabled, delivery_fee, commission_percent, rental_platform_fee_enabled
    INTO s FROM public.platform_settings WHERE id = true;
  IF s IS NULL THEN
    s.gst_percent := 0; s.gst_enabled := false; s.delivery_fee := 50;
    s.commission_percent := 10; s.rental_platform_fee_enabled := false;
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
    -- Buy keeps existing platform fee behaviour (client-supplied slab fee)
    v_platform_fee := GREATEST(0, COALESCE(NEW.platform_fee, 0));
  ELSE
    -- Rental: no additional discount, protection plan disabled
    days := GREATEST(1, COALESCE(NEW.days, 1));
    base := COALESCE(p.price_per_day,0) * days * qty;
    total_disc := 0;
    v_subtotal := base;
    v_deposit := COALESCE(p.security_deposit,0) * qty;
    NEW.days := days;
    NEW.protection_plan := false;
    IF COALESCE(s.rental_platform_fee_enabled, false) THEN
      v_platform_fee := GREATEST(0, COALESCE(NEW.platform_fee, 0));
    ELSE
      v_platform_fee := 0;
    END IF;
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