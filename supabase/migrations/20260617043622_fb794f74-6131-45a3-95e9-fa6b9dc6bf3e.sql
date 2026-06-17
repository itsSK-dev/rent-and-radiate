
-- 1. Platform settings: add hold window + gateway fee
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS payout_hold_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS gateway_fee_percent numeric NOT NULL DEFAULT 0;

-- 2. Settlement status enum
DO $$ BEGIN
  CREATE TYPE public.settlement_status AS ENUM ('pending','eligible','paid','on_hold','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Vendor settlements ledger
CREATE TABLE IF NOT EXISTS public.vendor_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL UNIQUE REFERENCES public.rentals(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  kind public.order_kind NOT NULL,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  platform_fee_percent numeric(5,2) NOT NULL DEFAULT 10,
  platform_fee numeric(12,2) NOT NULL DEFAULT 0,
  gst_amount numeric(12,2) NOT NULL DEFAULT 0,
  gateway_fee numeric(12,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_payout numeric(12,2) NOT NULL DEFAULT 0,
  status public.settlement_status NOT NULL DEFAULT 'pending',
  eligible_at timestamptz,
  paid_at timestamptz,
  paid_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.vendor_settlements TO authenticated;
GRANT ALL ON public.vendor_settlements TO service_role;

ALTER TABLE public.vendor_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners view own settlements"
  ON public.vendor_settlements FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins manage settlements"
  ON public.vendor_settlements FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_vendor_settlements_store ON public.vendor_settlements(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_status ON public.vendor_settlements(status);

CREATE TRIGGER trg_vendor_settlements_updated_at
  BEFORE UPDATE ON public.vendor_settlements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Auto-create settlement when sale completes / rental returned
CREATE OR REPLACE FUNCTION public.tg_create_vendor_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  existing uuid;
  fee_pct numeric;
  gw_pct numeric;
BEGIN
  -- Only fire on completion transitions
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

  v_sale := COALESCE(NEW.subtotal, 0);
  v_platform_fee := ROUND(v_sale * fee_pct / 100.0, 2);
  v_gateway := ROUND(COALESCE(NEW.grand_total,0) * gw_pct / 100.0, 2);

  -- Rentals: subtract any refund deductions kept by platform/store as "other"
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
  SELECT title INTO v_product_title FROM public.products WHERE id = NEW.product_id;

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
$$;

DROP TRIGGER IF EXISTS trg_create_vendor_settlement ON public.rentals;
CREATE TRIGGER trg_create_vendor_settlement
  AFTER UPDATE ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.tg_create_vendor_settlement();

-- 5. Promote pending settlements to eligible once hold expires
CREATE OR REPLACE FUNCTION public.promote_eligible_settlements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n int;
BEGIN
  UPDATE public.vendor_settlements
     SET status = 'eligible'::public.settlement_status, updated_at = now()
   WHERE status = 'pending'::public.settlement_status
     AND eligible_at IS NOT NULL
     AND eligible_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
