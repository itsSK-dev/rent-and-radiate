
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS referrals_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code text;
  referrer uuid;
  signup_bonus int;
  refs_enabled boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, referral_code)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), public.generate_referral_code());
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer'::public.app_role);
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  SELECT COALESCE(referrals_enabled, true) INTO refs_enabled FROM public.platform_settings WHERE id = true;
  IF NOT COALESCE(refs_enabled, true) THEN
    RETURN NEW;
  END IF;

  ref_code := upper(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code','')));
  IF ref_code <> '' THEN
    SELECT id INTO referrer FROM public.profiles WHERE referral_code = ref_code AND id <> NEW.id;
    IF referrer IS NOT NULL THEN
      UPDATE public.profiles SET referred_by = referrer WHERE id = NEW.id;
      SELECT referral_signup_bonus INTO signup_bonus FROM public.platform_settings WHERE id = true;
      signup_bonus := COALESCE(signup_bonus, 100);

      INSERT INTO public.referrals(referrer_id, referred_user_id, referral_code, signup_bonus_points)
      VALUES (referrer, NEW.id, ref_code, signup_bonus);

      IF signup_bonus > 0 THEN
        UPDATE public.profiles
          SET reward_points = reward_points + signup_bonus,
              lifetime_reward_points = lifetime_reward_points + signup_bonus
          WHERE id = NEW.id;
        INSERT INTO public.reward_transactions(user_id, kind, points, balance_after, note)
        VALUES (NEW.id, 'signup_bonus', signup_bonus, signup_bonus,
                'Welcome bonus for using referral code ' || ref_code);
        INSERT INTO public.notifications(user_id, type, title, body, link_url)
        VALUES (NEW.id, 'order_update'::public.notification_type,
                '🎁 Welcome bonus credited',
                'You received ' || signup_bonus || ' reward points for signing up with a referral code.',
                '/rewards');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.tg_process_rental_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings RECORD;
  earn_points int := 0;
  referrer_id uuid;
  ref RECORD;
  new_balance int;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND COALESCE(OLD.reward_points_used,0) > 0 THEN
    UPDATE public.profiles
       SET reward_points = reward_points + OLD.reward_points_used
     WHERE id = NEW.customer_id
    RETURNING reward_points INTO new_balance;
    INSERT INTO public.reward_transactions(user_id, kind, points, balance_after, rental_id, note)
    VALUES (NEW.customer_id, 'refund_reversal', OLD.reward_points_used, new_balance, NEW.id,
            'Points returned on order cancellation');
  END IF;

  IF NEW.kind = 'buy' THEN
    IF NEW.status::text <> 'delivered' OR OLD.status::text = 'delivered' THEN RETURN NEW; END IF;
  ELSE
    IF NEW.status::text <> 'returned' OR OLD.status::text = 'returned' THEN RETURN NEW; END IF;
  END IF;

  IF NEW.payment_status::text NOT IN ('paid','partial_refund','refunded') THEN RETURN NEW; END IF;
  IF COALESCE(NEW.reward_points_earned,0) > 0 THEN RETURN NEW; END IF;

  SELECT rewards_enabled, reward_earn_rate_percent, referral_referrer_bonus, referral_min_order_amount, referrals_enabled
    INTO settings FROM public.platform_settings WHERE id = true;
  IF NOT COALESCE(settings.rewards_enabled, true) THEN RETURN NEW; END IF;

  earn_points := FLOOR(COALESCE(NEW.subtotal,0) * COALESCE(settings.reward_earn_rate_percent,0) / 100.0);
  IF earn_points > 0 THEN
    UPDATE public.profiles
       SET reward_points = reward_points + earn_points,
           lifetime_reward_points = lifetime_reward_points + earn_points
     WHERE id = NEW.customer_id
    RETURNING reward_points INTO new_balance;
    INSERT INTO public.reward_transactions(user_id, kind, points, balance_after, rental_id, note)
    VALUES (NEW.customer_id, 'earn_order', earn_points, new_balance, NEW.id,
            'Earned on order ₹' || NEW.subtotal::text);
    NEW.reward_points_earned := earn_points;

    INSERT INTO public.notifications(user_id, type, title, body, link_url)
    VALUES (NEW.customer_id, 'order_update'::public.notification_type,
            '⭐ You earned ' || earn_points || ' reward points',
            'Use them on your next order for a discount.', '/rewards');
  END IF;

  IF NOT COALESCE(settings.referrals_enabled, true) THEN RETURN NEW; END IF;

  SELECT referred_by INTO referrer_id FROM public.profiles WHERE id = NEW.customer_id;
  IF referrer_id IS NOT NULL AND COALESCE(NEW.subtotal,0) >= COALESCE(settings.referral_min_order_amount,0) THEN
    SELECT * INTO ref FROM public.referrals
      WHERE referred_user_id = NEW.customer_id AND status IN ('pending','qualified') LIMIT 1;
    IF ref.id IS NOT NULL AND ref.status <> 'rewarded' THEN
      UPDATE public.profiles
         SET reward_points = reward_points + COALESCE(settings.referral_referrer_bonus,0),
             lifetime_reward_points = lifetime_reward_points + COALESCE(settings.referral_referrer_bonus,0)
       WHERE id = referrer_id
      RETURNING reward_points INTO new_balance;
      INSERT INTO public.reward_transactions(user_id, kind, points, balance_after, rental_id, referred_user_id, note)
      VALUES (referrer_id, 'referral_bonus', COALESCE(settings.referral_referrer_bonus,0), new_balance, NEW.id, NEW.customer_id,
              'Referral completed a qualifying order');
      UPDATE public.referrals
         SET status='rewarded',
             qualifying_rental_id = NEW.id,
             referrer_bonus_points = COALESCE(settings.referral_referrer_bonus,0),
             qualified_at = COALESCE(qualified_at, now()),
             rewarded_at = now()
       WHERE id = ref.id;
      INSERT INTO public.notifications(user_id, type, title, body, link_url)
      VALUES (referrer_id, 'order_update'::public.notification_type,
              '🎉 Referral reward: ' || COALESCE(settings.referral_referrer_bonus,0) || ' points',
              'Your friend completed their first order. Points credited to your account.',
              '/rewards');
    END IF;
  END IF;
  RETURN NEW;
END
$$;
