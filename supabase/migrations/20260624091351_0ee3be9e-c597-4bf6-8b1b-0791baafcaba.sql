
-- Platform settings additions
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS rewards_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reward_points_per_rupee numeric NOT NULL DEFAULT 1,    -- earn: ₹1 spend = 1 point (configurable)
  ADD COLUMN IF NOT EXISTS reward_earn_rate_percent numeric NOT NULL DEFAULT 2,   -- earn % of subtotal as points
  ADD COLUMN IF NOT EXISTS reward_redeem_value numeric NOT NULL DEFAULT 0.10,     -- ₹ per 1 point on redemption
  ADD COLUMN IF NOT EXISTS reward_max_redeem_percent numeric NOT NULL DEFAULT 20, -- max % of subtotal redeemable
  ADD COLUMN IF NOT EXISTS referral_signup_bonus int NOT NULL DEFAULT 100,        -- points to new user
  ADD COLUMN IF NOT EXISTS referral_referrer_bonus int NOT NULL DEFAULT 200,      -- points to referrer on first completed order
  ADD COLUMN IF NOT EXISTS referral_min_order_amount numeric NOT NULL DEFAULT 500;

-- Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reward_points int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_reward_points int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- Rental additions for redemption
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS reward_points_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_points_earned int NOT NULL DEFAULT 0;

-- Reward ledger
CREATE TABLE IF NOT EXISTS public.reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('earn_order','redeem_order','signup_bonus','referral_bonus','admin_adjust','refund_reversal')),
  points int NOT NULL,                  -- positive = credit, negative = debit
  balance_after int NOT NULL,
  rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reward_transactions TO authenticated;
GRANT ALL ON public.reward_transactions TO service_role;
ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reward transactions"
  ON public.reward_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins manage reward transactions"
  ON public.reward_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_reward_tx_user ON public.reward_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_tx_rental ON public.reward_transactions(rental_id);

-- Referrals tracking
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified','rewarded','cancelled')),
  qualifying_rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL,
  signup_bonus_points int NOT NULL DEFAULT 0,
  referrer_bonus_points int NOT NULL DEFAULT 0,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);
GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins manage referrals"
  ON public.referrals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);

-- Helper: generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  code text;
  exists_count int;
BEGIN
  LOOP
    code := upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
    SELECT count(*) INTO exists_count FROM public.profiles WHERE referral_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END $$;

-- Backfill existing profiles with referral codes
UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL;

-- Apply referral code at signup (called from edge function with referral metadata)
-- We extend handle_new_user trigger to generate code automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  ref_code text;
  referrer uuid;
  signup_bonus int;
BEGIN
  INSERT INTO public.profiles (id, full_name, referral_code)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), public.generate_referral_code());
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer'::public.app_role);
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  -- Process referral code from signup metadata
  ref_code := upper(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code','')));
  IF ref_code <> '' THEN
    SELECT id INTO referrer FROM public.profiles WHERE referral_code = ref_code AND id <> NEW.id;
    IF referrer IS NOT NULL THEN
      UPDATE public.profiles SET referred_by = referrer WHERE id = NEW.id;
      SELECT referral_signup_bonus INTO signup_bonus FROM public.platform_settings WHERE id = true;
      signup_bonus := COALESCE(signup_bonus, 100);

      INSERT INTO public.referrals(referrer_id, referred_user_id, referral_code, signup_bonus_points)
      VALUES (referrer, NEW.id, ref_code, signup_bonus);

      -- Credit signup bonus immediately
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
END $$;

-- Earn / redeem on completed orders + referrer bonus on first qualifying order
CREATE OR REPLACE FUNCTION public.tg_process_rental_rewards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  settings RECORD;
  earn_points int := 0;
  referrer_id uuid;
  ref RECORD;
  new_balance int;
BEGIN
  -- Reverse points used if cancelled
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND COALESCE(OLD.reward_points_used,0) > 0 THEN
    UPDATE public.profiles
       SET reward_points = reward_points + OLD.reward_points_used
     WHERE id = NEW.customer_id
    RETURNING reward_points INTO new_balance;
    INSERT INTO public.reward_transactions(user_id, kind, points, balance_after, rental_id, note)
    VALUES (NEW.customer_id, 'refund_reversal', OLD.reward_points_used, new_balance, NEW.id,
            'Points returned on order cancellation');
  END IF;

  -- Fire only on delivered (buy) or returned (rent) transition
  IF NEW.kind = 'buy' THEN
    IF NEW.status::text <> 'delivered' OR OLD.status::text = 'delivered' THEN RETURN NEW; END IF;
  ELSE
    IF NEW.status::text <> 'returned' OR OLD.status::text = 'returned' THEN RETURN NEW; END IF;
  END IF;

  IF NEW.payment_status::text NOT IN ('paid','partial_refund','refunded') THEN RETURN NEW; END IF;
  IF COALESCE(NEW.reward_points_earned,0) > 0 THEN RETURN NEW; END IF; -- already processed

  SELECT rewards_enabled, reward_earn_rate_percent, referral_referrer_bonus, referral_min_order_amount
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

  -- Referrer bonus on first qualifying order
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
END $$;

DROP TRIGGER IF EXISTS tg_process_rental_rewards ON public.rentals;
CREATE TRIGGER tg_process_rental_rewards
  BEFORE UPDATE ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.tg_process_rental_rewards();

-- Validate + apply redemption at insert/update of rentals
CREATE OR REPLACE FUNCTION public.tg_apply_reward_redemption()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  settings RECORD;
  user_balance int;
  max_redeem_value numeric;
  redeem_value numeric;
  capped_points int;
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
BEGIN
  IF is_service OR public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.reward_points_used IS NOT DISTINCT FROM OLD.reward_points_used THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.reward_points_used,0) <= 0 THEN
    NEW.reward_points_used := 0;
    NEW.reward_discount := 0;
    RETURN NEW;
  END IF;

  SELECT rewards_enabled, reward_redeem_value, reward_max_redeem_percent
    INTO settings FROM public.platform_settings WHERE id = true;
  IF NOT COALESCE(settings.rewards_enabled, true) THEN
    NEW.reward_points_used := 0;
    NEW.reward_discount := 0;
    RETURN NEW;
  END IF;

  SELECT reward_points INTO user_balance FROM public.profiles WHERE id = NEW.customer_id;
  capped_points := LEAST(NEW.reward_points_used, COALESCE(user_balance,0));

  max_redeem_value := COALESCE(NEW.subtotal,0) * COALESCE(settings.reward_max_redeem_percent,0) / 100.0;
  redeem_value := capped_points * COALESCE(settings.reward_redeem_value,0);
  IF redeem_value > max_redeem_value THEN
    redeem_value := max_redeem_value;
    capped_points := FLOOR(max_redeem_value / NULLIF(settings.reward_redeem_value,0));
  END IF;

  NEW.reward_points_used := GREATEST(0, capped_points);
  NEW.reward_discount := ROUND(GREATEST(0, redeem_value) * 100) / 100;
  NEW.grand_total := GREATEST(0, NEW.grand_total - NEW.reward_discount);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_apply_reward_redemption ON public.rentals;
CREATE TRIGGER tg_apply_reward_redemption
  BEFORE INSERT OR UPDATE OF reward_points_used ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_reward_redemption();

-- Deduct redeemed points when rental is paid
CREATE OR REPLACE FUNCTION public.tg_debit_redeemed_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  exists_tx int;
  new_balance int;
BEGIN
  IF COALESCE(NEW.reward_points_used,0) <= 0 THEN RETURN NEW; END IF;
  IF NEW.payment_status::text NOT IN ('paid','partial_refund','refunded') THEN RETURN NEW; END IF;
  IF OLD.payment_status::text IN ('paid','partial_refund','refunded') THEN RETURN NEW; END IF;

  SELECT count(*) INTO exists_tx FROM public.reward_transactions
    WHERE rental_id = NEW.id AND kind = 'redeem_order';
  IF exists_tx > 0 THEN RETURN NEW; END IF;

  UPDATE public.profiles
     SET reward_points = GREATEST(0, reward_points - NEW.reward_points_used)
   WHERE id = NEW.customer_id
  RETURNING reward_points INTO new_balance;

  INSERT INTO public.reward_transactions(user_id, kind, points, balance_after, rental_id, note)
  VALUES (NEW.customer_id, 'redeem_order', -NEW.reward_points_used, new_balance, NEW.id,
          'Redeemed at checkout (₹' || NEW.reward_discount::text || ' off)');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_debit_redeemed_points ON public.rentals;
CREATE TRIGGER tg_debit_redeemed_points
  AFTER UPDATE OF payment_status ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.tg_debit_redeemed_points();
