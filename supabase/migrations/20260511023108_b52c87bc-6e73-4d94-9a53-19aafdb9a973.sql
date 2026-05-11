
-- Extend payment_status enum
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'pending_verification';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'verification_failed';

-- payment_settings (single row)
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  upi_id text NOT NULL DEFAULT '',
  payee_name text NOT NULL DEFAULT 'Bloom Rentals',
  qr_image_url text,
  instructions text NOT NULL DEFAULT 'Scan the QR with any UPI app (GPay, PhonePe, Paytm, BHIM). After paying, tap "I have paid" so we can verify.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.payment_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views payment settings" ON public.payment_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins update payment settings" ON public.payment_settings
  FOR UPDATE USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins insert payment settings" ON public.payment_settings
  FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER tg_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- manual_payments
DO $$ BEGIN
  CREATE TYPE public.manual_payment_status AS ENUM ('pending_verification','verified','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payout_status AS ENUM ('unpaid','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.manual_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL,
  user_id uuid NOT NULL,
  store_id uuid NOT NULL,
  amount numeric NOT NULL,
  upi_id text NOT NULL,
  user_reference text,
  status public.manual_payment_status NOT NULL DEFAULT 'pending_verification',
  admin_notes text,
  verified_by uuid,
  verified_at timestamptz,
  payout_status public.payout_status NOT NULL DEFAULT 'unpaid',
  payout_amount numeric,
  payout_paid_at timestamptz,
  payout_notes text,
  commission_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_payments_rental ON public.manual_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_status ON public.manual_payments(status);
CREATE INDEX IF NOT EXISTS idx_manual_payments_payout ON public.manual_payments(payout_status);

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers create own manual payments" ON public.manual_payments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND r.customer_id = auth.uid())
  );

CREATE POLICY "Parties view manual payments" ON public.manual_payments
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'::public.app_role)
  );

CREATE POLICY "Admins update manual payments" ON public.manual_payments
  FOR UPDATE USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER tg_manual_payments_updated_at
BEFORE UPDATE ON public.manual_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- When user inserts a pending manual payment, mark rental as pending_verification
CREATE OR REPLACE FUNCTION public.on_manual_payment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.rentals
    SET payment_status = 'pending_verification'::payment_status,
        payment_method = 'upi_qr',
        updated_at = now()
    WHERE id = NEW.rental_id
      AND payment_status IN ('unpaid'::payment_status, 'verification_failed'::payment_status);
  RETURN NEW;
END $$;

CREATE TRIGGER tg_manual_payments_after_insert
AFTER INSERT ON public.manual_payments
FOR EACH ROW EXECUTE FUNCTION public.on_manual_payment_insert();

-- When admin verifies / fails the payment, sync rentals
CREATE OR REPLACE FUNCTION public.on_manual_payment_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'verified' THEN
    NEW.verified_at := COALESCE(NEW.verified_at, now());
    NEW.verified_by := COALESCE(NEW.verified_by, auth.uid());
    UPDATE public.rentals
      SET payment_status = 'paid'::payment_status,
          status = CASE WHEN status = 'pending'::rental_status THEN 'confirmed'::rental_status ELSE status END,
          updated_at = now()
      WHERE id = NEW.rental_id;
  ELSIF NEW.status = 'failed' THEN
    UPDATE public.rentals
      SET payment_status = 'verification_failed'::payment_status,
          updated_at = now()
      WHERE id = NEW.rental_id;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER tg_manual_payments_before_update
BEFORE UPDATE ON public.manual_payments
FOR EACH ROW EXECUTE FUNCTION public.on_manual_payment_review();

-- Update rental payment guard so admin verification trigger can mark paid
CREATE OR REPLACE FUNCTION public.guard_rental_payment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
  is_admin boolean := public.has_role(auth.uid(),'admin'::public.app_role);
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NOT is_service AND NOT is_admin THEN
    IF NEW.payment_status IN ('paid','partial_refund','refunded') THEN
      RAISE EXCEPTION 'payment_status % can only be set by server-side payment verification', NEW.payment_status;
    END IF;
  END IF;
  RETURN NEW;
END $$;
