CREATE OR REPLACE FUNCTION public.tg_apply_store_verification_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean := public.has_role(auth.uid(),'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role')
                     OR current_user IN ('postgres','supabase_admin');
  store_name text;
BEGIN
  IF NOT (is_admin OR is_service) THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  SELECT name INTO store_name FROM public.stores WHERE id = NEW.store_id;

  IF NEW.status = 'approved' THEN
    NEW.reviewed_at := now();
    NEW.reviewed_by := auth.uid();
    UPDATE public.stores
       SET status = 'approved'::public.store_status,
           is_verified = true,
           approved = true,
           is_active = true,
           rejection_reason = NULL,
           updated_at = now()
     WHERE id = NEW.store_id;
    INSERT INTO public.notifications(user_id,type,title,body,link_url,metadata)
    VALUES (NEW.owner_id,'order_update'::public.notification_type,
            '✅ Shop verified: ' || COALESCE(store_name,'your shop'),
            'Your documents were approved. Your shop now shows the Verified badge to customers.',
            '/vendor/verification',
            jsonb_build_object('store_id',NEW.store_id,'verification_id',NEW.id));
  ELSIF NEW.status = 'rejected' THEN
    NEW.reviewed_at := now();
    NEW.reviewed_by := auth.uid();
    UPDATE public.stores
       SET status = 'rejected'::public.store_status,
           is_verified = false,
           approved = false,
           rejection_reason = COALESCE(NEW.rejection_reason, rejection_reason),
           updated_at = now()
     WHERE id = NEW.store_id;
    INSERT INTO public.notifications(user_id,type,title,body,link_url,metadata)
    VALUES (NEW.owner_id,'order_update'::public.notification_type,
            '⚠️ Verification needs changes',
            COALESCE(NEW.rejection_reason,'An admin requested changes to your documents.'),
            '/vendor/verification',
            jsonb_build_object('store_id',NEW.store_id,'verification_id',NEW.id));
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.sync_store_admin_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'approved' THEN
    NEW.approved := true;
    NEW.is_verified := true;
    NEW.is_active := true;
  ELSIF NEW.status IN ('pending', 'rejected', 'deleted') THEN
    NEW.approved := false;
    NEW.is_verified := false;
  END IF;

  IF NEW.is_verified = true AND NEW.status <> 'approved' THEN
    NEW.status := 'approved';
    NEW.approved := true;
    NEW.is_active := true;
  ELSIF NEW.is_verified = false AND NEW.status = 'approved' THEN
    NEW.status := 'pending';
    NEW.approved := false;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;