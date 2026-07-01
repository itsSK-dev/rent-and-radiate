
CREATE OR REPLACE FUNCTION public.guard_store_admin_controls()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                      OR (current_setting('role', true) = 'service_role')
                      OR current_user IN ('postgres','supabase_admin');
BEGIN
  IF is_service OR is_admin THEN
    RETURN NEW;
  END IF;

  -- Preserve all admin-only moderation, trust, and rating fields for non-admin callers
  NEW.status            := OLD.status;
  NEW.is_verified       := OLD.is_verified;
  NEW.is_active         := OLD.is_active;
  NEW.is_blocked        := OLD.is_blocked;
  NEW.approved          := OLD.approved;
  NEW.is_suspicious     := OLD.is_suspicious;
  NEW.suspicious_reason := OLD.suspicious_reason;
  NEW.flagged_at        := OLD.flagged_at;
  NEW.rating            := OLD.rating;
  NEW.rating_count      := OLD.rating_count;
  NEW.rejection_reason  := OLD.rejection_reason;

  RETURN NEW;
END;
$function$;
