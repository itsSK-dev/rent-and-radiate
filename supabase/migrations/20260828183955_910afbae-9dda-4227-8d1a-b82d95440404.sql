ALTER TABLE public.delivery_otps
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sent_channel text,
  ADD COLUMN IF NOT EXISTS send_error text,
  ADD COLUMN IF NOT EXISTS verified_by_partner_id uuid;

ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS delivery_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_verified_by uuid,
  ADD COLUMN IF NOT EXISTS return_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_verified_by uuid;

CREATE INDEX IF NOT EXISTS idx_otp_rental_kind_active
  ON public.delivery_otps (rental_id, kind, created_at DESC);