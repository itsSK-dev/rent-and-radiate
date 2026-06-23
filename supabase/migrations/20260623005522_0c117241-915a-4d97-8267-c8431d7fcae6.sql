
-- 1. Platform settings additions
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS protection_plan_percent numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS protection_plan_min numeric NOT NULL DEFAULT 49,
  ADD COLUMN IF NOT EXISTS late_fee_multiplier numeric NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS late_fee_grace_hours int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS reminder_intervals_hours int[] NOT NULL DEFAULT ARRAY[24,6,1]::int[],
  ADD COLUMN IF NOT EXISTS rent_to_own_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rent_to_own_credit_percent numeric NOT NULL DEFAULT 50;

-- 2. Product-level rent-to-own opt-in
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rent_to_own_enabled boolean NOT NULL DEFAULT false;

-- 3. Rentals additions
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS protection_plan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS protection_plan_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_applied numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_hours int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qr_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS rent_to_own_credit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted_to_purchase_rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rentals_qr_token_unique ON public.rentals(qr_token);

-- Backfill: ensure every existing row has a qr_token (default handles new rows; existing rows already covered by NOT NULL DEFAULT)

-- 4. Update compute_rental_pricing to include protection plan
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
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
BEGIN
  IF is_service OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Lock down customer-controlled admin fields
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

  SELECT gst_percent, delivery_fee, commission_percent,
         protection_plan_percent, protection_plan_min
    INTO s FROM public.platform_settings WHERE id = true;
  IF s IS NULL THEN
    s.gst_percent := 18; s.delivery_fee := 50; s.commission_percent := 10;
    s.protection_plan_percent := 5; s.protection_plan_min := 49;
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
  v_commission := ROUND((v_subtotal * COALESCE(s.commission_percent,0) / 100) * 100) / 100;

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

-- 5. Update auto-create refund to use hourly late fee with multiplier
CREATE OR REPLACE FUNCTION public.tg_auto_create_refund_on_return()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_id uuid;
  per_day numeric;
  hours_late int := 0;
  computed_late numeric := 0;
  grace int;
  mult numeric;
  new_refund_id uuid;
  product_title text;
  store_name text;
  customer_name text;
BEGIN
  IF NEW.kind = 'buy' THEN RETURN NEW; END IF;
  IF NEW.status::text <> 'returned' THEN RETURN NEW; END IF;
  IF OLD.status::text = 'returned' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.deposit, 0) = 0 THEN RETURN NEW; END IF;

  SELECT id INTO existing_id FROM public.deposit_refunds WHERE rental_id = NEW.id LIMIT 1;
  IF existing_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT late_fee_grace_hours, late_fee_multiplier
    INTO grace, mult FROM public.platform_settings WHERE id = true;
  grace := COALESCE(grace, 2);
  mult := COALESCE(mult, 1.5);

  IF NEW.end_date IS NOT NULL AND NEW.returned_at IS NOT NULL THEN
    hours_late := GREATEST(0,
      CEIL(EXTRACT(EPOCH FROM (NEW.returned_at - (NEW.end_date::timestamp + interval '23 hours 59 minutes'))) / 3600.0)::int - grace
    );
    IF NEW.days IS NOT NULL AND NEW.days > 0 AND hours_late > 0 THEN
      per_day := COALESCE(NEW.rental_total, 0) / NEW.days;
      computed_late := ROUND(per_day * CEIL(hours_late / 24.0) * mult);
    END IF;
  END IF;

  NEW.late_fee_applied := computed_late;
  NEW.late_fee_hours := hours_late;

  INSERT INTO public.deposit_refunds(
    rental_id, store_id, customer_id,
    deposit_amount, condition_tier, refund_percent, refund_amount,
    late_fee, damage_charges, inspection_notes,
    initiated_by, status, auto_created
  ) VALUES (
    NEW.id, NEW.store_id, NEW.customer_id,
    NEW.deposit, 'perfect', 100, NEW.deposit,
    computed_late, 0, NULL,
    NEW.store_id, 'pending_admin', true
  ) RETURNING id INTO new_refund_id;

  SELECT title INTO product_title FROM public.products WHERE id = NEW.product_id;
  SELECT name INTO store_name FROM public.stores WHERE id = NEW.store_id;
  SELECT full_name INTO customer_name FROM public.profiles WHERE id = NEW.customer_id;

  INSERT INTO public.notifications(user_id, type, title, body, link_url, metadata)
  SELECT ur.user_id,
         'order_update'::public.notification_type,
         '💰 Refund pending approval · ' || COALESCE(product_title, 'rental'),
         'Customer: ' || COALESCE(customer_name, '—')
           || E'\nShop: ' || COALESCE(store_name, '—')
           || E'\nDeposit: ₹' || NEW.deposit::text
           || ' · Late fee: ₹' || computed_late::text
           || ' (' || hours_late || ' hrs late)'
           || E'\nReview and process refund via Admin → Refunds.',
         '/admin?tab=refunds',
         jsonb_build_object(
           'refund_id', new_refund_id, 'rental_id', NEW.id,
           'deposit', NEW.deposit, 'late_fee', computed_late, 'hours_late', hours_late
         )
  FROM public.user_roles ur WHERE ur.role = 'admin'::public.app_role;

  INSERT INTO public.notifications(user_id, type, title, body, link_url, metadata)
  VALUES (
    NEW.customer_id,
    'rental_update'::public.notification_type,
    '✅ Return verified — refund pending review',
    'Your return of ' || COALESCE(product_title, 'the item')
      || ' has been verified. Refund of up to ₹' || NEW.deposit::text || ' is being reviewed.',
    '/my-rentals',
    jsonb_build_object('rental_id', NEW.id, 'refund_id', new_refund_id)
  );

  RETURN NEW;
END;
$function$;

-- 6. Rental reminders
CREATE TABLE IF NOT EXISTS public.rental_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  hours_before int NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rental_reminders_due_idx
  ON public.rental_reminders(due_at) WHERE sent_at IS NULL;

GRANT SELECT ON public.rental_reminders TO authenticated;
GRANT ALL ON public.rental_reminders TO service_role;
ALTER TABLE public.rental_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own reminders" ON public.rental_reminders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND r.customer_id = auth.uid()));

CREATE POLICY "Admins read all reminders" ON public.rental_reminders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger to schedule reminders when end_date set/changed
CREATE OR REPLACE FUNCTION public.tg_schedule_rental_reminders()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  intervals int[];
  h int;
  due timestamptz;
BEGIN
  IF NEW.kind = 'buy' THEN RETURN NEW; END IF;
  IF NEW.end_date IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date THEN RETURN NEW; END IF;

  DELETE FROM public.rental_reminders WHERE rental_id = NEW.id AND sent_at IS NULL;

  SELECT reminder_intervals_hours INTO intervals FROM public.platform_settings WHERE id = true;
  intervals := COALESCE(intervals, ARRAY[24,6,1]::int[]);

  FOREACH h IN ARRAY intervals LOOP
    due := (NEW.end_date::timestamp + interval '23 hours 59 minutes')::timestamptz - (h || ' hours')::interval;
    IF due > now() THEN
      INSERT INTO public.rental_reminders(rental_id, due_at, hours_before)
      VALUES (NEW.id, due, h);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS rentals_schedule_reminders ON public.rentals;
CREATE TRIGGER rentals_schedule_reminders
  AFTER INSERT OR UPDATE OF end_date ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.tg_schedule_rental_reminders();
