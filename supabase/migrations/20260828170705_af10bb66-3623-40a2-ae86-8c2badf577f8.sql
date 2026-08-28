CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _severity text,
  _summary text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _actor_user_id uuid DEFAULT NULL,
  _actor_email text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_service boolean := (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role';
  _jwt_email text := (current_setting('request.jwt.claims', true)::jsonb ->> 'email');
  _recent int;
  _new_id uuid;
  _effective_actor uuid;
  _effective_severity text := _severity;
  _effective_email text;
  _effective_ip text;
  -- Client-reportable event types (fixed, server-known list)
  _allowed_types text[] := ARRAY[
    'auth_failed_login',
    'auth_repeated_failed_login',
    'auth_password_reset_requested',
    'auth_signout_all',
    'client_error',
    'suspicious_client_activity'
  ];
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

  IF _is_service THEN
    _effective_actor := COALESCE(_actor_user_id, _uid);
    _effective_email := _actor_email;
    _effective_ip := _ip;
  ELSE
    -- Untrusted (anonymous or signed-in) callers:
    -- 1. only a fixed set of event types is accepted
    IF NOT (_event_type = ANY (_allowed_types)) THEN
      RAISE EXCEPTION 'event_type not allowed';
    END IF;

    -- 2. severity is clamped so client input can never trigger admin alert emails
    IF _effective_severity IN ('high','critical') THEN
      _effective_severity := 'medium';
    END IF;

    -- 3. rate limit applies to anonymous callers too
    IF _uid IS NOT NULL THEN
      SELECT count(*) INTO _recent
      FROM public.security_events
      WHERE actor_user_id = _uid
        AND created_at > now() - interval '1 minute';
      IF _recent >= 30 THEN
        RAISE EXCEPTION 'security event rate limit exceeded';
      END IF;
    ELSE
      SELECT count(*) INTO _recent
      FROM public.security_events
      WHERE actor_user_id IS NULL
        AND created_at > now() - interval '1 minute';
      IF _recent >= 20 THEN
        RAISE EXCEPTION 'security event rate limit exceeded';
      END IF;
    END IF;

    -- 4. identity fields are server-derived, never client-supplied
    _effective_actor := _uid;
    _effective_email := _jwt_email;
    _effective_ip := NULL;
    _metadata := COALESCE(_metadata, '{}'::jsonb) || jsonb_build_object('client_reported', true);
  END IF;

  INSERT INTO public.security_events (
    event_type, severity, actor_user_id, actor_email, ip, user_agent, summary, metadata
  ) VALUES (
    _event_type, _effective_severity, _effective_actor, _effective_email, _effective_ip,
    left(COALESCE(_user_agent, ''), 300), _summary,
    COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;