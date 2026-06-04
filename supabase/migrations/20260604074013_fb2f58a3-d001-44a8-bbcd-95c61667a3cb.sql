
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_role text,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  target_user_id uuid,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx ON public.admin_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON public.admin_audit_log (actor_id);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view audit log" ON public.admin_audit_log;
CREATE POLICY "Admins view audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins insert audit log" ON public.admin_audit_log;
CREATE POLICY "Admins insert audit log" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Helper to detect service role
CREATE OR REPLACE FUNCTION public._is_service_role()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT (current_setting('request.jwt.claim.role', true) = 'service_role')
      OR (current_setting('role', true) = 'service_role');
$$;

-- Generic logger (SECURITY DEFINER) so triggers and RPCs can write rows
CREATE OR REPLACE FUNCTION public.log_admin_event(
  _entity_type text,
  _entity_id uuid,
  _action text,
  _target_user_id uuid DEFAULT NULL,
  _summary text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  caller uuid := auth.uid();
  caller_role text;
BEGIN
  IF public._is_service_role() THEN
    caller_role := 'service_role';
  ELSIF caller IS NOT NULL AND public.has_role(caller, 'admin'::public.app_role) THEN
    caller_role := 'admin';
  ELSIF caller IS NOT NULL THEN
    caller_role := 'user';
  ELSE
    caller_role := 'anonymous';
  END IF;

  INSERT INTO public.admin_audit_log
    (actor_id, actor_role, entity_type, entity_id, action, target_user_id, summary, metadata)
  VALUES
    (caller, caller_role, _entity_type, _entity_id, _action, _target_user_id, _summary, COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_event(text, uuid, text, uuid, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_admin_event(text, uuid, text, uuid, text, jsonb) TO authenticated, service_role;

-- Client-callable proof access logger (rate-limited to one row per user/path/hour)
CREATE OR REPLACE FUNCTION public.log_proof_access(_path text, _context text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  recent_exists boolean;
BEGIN
  IF caller IS NULL THEN RETURN; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.admin_audit_log
    WHERE actor_id = caller
      AND action = 'proof_image_viewed'
      AND metadata->>'path' = _path
      AND created_at > now() - interval '1 hour'
  ) INTO recent_exists;
  IF recent_exists THEN RETURN; END IF;
  PERFORM public.log_admin_event(
    'rental_proof', NULL, 'proof_image_viewed', NULL,
    COALESCE(_context, 'Proof image viewed'),
    jsonb_build_object('path', _path, 'context', _context)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_proof_access(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_proof_access(text, text) TO authenticated, service_role;

-- Trigger: dispute lifecycle
CREATE OR REPLACE FUNCTION public.tg_audit_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_event(
      'dispute', NEW.id, 'dispute_opened', NEW.opened_by,
      'Dispute opened on rental ' || NEW.rental_id::text,
      jsonb_build_object('rental_id', NEW.rental_id, 'status', NEW.status)
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_admin_event(
      'dispute', NEW.id, 'dispute_status_changed', NEW.opened_by,
      'Dispute ' || OLD.status || ' → ' || NEW.status,
      jsonb_build_object('rental_id', NEW.rental_id, 'from', OLD.status, 'to', NEW.status, 'resolution', NEW.resolution)
    );
  END IF;

  IF NEW.resolution IS DISTINCT FROM OLD.resolution AND NEW.resolution IS NOT NULL THEN
    PERFORM public.log_admin_event(
      'dispute', NEW.id, 'dispute_resolution_updated', NEW.opened_by,
      'Dispute resolution updated',
      jsonb_build_object('rental_id', NEW.rental_id)
    );
  END IF;

  IF COALESCE(array_length(NEW.evidence_images,1),0)
     <> COALESCE(array_length(OLD.evidence_images,1),0) THEN
    PERFORM public.log_admin_event(
      'dispute', NEW.id, 'dispute_evidence_changed', NEW.opened_by,
      'Dispute evidence images changed',
      jsonb_build_object(
        'rental_id', NEW.rental_id,
        'from_count', COALESCE(array_length(OLD.evidence_images,1),0),
        'to_count', COALESCE(array_length(NEW.evidence_images,1),0)
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_disputes ON public.disputes;
CREATE TRIGGER audit_disputes
  AFTER INSERT OR UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_dispute();

-- Trigger: deposit refund lifecycle
CREATE OR REPLACE FUNCTION public.tg_audit_deposit_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_event(
      'deposit_refund', NEW.id, 'refund_submitted', NEW.customer_id,
      'Refund submitted: ₹' || NEW.refund_amount::text || ' (' || NEW.condition_tier::text || ')',
      jsonb_build_object('rental_id', NEW.rental_id, 'store_id', NEW.store_id,
                         'deposit', NEW.deposit_amount, 'refund_amount', NEW.refund_amount,
                         'tier', NEW.condition_tier)
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_admin_event(
      'deposit_refund', NEW.id, 'refund_' || NEW.status::text, NEW.customer_id,
      'Refund ' || OLD.status::text || ' → ' || NEW.status::text || ' (₹' || NEW.refund_amount::text || ')',
      jsonb_build_object('rental_id', NEW.rental_id, 'store_id', NEW.store_id,
                         'from', OLD.status, 'to', NEW.status,
                         'refund_amount', NEW.refund_amount)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_deposit_refunds ON public.deposit_refunds;
CREATE TRIGGER audit_deposit_refunds
  AFTER INSERT OR UPDATE ON public.deposit_refunds
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_deposit_refund();
