ALTER TABLE public.disputes
  DROP CONSTRAINT IF EXISTS disputes_opened_by_profiles_fkey;

ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_opened_by_profiles_fkey
  FOREIGN KEY (opened_by) REFERENCES public.profiles(id) ON DELETE CASCADE;