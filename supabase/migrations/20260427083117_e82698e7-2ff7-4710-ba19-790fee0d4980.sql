CREATE TABLE public.test_email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_role TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT NOT NULL,
  message TEXT,
  infra_ready BOOLEAN NOT NULL DEFAULT false,
  triggered_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.test_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view test email log"
ON public.test_email_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert test email log"
ON public.test_email_log
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_test_email_log_created_at ON public.test_email_log (created_at DESC);