
-- Enums
CREATE TYPE public.refund_condition AS ENUM ('perfect','minor','moderate','severe');
CREATE TYPE public.refund_status AS ENUM ('pending_admin','approved','rejected');

-- Table
CREATE TABLE public.deposit_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL UNIQUE,
  store_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  deposit_amount numeric NOT NULL,
  condition_tier public.refund_condition NOT NULL,
  refund_percent integer NOT NULL,
  refund_amount numeric NOT NULL,
  inspection_notes text,
  inspection_images text[] NOT NULL DEFAULT '{}',
  status public.refund_status NOT NULL DEFAULT 'pending_admin',
  initiated_by uuid NOT NULL,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_deposit_refunds_updated
BEFORE UPDATE ON public.deposit_refunds
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.deposit_refunds ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "Store owner inserts inspection"
ON public.deposit_refunds FOR INSERT
WITH CHECK (
  initiated_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = deposit_refunds.store_id AND s.owner_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.rentals r
    WHERE r.id = deposit_refunds.rental_id
      AND r.store_id = deposit_refunds.store_id
      AND r.status = 'returned'
  )
);

CREATE POLICY "Parties view refunds"
ON public.deposit_refunds FOR SELECT
USING (
  customer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = deposit_refunds.store_id AND s.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins update refunds"
ON public.deposit_refunds FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger: when admin approves, sync rentals.refund_amount + payment_status
CREATE OR REPLACE FUNCTION public.apply_refund_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.rentals
    SET refund_amount = NEW.refund_amount,
        payment_status = CASE
          WHEN NEW.refund_amount >= NEW.deposit_amount THEN 'refunded'::payment_status
          WHEN NEW.refund_amount > 0 THEN 'partial_refund'::payment_status
          ELSE payment_status
        END,
        updated_at = now()
    WHERE id = NEW.rental_id;
    NEW.reviewed_at = now();
    NEW.reviewed_by = auth.uid();
  END IF;
  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    NEW.reviewed_at = now();
    NEW.reviewed_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_refund_approval
BEFORE UPDATE ON public.deposit_refunds
FOR EACH ROW EXECUTE FUNCTION public.apply_refund_approval();
