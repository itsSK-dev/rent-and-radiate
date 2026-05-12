
-- 1) Strengthen the rental payment guard to cover ALL payment-sensitive columns
CREATE OR REPLACE FUNCTION public.guard_rental_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
  is_admin boolean := public.has_role(auth.uid(),'admin'::public.app_role);
BEGIN
  IF is_service OR is_admin THEN
    RETURN NEW;
  END IF;

  -- Block any client change to payment_status (the trigger on manual_payments
  -- and the verify edge function both run as SECURITY DEFINER / service role,
  -- so legitimate flows still work).
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'payment_status can only be set by server-side payment verification';
  END IF;

  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    RAISE EXCEPTION 'payment_method can only be set by server-side payment verification';
  END IF;

  IF NEW.razorpay_order_id   IS DISTINCT FROM OLD.razorpay_order_id
  OR NEW.razorpay_payment_id IS DISTINCT FROM OLD.razorpay_payment_id
  OR NEW.razorpay_signature  IS DISTINCT FROM OLD.razorpay_signature THEN
    RAISE EXCEPTION 'Razorpay payment identifiers can only be set by server-side payment verification';
  END IF;

  RETURN NEW;
END $function$;

-- Trigger may already exist from prior migrations, but ensure it is wired up.
DROP TRIGGER IF EXISTS trg_guard_rental_payment_status ON public.rentals;
CREATE TRIGGER trg_guard_rental_payment_status
BEFORE UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.guard_rental_payment_status();

-- 2) Audit log of every payment verification attempt
CREATE TABLE IF NOT EXISTS public.payment_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid,
  user_id uuid,
  provider text NOT NULL,
  outcome text NOT NULL,                 -- 'success' | 'invalid_signature' | 'failed' | 'forbidden' | 'not_found' | 'error'
  reason text,
  razorpay_order_id text,
  razorpay_payment_id text,
  amount numeric,
  ip text,
  user_agent text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_verification_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view payment verification attempts" ON public.payment_verification_attempts;
CREATE POLICY "Admins view payment verification attempts"
ON public.payment_verification_attempts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Customer views own attempts" ON public.payment_verification_attempts;
CREATE POLICY "Customer views own attempts"
ON public.payment_verification_attempts
FOR SELECT
USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies — only the service role (used by edge
-- functions) can write, which bypasses RLS.

CREATE INDEX IF NOT EXISTS payment_verification_attempts_rental_idx
  ON public.payment_verification_attempts (rental_id, created_at DESC);
