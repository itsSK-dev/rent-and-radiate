
CREATE TABLE public.location_interest (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  city TEXT NOT NULL,
  region TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.location_interest TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.location_interest TO authenticated;
GRANT ALL ON public.location_interest TO service_role;

ALTER TABLE public.location_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register interest"
ON public.location_interest
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(city) BETWEEN 1 AND 120
  AND (email IS NULL OR length(email) <= 254)
  AND (phone IS NULL OR length(phone) <= 32)
  AND (region IS NULL OR length(region) <= 120)
);

CREATE POLICY "Admins can read interest"
ON public.location_interest
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage interest"
ON public.location_interest
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_location_interest_city ON public.location_interest (lower(city));
CREATE INDEX idx_location_interest_created_at ON public.location_interest (created_at DESC);
