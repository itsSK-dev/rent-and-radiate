-- Public catalogue tables need SELECT grant to the anon role so PostgREST
-- allows the request to reach RLS. Without these grants the API returns
-- 401 "permission denied for table ..." for logged-out visitors, which is
-- why product/store data appeared only to the signed-in admin.
GRANT SELECT ON public.stores TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.ratings TO anon;
GRANT SELECT ON public.ad_packages TO anon;
GRANT SELECT ON public.advertisements TO anon;
GRANT SELECT ON public.platform_settings TO anon;