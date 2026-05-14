-- Remove pre-existing duplicates (keep oldest) before adding constraint
DELETE FROM public.ratings r
USING public.ratings r2
WHERE r.rental_id = r2.rental_id
  AND r.rater_id = r2.rater_id
  AND r.created_at > r2.created_at;

ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_rental_rater_unique UNIQUE (rental_id, rater_id);