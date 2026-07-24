
-- Bulletproof duplicate-payment prevention at the database layer.
-- The verify function already checks payment_status='paid' before inserting,
-- but a race between two concurrent handler+webhook calls could still create
-- two paid payment rows. These partial unique indexes guarantee it can't happen.

CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_payment_id_uidx
  ON public.payments (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_paid_per_rental_uidx
  ON public.payments (rental_id)
  WHERE status = 'paid';

-- One active (non-terminal) manual payment per rental to stop double-submits.
CREATE UNIQUE INDEX IF NOT EXISTS manual_payments_one_active_per_rental_uidx
  ON public.manual_payments (rental_id)
  WHERE status IN ('pending_verification', 'verified');
