REVOKE EXECUTE ON FUNCTION public.get_public_payment_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_payment_settings() TO authenticated;