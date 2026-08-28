REVOKE ALL ON FUNCTION public.promote_eligible_settlements() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_eligible_settlements() TO service_role;