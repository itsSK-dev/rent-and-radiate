
-- 1) location_interest: format validation + rate limiting via trigger
CREATE OR REPLACE FUNCTION public.validate_location_interest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  -- Format checks
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    IF NEW.email !~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid email format';
    END IF;
  END IF;

  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    IF NEW.phone !~ '^[0-9+\-\s()]{6,32}$' THEN
      RAISE EXCEPTION 'Invalid phone format';
    END IF;
  END IF;

  IF NEW.email IS NULL AND NEW.phone IS NULL AND NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Provide email or phone';
  END IF;

  -- If authenticated, enforce user_id matches
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  -- Throttle: max 5 identical email/phone entries per hour
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    SELECT count(*) INTO recent_count
    FROM public.location_interest
    WHERE email = NEW.email
      AND created_at > now() - interval '1 hour';
    IF recent_count >= 5 THEN
      RAISE EXCEPTION 'Too many submissions. Please try again later.';
    END IF;
  END IF;

  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    SELECT count(*) INTO recent_count
    FROM public.location_interest
    WHERE phone = NEW.phone
      AND created_at > now() - interval '1 hour';
    IF recent_count >= 5 THEN
      RAISE EXCEPTION 'Too many submissions. Please try again later.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_location_interest ON public.location_interest;
CREATE TRIGGER trg_validate_location_interest
BEFORE INSERT ON public.location_interest
FOR EACH ROW EXECUTE FUNCTION public.validate_location_interest();

-- 2) Storage policies: enforce owner=auth.uid() on insert, path match on update
DROP POLICY IF EXISTS "Owners upload product images" ON storage.objects;
CREATE POLICY "Owners upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND owner = auth.uid()
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND has_role(auth.uid(), 'store_owner'::app_role)
  AND EXISTS (SELECT 1 FROM stores s WHERE s.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Owners upload store logos" ON storage.objects;
CREATE POLICY "Owners upload store logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-logos'
  AND owner = auth.uid()
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND has_role(auth.uid(), 'store_owner'::app_role)
);

DROP POLICY IF EXISTS "Owners update own product images" ON storage.objects;
CREATE POLICY "Owners update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid() = owner
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid() = owner
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Owners update store logos" ON storage.objects;
CREATE POLICY "Owners update store logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'store-logos'
  AND auth.uid() = owner
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'store-logos'
  AND auth.uid() = owner
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Owners delete own product images" ON storage.objects;
CREATE POLICY "Owners delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid() = owner
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
