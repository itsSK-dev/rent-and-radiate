
-- 1) Remove insecure self-grant RPC
DROP FUNCTION IF EXISTS public.request_store_owner_role();

-- 2) Allow any authenticated user to submit a (pending) store for admin review.
--    The store stays hidden until approved; role is granted only on approval.
DROP POLICY IF EXISTS "Owners create their store" ON public.stores;
CREATE POLICY "Owners create their store"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND status = 'pending'::store_status
  AND is_verified = false
  AND is_blocked = false
  AND approved = false
);

-- 3) When an admin approves a store, grant store_owner role to the owner and log it.
CREATE OR REPLACE FUNCTION public.grant_store_owner_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role')
                     OR current_user IN ('postgres','supabase_admin');
BEGIN
  IF NEW.status = 'approved'::store_status
     AND (OLD.status IS DISTINCT FROM 'approved'::store_status)
     AND (is_admin OR is_service) THEN

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.owner_id, 'store_owner'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_moderation_log
      (target_user_id, actor_id, action, from_value, to_value, reason)
    VALUES
      (NEW.owner_id, auth.uid(), 'grant_store_owner',
       to_jsonb(OLD.status::text), to_jsonb(NEW.status::text),
       'Store ' || NEW.id::text || ' approved');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grant_store_owner_on_approval ON public.stores;
CREATE TRIGGER trg_grant_store_owner_on_approval
AFTER UPDATE OF status ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.grant_store_owner_on_approval();
