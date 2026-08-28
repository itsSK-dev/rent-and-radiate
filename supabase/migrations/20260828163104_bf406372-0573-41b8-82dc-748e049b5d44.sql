ALTER TABLE public.rentals
  ADD CONSTRAINT rentals_customer_profiles_fkey
  FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_rater_profiles_fkey
  FOREIGN KEY (rater_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.deposit_refunds
  ADD CONSTRAINT deposit_refunds_customer_profiles_fkey
  FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.manual_payments
  ADD CONSTRAINT manual_payments_user_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;