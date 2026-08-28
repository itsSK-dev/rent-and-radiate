CREATE OR REPLACE FUNCTION public.promote_eligible_settlements()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n int;
  _is_admin boolean;
BEGIN
  IF NOT public._is_service_role() AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _is_admin := public._is_service_role() OR public.has_role(auth.uid(), 'admin'::public.app_role);

  IF NOT _is_admin AND NOT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.vendor_settlements vs
     SET status = 'eligible'::public.settlement_status, updated_at = now()
   WHERE vs.status = 'pending'::public.settlement_status
     AND vs.eligible_at IS NOT NULL
     AND vs.eligible_at <= now()
     AND (
       _is_admin
       OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = vs.store_id AND s.owner_id = auth.uid())
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.promote_eligible_settlements() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.promote_eligible_settlements() TO authenticated, service_role;