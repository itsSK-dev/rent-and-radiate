
DROP VIEW IF EXISTS public.product_reviews;

CREATE OR REPLACE FUNCTION public.get_product_reviews(_product_id uuid, _limit int DEFAULT 20)
RETURNS TABLE (id uuid, stars integer, comment text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.stars, r.comment, r.created_at
  FROM public.ratings r
  JOIN public.rentals rn ON rn.id = r.rental_id
  WHERE rn.product_id = _product_id
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 50)
$$;

REVOKE ALL ON FUNCTION public.get_product_reviews(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_reviews(uuid, int) TO anon, authenticated;
