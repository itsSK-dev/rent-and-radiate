
DO $$ BEGIN
  CREATE TYPE public.store_id_doc_type AS ENUM ('aadhaar','pan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.store_verification_status AS ENUM ('draft','submitted','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.store_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_license_number text,
  business_license_url text,
  gst_number text,
  gst_certificate_url text,
  id_type public.store_id_doc_type,
  id_number text,
  id_document_url text,
  shop_photos text[] NOT NULL DEFAULT '{}',
  bank_account_holder text,
  bank_account_number text,
  bank_ifsc text,
  bank_name text,
  status public.store_verification_status NOT NULL DEFAULT 'draft',
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.store_verifications TO authenticated;
GRANT ALL ON public.store_verifications TO service_role;

ALTER TABLE public.store_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own verification"
  ON public.store_verifications FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "Owner inserts own verification"
  ON public.store_verifications FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid()
              AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owner updates own verification"
  ON public.store_verifications FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND status IN ('draft','rejected','submitted'))
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admin manages verifications"
  ON public.store_verifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER tg_store_verifications_updated_at
  BEFORE UPDATE ON public.store_verifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_store_verification_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  is_admin boolean := public.has_role(auth.uid(),'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role')
                     OR current_user IN ('postgres','supabase_admin');
BEGIN
  IF is_service OR is_admin THEN RETURN NEW; END IF;
  IF NEW.status IN ('approved','rejected') AND OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Only admins can approve or reject verification submissions';
  END IF;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.rejection_reason := OLD.rejection_reason;
  IF NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted' THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER tg_guard_store_verification_updates
  BEFORE UPDATE ON public.store_verifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_store_verification_updates();

CREATE OR REPLACE FUNCTION public.tg_apply_store_verification_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
           is_verified = true, approved = true, rejection_reason = NULL, updated_at = now()
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
           is_verified = false, approved = false,
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
END $fn$;

CREATE TRIGGER tg_apply_store_verification_review
  BEFORE UPDATE ON public.store_verifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_store_verification_review();

-- Storage policies for the private verification-docs bucket (bucket created via API).
CREATE POLICY "Owner reads own verification docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs'
         AND (auth.uid()::text = (storage.foldername(name))[1]
              OR public.has_role(auth.uid(),'admin'::public.app_role)));

CREATE POLICY "Owner uploads own verification docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs'
              AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner updates own verification docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'verification-docs'
         AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner deletes own verification docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verification-docs'
         AND auth.uid()::text = (storage.foldername(name))[1]);
