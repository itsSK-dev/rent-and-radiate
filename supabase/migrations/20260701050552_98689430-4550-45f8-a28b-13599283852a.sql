
CREATE OR REPLACE FUNCTION public.get_public_platform_settings()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'gst_percent', gst_percent,
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
    'referral_min_order_amount', referral_min_order_amount
  )
  FROM public.platform_settings WHERE id = true;
$$;
REVOKE ALL ON FUNCTION public.get_public_platform_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_settings() TO anon, authenticated;
