
DROP POLICY IF EXISTS "Authenticated users view ratings" ON public.ratings;

CREATE POLICY "Involved parties view ratings"
ON public.ratings FOR SELECT TO authenticated
USING (
  auth.uid() = rater_id
  OR auth.uid() = ratee_user_id
  OR (ratee_store_id IS NOT NULL AND public.is_owner_of_store(ratee_store_id))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE OR REPLACE VIEW public.product_reviews AS
SELECT r.id, rn.product_id, r.rental_id, r.stars, r.comment, r.created_at
FROM public.ratings r
JOIN public.rentals rn ON rn.id = r.rental_id;

GRANT SELECT ON public.product_reviews TO anon, authenticated;
