-- Support contact settings (single-row table) used to populate dispute email templates
CREATE TABLE public.support_contact (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  email TEXT,
  phone TEXT,
  link_url TEXT,
  link_label TEXT,
  hours TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT support_contact_singleton CHECK (id = true)
);

ALTER TABLE public.support_contact ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can read — needed so emails/previews can render
CREATE POLICY "Anyone views support contact"
ON public.support_contact
FOR SELECT
USING (true);

-- Only admins can insert/update
CREATE POLICY "Admins insert support contact"
ON public.support_contact
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update support contact"
ON public.support_contact
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Updated-at trigger using existing helper
CREATE TRIGGER tg_support_contact_updated_at
BEFORE UPDATE ON public.support_contact
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed initial row so the UI always has something to edit
INSERT INTO public.support_contact (id, email, phone, link_url, link_label, hours)
VALUES (true, 'support@bloom.example', NULL, NULL, 'Help centre', 'Mon–Sat, 10am–7pm IST')
ON CONFLICT (id) DO NOTHING;