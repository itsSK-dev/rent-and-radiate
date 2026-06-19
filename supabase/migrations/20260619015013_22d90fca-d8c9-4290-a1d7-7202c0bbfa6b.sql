
-- 1. Add deposit_percent setting + enforce min 10% rental
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS deposit_percent_of_price numeric NOT NULL DEFAULT 100;

UPDATE public.platform_settings
   SET rental_price_percent = 10
 WHERE rental_price_percent IS NULL OR rental_price_percent < 10;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_rental_min_chk;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_rental_min_chk
  CHECK (rental_price_percent >= 10);

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_deposit_pct_chk;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_deposit_pct_chk
  CHECK (deposit_percent_of_price >= 0 AND deposit_percent_of_price <= 500);

-- 2. Update product trigger to auto-calc deposit too
CREATE OR REPLACE FUNCTION public.tg_compute_product_rental_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pct numeric;
  dep_pct numeric;
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  effective_price numeric;
BEGIN
  SELECT rental_price_percent, deposit_percent_of_price
    INTO pct, dep_pct
    FROM public.platform_settings WHERE id = true;
  pct := GREATEST(10, COALESCE(pct, 10));
  dep_pct := GREATEST(0, COALESCE(dep_pct, 100));

  -- Use the discounted selling price as the basis so rental + deposit
  -- automatically follow any price changes / discounts.
  effective_price := GREATEST(
    0,
    COALESCE(NEW.actual_price, 0)
      - (COALESCE(NEW.actual_price, 0) * GREATEST(0, LEAST(100, COALESCE(NEW.discount_percent, 0))) / 100.0)
      - GREATEST(0, COALESCE(NEW.discount_flat, 0))
  );

  IF NOT (is_service OR is_admin) THEN
    NEW.price_per_day := ROUND(effective_price * pct / 100.0 * 100) / 100;
    NEW.security_deposit := ROUND(effective_price * dep_pct / 100.0 * 100) / 100;
  ELSE
    IF NEW.price_per_day IS NULL OR NEW.price_per_day = 0 THEN
      NEW.price_per_day := ROUND(effective_price * pct / 100.0 * 100) / 100;
    END IF;
    IF NEW.security_deposit IS NULL OR NEW.security_deposit = 0 THEN
      NEW.security_deposit := ROUND(effective_price * dep_pct / 100.0 * 100) / 100;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Backfill all products
WITH s AS (
  SELECT GREATEST(10, COALESCE(rental_price_percent, 10)) AS rp,
         GREATEST(0,  COALESCE(deposit_percent_of_price, 100)) AS dp
  FROM public.platform_settings WHERE id = true
)
UPDATE public.products p
   SET price_per_day = ROUND(
         GREATEST(0, COALESCE(p.actual_price,0)
           - (COALESCE(p.actual_price,0) * GREATEST(0,LEAST(100,COALESCE(p.discount_percent,0))) / 100.0)
           - GREATEST(0, COALESCE(p.discount_flat,0))
         ) * s.rp / 100.0 * 100) / 100,
       security_deposit = ROUND(
         GREATEST(0, COALESCE(p.actual_price,0)
           - (COALESCE(p.actual_price,0) * GREATEST(0,LEAST(100,COALESCE(p.discount_percent,0))) / 100.0)
           - GREATEST(0, COALESCE(p.discount_flat,0))
         ) * s.dp / 100.0 * 100) / 100
  FROM s
 WHERE p.actual_price IS NOT NULL;
