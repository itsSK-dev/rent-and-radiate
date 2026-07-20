
-- 1. Table
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  actor_user_id uuid,
  actor_email text,
  ip text,
  user_agent text,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  notified_at timestamptz,
  notification_status text
);

CREATE INDEX IF NOT EXISTS security_events_created_idx ON public.security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_type_idx ON public.security_events (event_type);
CREATE INDEX IF NOT EXISTS security_events_severity_idx ON public.security_events (severity);
CREATE INDEX IF NOT EXISTS security_events_actor_idx ON public.security_events (actor_user_id);

GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view security events" ON public.security_events;
CREATE POLICY "Admins can view security events"
ON public.security_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update security events" ON public.security_events;
CREATE POLICY "Admins can update security events"
ON public.security_events FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Safe logger RPC (SECURITY DEFINER, with rate limit)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _severity text,
  _summary text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _actor_user_id uuid DEFAULT NULL,
  _actor_email text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_service boolean := (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role';
  _recent int;
  _new_id uuid;
  _effective_actor uuid;
BEGIN
  IF _severity NOT IN ('info','low','medium','high','critical') THEN
    RAISE EXCEPTION 'invalid severity';
  END IF;
  IF _event_type IS NULL OR length(_event_type) = 0 OR length(_event_type) > 80 THEN
    RAISE EXCEPTION 'invalid event_type';
  END IF;
  IF _summary IS NOT NULL AND length(_summary) > 500 THEN
    _summary := left(_summary, 500);
  END IF;

  -- Rate limit: 30 events / minute per authenticated caller (service role bypasses)
  IF NOT _is_service AND _uid IS NOT NULL THEN
    SELECT count(*) INTO _recent
    FROM public.security_events
    WHERE actor_user_id = _uid
      AND created_at > now() - interval '1 minute';
    IF _recent >= 30 THEN
      RAISE EXCEPTION 'security event rate limit exceeded';
    END IF;
  END IF;

  -- Non-service callers can only attribute events to themselves
  _effective_actor := CASE WHEN _is_service THEN COALESCE(_actor_user_id, _uid) ELSE _uid END;

  INSERT INTO public.security_events (
    event_type, severity, actor_user_id, actor_email, ip, user_agent, summary, metadata
  ) VALUES (
    _event_type, _severity, _effective_actor, _actor_email, _ip, _user_agent, _summary,
    COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(text,text,text,jsonb,uuid,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_security_event(text,text,text,jsonb,uuid,text,text,text) TO authenticated, anon, service_role;

-- 3. Auto-detect payment anomalies from payment_verification_attempts
CREATE OR REPLACE FUNCTION public.detect_payment_security_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.outcome IN ('invalid_signature','order_id_mismatch','forbidden') THEN
    INSERT INTO public.security_events (event_type, severity, actor_user_id, ip, user_agent, summary, metadata)
    VALUES (
      'payment_' || NEW.outcome,
      'high',
      NEW.user_id,
      NEW.ip,
      NEW.user_agent,
      COALESCE(NEW.reason, 'Payment verification anomaly'),
      jsonb_build_object(
        'rental_id', NEW.rental_id,
        'razorpay_order_id', NEW.razorpay_order_id,
        'razorpay_payment_id', NEW.razorpay_payment_id,
        'amount', NEW.amount,
        'outcome', NEW.outcome
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_payment_security_event ON public.payment_verification_attempts;
CREATE TRIGGER trg_detect_payment_security_event
AFTER INSERT ON public.payment_verification_attempts
FOR EACH ROW EXECUTE FUNCTION public.detect_payment_security_event();

-- 4. Auto-record from fraud_alerts
CREATE OR REPLACE FUNCTION public.detect_fraud_alert_security_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_events (event_type, severity, actor_user_id, summary, metadata)
  VALUES (
    'fraud_alert',
    CASE WHEN COALESCE(NEW.severity, 'medium') IN ('high','critical') THEN NEW.severity ELSE 'medium' END,
    NEW.user_id,
    COALESCE(NEW.description, NEW.alert_type, 'Fraud alert raised'),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_fraud_alert_security_event ON public.fraud_alerts;
CREATE TRIGGER trg_detect_fraud_alert_security_event
AFTER INSERT ON public.fraud_alerts
FOR EACH ROW EXECUTE FUNCTION public.detect_fraud_alert_security_event();

-- 5. pg_net dispatch to alert-security-event edge function on high/critical
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.dispatch_security_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _url text;
  _key text;
BEGIN
  IF NEW.severity NOT IN ('high','critical') THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
    SELECT decrypted_secret INTO _key
    FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    _url := NULL;
  END;

  IF _url IS NULL OR _key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _url || '/functions/v1/alert-security-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body := jsonb_build_object('event_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_security_alert ON public.security_events;
CREATE TRIGGER trg_dispatch_security_alert
AFTER INSERT ON public.security_events
FOR EACH ROW EXECUTE FUNCTION public.dispatch_security_alert();
