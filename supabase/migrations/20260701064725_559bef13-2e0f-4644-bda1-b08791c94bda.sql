
-- Ratings: allow raters to update/delete their own rating
DROP POLICY IF EXISTS "Users update their own ratings" ON public.ratings;
CREATE POLICY "Users update their own ratings" ON public.ratings
  FOR UPDATE TO authenticated USING (auth.uid() = rater_id) WITH CHECK (auth.uid() = rater_id);
DROP POLICY IF EXISTS "Users delete their own ratings" ON public.ratings;
CREATE POLICY "Users delete their own ratings" ON public.ratings
  FOR DELETE TO authenticated USING (auth.uid() = rater_id);

-- Enforce ratings only from completed rentals (returned or delivered buy),
-- and restrict rater to the customer of that rental.
CREATE OR REPLACE FUNCTION public.tg_validate_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.stars < 1 OR NEW.stars > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  SELECT customer_id, store_id, status, kind INTO r FROM public.rentals WHERE id = NEW.rental_id;
  IF r.customer_id IS NULL THEN RAISE EXCEPTION 'Unknown rental'; END IF;
  IF NEW.rater_id <> r.customer_id THEN
    RAISE EXCEPTION 'Only the customer of the order may rate it';
  END IF;
  IF NOT (r.status::text IN ('returned','delivered','completed')) THEN
    RAISE EXCEPTION 'You can rate only after the order is completed';
  END IF;
  IF NEW.ratee_store_id IS NULL THEN
    NEW.ratee_store_id := r.store_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_rating ON public.ratings;
CREATE TRIGGER trg_validate_rating BEFORE INSERT OR UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_rating();

-- Aggregate ratings into stores.rating / rating_count
CREATE OR REPLACE FUNCTION public.tg_refresh_store_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  sid := COALESCE(NEW.ratee_store_id, OLD.ratee_store_id);
  IF sid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.stores s SET
    rating = COALESCE((SELECT ROUND(AVG(stars)::numeric, 2) FROM public.ratings WHERE ratee_store_id = sid), 0),
    rating_count = (SELECT COUNT(*) FROM public.ratings WHERE ratee_store_id = sid),
    updated_at = now()
  WHERE s.id = sid;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_refresh_store_rating ON public.ratings;
CREATE TRIGGER trg_refresh_store_rating AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_store_rating();

-- Backfill (no-op if no ratings)
UPDATE public.stores s SET
  rating = COALESCE((SELECT ROUND(AVG(stars)::numeric, 2) FROM public.ratings WHERE ratee_store_id = s.id), 0),
  rating_count = (SELECT COUNT(*) FROM public.ratings WHERE ratee_store_id = s.id);
