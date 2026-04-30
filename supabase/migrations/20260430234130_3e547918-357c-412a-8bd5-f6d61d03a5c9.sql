-- Add payment fields to rentals
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text;

-- Add 'cod' to payment_status enum if not present (paid, unpaid, refunded already exist; add cod)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cod' AND enumtypid = 'public.payment_status'::regtype) THEN
    ALTER TYPE public.payment_status ADD VALUE 'cod';
  END IF;
END$$;

-- Payments audit log
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'razorpay',
  method text NOT NULL,
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL,
  error_code text,
  error_description text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments"
ON public.payments FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.rentals r
    JOIN public.stores s ON s.id = r.store_id
    WHERE r.id = payments.rental_id AND s.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_payments_rental ON public.payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);