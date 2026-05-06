
-- 1) Prevent client-side escalation of payment_status to paid/partial_refund/refunded
CREATE OR REPLACE FUNCTION public.guard_rental_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NOT is_service THEN
    IF NEW.payment_status IN ('paid','partial_refund','refunded') THEN
      RAISE EXCEPTION 'payment_status % can only be set by server-side payment verification', NEW.payment_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_rental_payment_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_rental_payment_status ON public.rentals;
CREATE TRIGGER trg_guard_rental_payment_status
BEFORE UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.guard_rental_payment_status();

-- 2) Stop signup trigger from honoring client-supplied role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer'::public.app_role);
  RETURN NEW;
END;
$$;
