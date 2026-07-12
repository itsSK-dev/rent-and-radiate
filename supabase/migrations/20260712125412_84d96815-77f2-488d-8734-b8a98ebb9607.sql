
-- 1. Rentals: store platform fee separately
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0;

-- 2. Platform settings: slabs + gst toggle
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS gst_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS platform_fee_slabs jsonb NOT NULL DEFAULT
    '{"tiers":[{"max":499,"fee":50},{"max":999,"fee":70},{"max":1999,"fee":120}],"above":{"base_fee":120,"threshold":1999,"step":1000,"step_fee":50}}'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_fee_slabs jsonb NOT NULL DEFAULT
    '{"tiers":[{"max_order":499,"fee":50},{"max_order":999,"fee":40},{"max_order":100000000,"fee":25}]}'::jsonb;

-- 3. Public settings helper: include new fields
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
    'delivery_fee_slabs', delivery_fee_slabs
  )
  FROM public.platform_settings WHERE id = true;
$function$;

-- 4. Extend guard trigger so customers can't alter platform_fee post-insert
CREATE OR REPLACE FUNCTION public.guard_rental_sensitive_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role')
                     OR current_user IN ('postgres','supabase_admin');
  is_store_owner boolean := EXISTS (SELECT 1 FROM public.stores s WHERE s.id = NEW.store_id AND s.owner_id = auth.uid());
  is_customer boolean := (auth.uid() = NEW.customer_id);
BEGIN
  IF is_service OR is_admin THEN RETURN NEW; END IF;
  NEW.payment_status   := OLD.payment_status;
  NEW.payment_method   := OLD.payment_method;
  NEW.razorpay_order_id   := OLD.razorpay_order_id;
  NEW.razorpay_payment_id := OLD.razorpay_payment_id;
  NEW.razorpay_signature  := OLD.razorpay_signature;
  NEW.refund_amount    := OLD.refund_amount;
  NEW.commission_amount := OLD.commission_amount;
  NEW.platform_fee     := OLD.platform_fee;
  NEW.late_fee_applied := OLD.late_fee_applied;
  NEW.late_fee_hours   := OLD.late_fee_hours;
  NEW.reward_points_earned := OLD.reward_points_earned;
  NEW.grand_total      := OLD.grand_total;
  NEW.subtotal         := OLD.subtotal;
  NEW.rental_total     := OLD.rental_total;
  NEW.gst_amount       := OLD.gst_amount;
  NEW.delivery_fee     := OLD.delivery_fee;
  NEW.deposit          := OLD.deposit;
  NEW.protection_fee   := COALESCE(OLD.protection_fee, NEW.protection_fee);
  NEW.qr_token         := OLD.qr_token;
  NEW.customer_id      := OLD.customer_id;
  NEW.store_id         := OLD.store_id;
  NEW.product_id       := OLD.product_id;
  NEW.kind             := OLD.kind;
  NEW.days             := OLD.days;

  IF is_customer AND NOT is_store_owner THEN
    NEW.status := OLD.status;
    NEW.returned_at := OLD.returned_at;
  END IF;

  RETURN NEW;
END $function$;
