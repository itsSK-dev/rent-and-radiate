
-- Protection plan configuration
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS protection_plan_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS protection_claim_window_days int NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS protection_max_claim_percent numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS protection_requires_photos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS protection_min_photos int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS protection_refund_window_days int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS protection_refund_on_cancel_percent numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS protection_non_refundable_after_delivery boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS protection_claim_rules text DEFAULT 'Damage, theft, and accidental loss covered up to the product value. File within the claim window with photos and a description.',
  ADD COLUMN IF NOT EXISTS protection_refund_rules text DEFAULT 'Protection fee is refundable if the rental is cancelled before delivery. Once the item is delivered the protection fee is non-refundable.';

-- Fraud alerts
DO $$ BEGIN
  CREATE TYPE public.fraud_alert_kind AS ENUM (
    'suspicious_login','suspicious_payment','repeated_failed_payment',
    'flagged_user','flagged_seller','chargeback','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fraud_alert_severity AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fraud_alert_status AS ENUM ('open','reviewing','resolved','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.fraud_alert_kind NOT NULL,
  severity public.fraud_alert_severity NOT NULL DEFAULT 'medium',
  status public.fraud_alert_status NOT NULL DEFAULT 'open',
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON public.fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_severity ON public.fraud_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_subject_user ON public.fraud_alerts(subject_user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_subject_store ON public.fraud_alerts(subject_store_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created ON public.fraud_alerts(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.fraud_alerts TO authenticated;
GRANT ALL ON public.fraud_alerts TO service_role;

ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view fraud alerts"
  ON public.fraud_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update fraud alerts"
  ON public.fraud_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert fraud alerts"
  ON public.fraud_alerts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER set_fraud_alerts_updated_at
  BEFORE UPDATE ON public.fraud_alerts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Add is_suspicious / suspicious_reason to profiles and stores for flagging
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspicious boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspicious_reason text,
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS is_suspicious boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspicious_reason text,
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz;

-- Admin-only RPC to flag/unflag a user or store and link to an alert
CREATE OR REPLACE FUNCTION public.admin_flag_subject(
  _kind text,             -- 'user' or 'store'
  _id uuid,
  _flag boolean,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE='42501';
  END IF;
  IF _kind = 'user' THEN
    UPDATE public.profiles
       SET is_suspicious = _flag,
           suspicious_reason = CASE WHEN _flag THEN _reason ELSE NULL END,
           flagged_at = CASE WHEN _flag THEN now() ELSE NULL END
     WHERE id = _id;
  ELSIF _kind = 'store' THEN
    UPDATE public.stores
       SET is_suspicious = _flag,
           suspicious_reason = CASE WHEN _flag THEN _reason ELSE NULL END,
           flagged_at = CASE WHEN _flag THEN now() ELSE NULL END
     WHERE id = _id;
  ELSE
    RAISE EXCEPTION 'invalid kind';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_flag_subject(text,uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_flag_subject(text,uuid,boolean,text) TO authenticated;

-- Auto-create fraud alert on repeated failed payment verifications
CREATE OR REPLACE FUNCTION public.tg_detect_repeated_payment_failures()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recent_fails int;
  v_customer uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'failed' THEN RETURN NEW; END IF;

  SELECT r.customer_id INTO v_customer FROM public.rentals r WHERE r.id = NEW.rental_id;
  IF v_customer IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO recent_fails
    FROM public.manual_payments mp
    JOIN public.rentals r ON r.id = mp.rental_id
   WHERE r.customer_id = v_customer
     AND mp.status = 'failed'
     AND mp.updated_at > now() - interval '24 hours';

  IF recent_fails >= 3 THEN
    INSERT INTO public.fraud_alerts(kind, severity, subject_user_id, rental_id, title, description, metadata)
    VALUES (
      'repeated_failed_payment'::public.fraud_alert_kind,
      CASE WHEN recent_fails >= 5 THEN 'high'::public.fraud_alert_severity ELSE 'medium'::public.fraud_alert_severity END,
      v_customer, NEW.rental_id,
      'Repeated failed payment verifications',
      recent_fails || ' failed payment verifications in the last 24 hours.',
      jsonb_build_object('failed_count', recent_fails, 'manual_payment_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS detect_repeated_payment_failures ON public.manual_payments;
CREATE TRIGGER detect_repeated_payment_failures
  AFTER UPDATE ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_detect_repeated_payment_failures();
