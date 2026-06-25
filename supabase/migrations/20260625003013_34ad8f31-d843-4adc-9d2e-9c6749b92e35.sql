-- 1) Restrict platform_settings reads to authenticated users (was public).
DROP POLICY IF EXISTS "Anyone views platform settings" ON public.platform_settings;
CREATE POLICY "Authenticated users view platform settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.platform_settings FROM anon;

-- 2) Pin search_path on generate_referral_code (linter: 0011_function_search_path_mutable).
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  code text;
  exists_count int;
BEGIN
  LOOP
    code := upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
    SELECT count(*) INTO exists_count FROM public.profiles WHERE referral_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END $function$;