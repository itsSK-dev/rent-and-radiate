CREATE OR REPLACE FUNCTION public.enforce_rental_proof_images()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  before_count int;
  after_count int;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  -- Buy orders do not require rental proof photos
  IF NEW.kind = 'buy' THEN RETURN NEW; END IF;

  IF NEW.status = 'delivered' THEN
    -- A customer-OTP-verified handoff is itself proof of delivery.
    IF NEW.delivery_verified_at IS NULL THEN
      SELECT COUNT(*) INTO before_count
      FROM public.rental_images
      WHERE rental_id = NEW.id AND stage = 'before_delivery';
      IF before_count = 0 THEN
        RAISE EXCEPTION 'Cannot mark as delivered: store must upload at least one before-delivery photo first, or complete OTP verification with the customer.';
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'returned' THEN
    SELECT COUNT(*) INTO after_count
    FROM public.rental_images
    WHERE rental_id = NEW.id AND stage = 'after_return';
    IF after_count = 0 THEN
      RAISE EXCEPTION 'Cannot mark as returned: customer must upload at least one after-return photo first.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;