-- Moderation log
CREATE TABLE IF NOT EXISTS public.user_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  from_value jsonb,
  to_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_moderation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view moderation log" ON public.user_moderation_log;
CREATE POLICY "Admins view moderation log"
  ON public.user_moderation_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins insert moderation log" ON public.user_moderation_log;
CREATE POLICY "Admins insert moderation log"
  ON public.user_moderation_log FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Guard trigger: only admins / service role may change blocked or trust_score
CREATE OR REPLACE FUNCTION public.guard_profile_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role');
BEGIN
  IF is_service OR is_admin THEN
    -- Log change when admin modifies these fields
    IF is_admin AND NEW.blocked IS DISTINCT FROM OLD.blocked THEN
      INSERT INTO public.user_moderation_log (target_user_id, actor_id, action, from_value, to_value)
      VALUES (NEW.id, auth.uid(),
              CASE WHEN NEW.blocked THEN 'block_user' ELSE 'unblock_user' END,
              to_jsonb(OLD.blocked), to_jsonb(NEW.blocked));
    END IF;
    IF is_admin AND NEW.trust_score IS DISTINCT FROM OLD.trust_score THEN
      INSERT INTO public.user_moderation_log (target_user_id, actor_id, action, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'trust_score_change',
              to_jsonb(OLD.trust_score), to_jsonb(NEW.trust_score));
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.blocked IS DISTINCT FROM OLD.blocked THEN
    RAISE EXCEPTION 'Only admins can change blocked status';
  END IF;
  IF NEW.trust_score IS DISTINCT FROM OLD.trust_score THEN
    RAISE EXCEPTION 'Only admins can change trust score';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_profile_moderation_fields ON public.profiles;
CREATE TRIGGER guard_profile_moderation_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_moderation_fields();

-- Admin-only update policy (in addition to self-update which the trigger now restricts)
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));