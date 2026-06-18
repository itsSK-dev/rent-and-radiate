
-- 1) Add platform-controlled rental pricing percentage
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS rental_price_percent numeric NOT NULL DEFAULT 10;

-- 2) Trigger to auto-compute products.price_per_day from actual_price.
--    Admins/service role may override; shop owners cannot.
CREATE OR REPLACE FUNCTION public.tg_compute_product_rental_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pct numeric;
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
BEGIN
  SELECT rental_price_percent INTO pct FROM public.platform_settings WHERE id = true;
  pct := COALESCE(pct, 10);

  -- Non-admins cannot set/override rental price; always derive from actual_price.
  IF NOT (is_service OR is_admin) THEN
    NEW.price_per_day := ROUND(COALESCE(NEW.actual_price, 0) * pct / 100.0 * 100) / 100;
  ELSE
    -- Admin/service: if rental price not provided, still auto-derive.
    IF NEW.price_per_day IS NULL OR NEW.price_per_day = 0 THEN
      NEW.price_per_day := ROUND(COALESCE(NEW.actual_price, 0) * pct / 100.0 * 100) / 100;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_product_rental_price ON public.products;
CREATE TRIGGER trg_compute_product_rental_price
  BEFORE INSERT OR UPDATE OF actual_price, price_per_day ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_compute_product_rental_price();

-- 3) Backfill existing products' price_per_day from actual_price using current %.
UPDATE public.products p
SET price_per_day = ROUND(COALESCE(p.actual_price,0)
                    * (SELECT COALESCE(rental_price_percent,10) FROM public.platform_settings WHERE id = true)
                    / 100.0 * 100) / 100
WHERE COALESCE(p.actual_price,0) > 0;
