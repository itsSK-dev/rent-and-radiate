-- 1. New columns on deposit_refunds
ALTER TABLE public.deposit_refunds
  ADD COLUMN IF NOT EXISTS late_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damage_charges numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_charges numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_deductions numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS razorpay_refund_id text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_failure_reason text,
  ADD COLUMN IF NOT EXISTS auto_created boolean NOT NULL DEFAULT false;

-- 2. Recompute breakdown on insert/update (replaces existing enforce_deposit_refund_amounts)
CREATE OR REPLACE FUNCTION public.enforce_deposit_refund_amounts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  expected_pct int;
  condition_refund numeric;
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
BEGIN
  expected_pct := CASE NEW.condition_tier::text
    WHEN 'perfect' THEN 100
    WHEN 'minor' THEN 75
    WHEN 'moderate' THEN 40
    WHEN 'severe' THEN 0
    ELSE -1 END;
  IF expected_pct < 0 THEN
    RAISE EXCEPTION 'Invalid condition tier';
  END IF;

  SELECT deposit, grand_total, rental_total, gst_amount, delivery_fee
    INTO r FROM public.rentals WHERE id = NEW.rental_id;
  IF r.deposit IS NULL THEN
    RAISE EXCEPTION 'Unknown rental';
  END IF;

  NEW.deposit_amount := r.deposit;
  NEW.refund_percent := expected_pct;
  NEW.late_fee := GREATEST(0, COALESCE(NEW.late_fee, 0));
  NEW.damage_charges := GREATEST(0, COALESCE(NEW.damage_charges, 0));

  condition_refund := ROUND(r.deposit * expected_pct / 100.0);
  NEW.refund_amount := GREATEST(0, condition_refund - NEW.late_fee - NEW.damage_charges);

  NEW.total_paid := COALESCE(r.grand_total, 0);
  NEW.rental_charges := COALESCE(r.rental_total, 0)
                      + COALESCE(r.gst_amount, 0)
                      + COALESCE(r.delivery_fee, 0);
  NEW.total_deductions := GREATEST(0, COALESCE(r.deposit,0) - NEW.refund_amount);

  -- Non-admin / non-service callers cannot change status, refund_id, refunded_at, reviewer
  IF NOT (is_service OR is_admin) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending_admin'::public.refund_status;
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
      NEW.admin_notes := NULL;
      NEW.razorpay_refund_id := NULL;
      NEW.refunded_at := NULL;
      NEW.refund_failure_reason := NULL;
    ELSE
      -- Updates by store owner: lock down admin/financial-action fields
      NEW.status := OLD.status;
      NEW.reviewed_by := OLD.reviewed_by;
      NEW.reviewed_at := OLD.reviewed_at;
      NEW.admin_notes := OLD.admin_notes;
      NEW.razorpay_refund_id := OLD.razorpay_refund_id;
      NEW.refunded_at := OLD.refunded_at;
      NEW.refund_failure_reason := OLD.refund_failure_reason;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply trigger to BEFORE UPDATE too (was only BEFORE INSERT)
DROP TRIGGER IF EXISTS tg_deposit_refunds_enforce_ins ON public.deposit_refunds;
DROP TRIGGER IF EXISTS tg_deposit_refunds_enforce_upd ON public.deposit_refunds;
DROP TRIGGER IF EXISTS deposit_refunds_enforce ON public.deposit_refunds;
CREATE TRIGGER tg_deposit_refunds_enforce_ins
  BEFORE INSERT ON public.deposit_refunds
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deposit_refund_amounts();
CREATE TRIGGER tg_deposit_refunds_enforce_upd
  BEFORE UPDATE ON public.deposit_refunds
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deposit_refund_amounts();

-- 3. Allow store-owner UPDATE while pending_admin (RLS)
DROP POLICY IF EXISTS "Store owner updates pending refund" ON public.deposit_refunds;
CREATE POLICY "Store owner updates pending refund" ON public.deposit_refunds
  FOR UPDATE TO authenticated
  USING (
    status = 'pending_admin'
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = deposit_refunds.store_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = deposit_refunds.store_id AND s.owner_id = auth.uid())
  );

-- 4. Auto-create refund + notify admins on rental returned
CREATE OR REPLACE FUNCTION public.tg_auto_create_refund_on_return()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  existing_id uuid;
  per_day numeric;
  days_late int;
  computed_late numeric := 0;
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

  IF NEW.end_date IS NOT NULL AND NEW.returned_at IS NOT NULL THEN
    days_late := GREATEST(0, (NEW.returned_at::date - NEW.end_date)::int);
    IF NEW.days IS NOT NULL AND NEW.days > 0 AND days_late > 0 THEN
      per_day := COALESCE(NEW.rental_total, 0) / NEW.days;
      computed_late := ROUND(per_day * days_late);
    END IF;
  END IF;

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

  -- Notify ALL admins
  INSERT INTO public.notifications(user_id, type, title, body, link_url, metadata)
  SELECT ur.user_id,
         'order_update'::public.notification_type,
         '💰 Refund pending approval · ' || COALESCE(product_title, 'rental'),
         'Customer: ' || COALESCE(customer_name, '—')
           || E'\nShop: ' || COALESCE(store_name, '—')
           || E'\nDeposit: ₹' || NEW.deposit::text
           || ' · Late fee: ₹' || computed_late::text
           || E'\nReview and process refund via Admin → Refunds.',
         '/admin?tab=refunds',
         jsonb_build_object(
           'refund_id', new_refund_id,
           'rental_id', NEW.id,
           'deposit', NEW.deposit,
           'late_fee', computed_late
         )
  FROM public.user_roles ur WHERE ur.role = 'admin'::public.app_role;

  -- Notify customer that return is verified
  INSERT INTO public.notifications(user_id, type, title, body, link_url, metadata)
  VALUES (
    NEW.customer_id,
    'rental_update'::public.notification_type,
    '✅ Return verified — refund pending review',
    'Your return of ' || COALESCE(product_title, 'the item')
      || ' has been verified. The platform admin is reviewing your refund of up to ₹'
      || NEW.deposit::text || '.',
    '/my-rentals',
    jsonb_build_object('rental_id', NEW.id, 'refund_id', new_refund_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_auto_refund_on_return ON public.rentals;
CREATE TRIGGER tg_auto_refund_on_return
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_create_refund_on_return();

-- 5. Notify customer on refund status changes (approved / processing / completed / failed / rejected)
CREATE OR REPLACE FUNCTION public.tg_notify_refund_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  product_title text;
  title_txt text;
  body_txt text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT pr.title INTO product_title
  FROM public.rentals r
  JOIN public.products pr ON pr.id = r.product_id
  WHERE r.id = NEW.rental_id;

  CASE NEW.status::text
    WHEN 'approved' THEN
      title_txt := '✅ Refund approved';
      body_txt := 'Your refund of ₹' || NEW.refund_amount::text || ' for '
        || COALESCE(product_title, 'your rental') || ' has been approved by the admin and will be processed shortly.';
    WHEN 'processing' THEN
      title_txt := '⏳ Refund being processed';
      body_txt := 'Your refund of ₹' || NEW.refund_amount::text
        || ' is being sent to your original payment method.';
    WHEN 'completed' THEN
      title_txt := '🎉 Refund completed';
      body_txt := '₹' || NEW.refund_amount::text || ' has been refunded for '
        || COALESCE(product_title, 'your rental')
        || '. It should reflect in your account in 5–7 business days.';
    WHEN 'failed' THEN
      title_txt := '⚠️ Refund failed';
      body_txt := 'We could not process your refund of ₹' || NEW.refund_amount::text
        || '. ' || COALESCE(NEW.refund_failure_reason, 'Our team has been notified and will retry.');
    WHEN 'rejected' THEN
      title_txt := '❌ Refund rejected';
      body_txt := 'Your refund request for ' || COALESCE(product_title, 'your rental')
        || ' was not approved. ' || COALESCE(NEW.admin_notes, '');
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.notifications(user_id, type, title, body, link_url, metadata)
  VALUES (
    NEW.customer_id,
    'rental_update'::public.notification_type,
    title_txt, body_txt,
    '/my-rentals',
    jsonb_build_object('refund_id', NEW.id, 'rental_id', NEW.rental_id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_refund_status_notify ON public.deposit_refunds;
CREATE TRIGGER tg_refund_status_notify
  AFTER UPDATE OF status ON public.deposit_refunds
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_refund_status();

-- 6. Backfill breakdown for existing refund rows
UPDATE public.deposit_refunds dr
SET total_paid = COALESCE(r.grand_total, 0),
    rental_charges = COALESCE(r.rental_total, 0) + COALESCE(r.gst_amount,0) + COALESCE(r.delivery_fee,0),
    total_deductions = GREATEST(0, COALESCE(r.deposit,0) - dr.refund_amount)
FROM public.rentals r
WHERE r.id = dr.rental_id
  AND dr.total_paid = 0;