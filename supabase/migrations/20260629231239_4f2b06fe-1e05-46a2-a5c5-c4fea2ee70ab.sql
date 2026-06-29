
-- 1. Category commission overrides
CREATE TABLE public.category_commissions (
  category public.product_category PRIMARY KEY,
  commission_percent numeric(5,2) NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.category_commissions TO authenticated;
GRANT ALL ON public.category_commissions TO service_role;
ALTER TABLE public.category_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view category commissions" ON public.category_commissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage category commissions" ON public.category_commissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_category_commissions_updated_at
  BEFORE UPDATE ON public.category_commissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Subscription plans
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_products integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO authenticated, anon;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins manage plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Shop subscriptions
CREATE TYPE public.shop_subscription_status AS ENUM ('active','expired','cancelled');
CREATE TABLE public.shop_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status public.shop_subscription_status NOT NULL DEFAULT 'active',
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL,
  price_paid numeric(10,2) NOT NULL DEFAULT 0,
  assigned_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shop_subscriptions_store ON public.shop_subscriptions(store_id, status);
CREATE INDEX idx_shop_subscriptions_end ON public.shop_subscriptions(end_at);
GRANT SELECT ON public.shop_subscriptions TO authenticated;
GRANT ALL ON public.shop_subscriptions TO service_role;
ALTER TABLE public.shop_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own subscriptions" ON public.shop_subscriptions
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'::public.app_role)
  );
CREATE POLICY "Admins manage subscriptions" ON public.shop_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_shop_subscriptions_updated_at
  BEFORE UPDATE ON public.shop_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Helper: get effective commission for a product
CREATE OR REPLACE FUNCTION public.get_effective_commission(_product_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT cc.commission_percent FROM public.products p
       JOIN public.category_commissions cc ON cc.category = p.category
      WHERE p.id = _product_id),
    (SELECT commission_percent FROM public.platform_settings WHERE id = true),
    10
  )
$$;
REVOKE EXECUTE ON FUNCTION public.get_effective_commission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_commission(uuid) TO authenticated, service_role;

-- 5. Update compute_rental_pricing to use category-aware commission
CREATE OR REPLACE FUNCTION public.compute_rental_pricing()
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
  v_protection numeric := 0;
  v_commission_pct numeric;
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

  SELECT price_per_day, actual_price, discount_percent, discount_flat, security_deposit, category
    INTO p FROM public.products WHERE id = NEW.product_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Unknown product'; END IF;

  SELECT gst_percent, delivery_fee, commission_percent,
         protection_plan_percent, protection_plan_min
    INTO s FROM public.platform_settings WHERE id = true;
  IF s IS NULL THEN
    s.gst_percent := 18; s.delivery_fee := 50; s.commission_percent := 10;
    s.protection_plan_percent := 5; s.protection_plan_min := 49;
  END IF;

  SELECT commission_percent INTO v_commission_pct
    FROM public.category_commissions WHERE category = p.category;
  v_commission_pct := COALESCE(v_commission_pct, s.commission_percent, 10);

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
    v_protection := 0;
  ELSE
    days := GREATEST(1, COALESCE(NEW.days, 1));
    base := COALESCE(p.price_per_day,0) * days * qty;
    per_unit_disc := (COALESCE(p.price_per_day,0) * days * pct / 100) + flat;
    total_disc := GREATEST(0, LEAST(base, per_unit_disc * qty));
    v_subtotal := GREATEST(0, base - total_disc);
    v_deposit := COALESCE(p.security_deposit,0) * qty;
    NEW.days := days;
    IF COALESCE(NEW.protection_plan, false) THEN
      v_protection := GREATEST(
        COALESCE(s.protection_plan_min, 0),
        ROUND(v_subtotal * COALESCE(s.protection_plan_percent, 0) / 100.0 * 100) / 100
      );
    END IF;
  END IF;

  v_gst := ROUND((v_subtotal * COALESCE(s.gst_percent,0) / 100) * 100) / 100;
  v_commission := ROUND((v_subtotal * v_commission_pct / 100) * 100) / 100;

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
  NEW.protection_plan_fee := ROUND(v_protection * 100) / 100;
  NEW.rental_total := NEW.subtotal;
  NEW.grand_total := ROUND((NEW.subtotal + NEW.gst_amount + NEW.delivery_fee + NEW.deposit + NEW.protection_plan_fee) * 100) / 100;

  RETURN NEW;
END;
$function$;

-- 6. Update tg_create_vendor_settlement to use category-aware commission
CREATE OR REPLACE FUNCTION public.tg_create_vendor_settlement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
  v_sale numeric;
  v_platform_fee numeric;
  v_gateway numeric;
  v_other numeric := 0;
  v_total_deduct numeric;
  v_net numeric;
  v_hold_days int;
  v_owner uuid;
  v_product_title text;
  v_product_category public.product_category;
  existing uuid;
  fee_pct numeric;
  gw_pct numeric;
BEGIN
  IF NEW.kind = 'buy' THEN
    IF NEW.status::text <> 'delivered' OR OLD.status::text = 'delivered' THEN RETURN NEW; END IF;
  ELSE
    IF NEW.status::text <> 'returned' OR OLD.status::text = 'returned' THEN RETURN NEW; END IF;
  END IF;

  IF NEW.payment_status::text NOT IN ('paid','partial_refund','refunded') THEN RETURN NEW; END IF;

  SELECT id INTO existing FROM public.vendor_settlements WHERE rental_id = NEW.id;
  IF existing IS NOT NULL THEN RETURN NEW; END IF;

  SELECT commission_percent, gateway_fee_percent, payout_hold_days
    INTO fee_pct, gw_pct, v_hold_days
    FROM public.platform_settings WHERE id = true;
  fee_pct := COALESCE(fee_pct, 10);
  gw_pct := COALESCE(gw_pct, 0);
  v_hold_days := COALESCE(v_hold_days, 7);

  SELECT title, category INTO v_product_title, v_product_category
    FROM public.products WHERE id = NEW.product_id;

  -- Category override
  SELECT commission_percent INTO fee_pct
    FROM public.category_commissions WHERE category = v_product_category
    UNION ALL SELECT fee_pct
    LIMIT 1;
  fee_pct := COALESCE(fee_pct, 10);

  v_sale := COALESCE(NEW.subtotal, 0);
  v_platform_fee := ROUND(v_sale * fee_pct / 100.0, 2);
  v_gateway := ROUND(COALESCE(NEW.grand_total,0) * gw_pct / 100.0, 2);

  IF NEW.kind <> 'buy' THEN
    SELECT COALESCE(SUM(total_deductions),0) INTO v_other
    FROM public.deposit_refunds WHERE rental_id = NEW.id;
  END IF;

  v_total_deduct := v_platform_fee + COALESCE(NEW.gst_amount,0) + v_gateway + COALESCE(NEW.delivery_fee,0);
  v_net := GREATEST(0, v_sale - v_platform_fee - v_gateway);

  INSERT INTO public.vendor_settlements(
    rental_id, store_id, customer_id, kind,
    sale_price, platform_fee_percent, platform_fee,
    gst_amount, gateway_fee, delivery_fee, other_deductions,
    total_deductions, net_payout, status, eligible_at
  ) VALUES (
    NEW.id, NEW.store_id, NEW.customer_id, NEW.kind,
    v_sale, fee_pct, v_platform_fee,
    COALESCE(NEW.gst_amount,0), v_gateway, COALESCE(NEW.delivery_fee,0), v_other,
    v_total_deduct, v_net,
    CASE WHEN v_hold_days <= 0 THEN 'eligible'::public.settlement_status
         ELSE 'pending'::public.settlement_status END,
    now() + (v_hold_days || ' days')::interval
  );

  SELECT owner_id INTO v_owner FROM public.stores WHERE id = NEW.store_id;

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, body, link_url, metadata)
    VALUES (
      v_owner,
      'order_update'::public.notification_type,
      '💸 Platform fee deducted · ₹' || v_platform_fee::text,
      'Sale of ' || COALESCE(v_product_title,'item')
        || E'\nSale price: ₹' || v_sale::text
        || ' · Platform fee (' || fee_pct::text || '%): ₹' || v_platform_fee::text
        || E'\nNet payout: ₹' || v_net::text
        || CASE WHEN v_hold_days > 0
                THEN ' · Eligible in ' || v_hold_days || ' days'
                ELSE '' END,
      '/vendor?tab=payouts',
      jsonb_build_object(
        'rental_id', NEW.id,
        'platform_fee', v_platform_fee,
        'net_payout', v_net,
        'sale_price', v_sale
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;
