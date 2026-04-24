-- Add evidence + admin assignment to disputes
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS evidence_images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_admin uuid;

-- Allow admins broader visibility/updates already exist; ensure admins can SELECT all
DROP POLICY IF EXISTS "Admins view all disputes" ON public.disputes;
CREATE POLICY "Admins view all disputes" ON public.disputes
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: enforce proof images before status transitions
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
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'delivered' THEN
    SELECT COUNT(*) INTO before_count
    FROM public.rental_images
    WHERE rental_id = NEW.id AND stage = 'before_delivery';
    IF before_count = 0 THEN
      RAISE EXCEPTION 'Cannot mark as delivered: store must upload at least one before-delivery photo first.';
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

DROP TRIGGER IF EXISTS trg_enforce_rental_proof_images ON public.rentals;
CREATE TRIGGER trg_enforce_rental_proof_images
  BEFORE UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rental_proof_images();