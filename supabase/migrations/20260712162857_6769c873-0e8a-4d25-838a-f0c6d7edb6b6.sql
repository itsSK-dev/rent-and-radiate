
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delivery_partner';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'delivery_update';
ALTER TYPE public.rental_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE public.rental_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE public.rental_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.rental_status ADD VALUE IF NOT EXISTS 'return_scheduled';
ALTER TYPE public.rental_status ADD VALUE IF NOT EXISTS 'return_picked_up';
ALTER TYPE public.rental_status ADD VALUE IF NOT EXISTS 'completed';

DO $$ BEGIN CREATE TYPE public.delivery_partner_status AS ENUM ('pending','approved','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.delivery_vehicle_type AS ENUM ('bike','cycle','scooter','car');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.delivery_assignment_status AS ENUM (
  'broadcast','accepted','rejected','picked_up','out_for_delivery','delivered',
  'return_scheduled','return_picked_up','returned_to_store','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.delivery_otp_kind AS ENUM ('delivery','return');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.delivery_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL, mobile text NOT NULL, email text,
  date_of_birth date, gender text, profile_photo_url text,
  current_address text NOT NULL, permanent_address text,
  city text NOT NULL, state text NOT NULL, pin_code text NOT NULL,
  vehicle_type public.delivery_vehicle_type NOT NULL, vehicle_number text,
  has_experience boolean DEFAULT false, previous_company text, experience_duration text,
  additional_info text,
  emergency_contact_name text NOT NULL, emergency_contact_number text NOT NULL,
  bank_account text, upi_id text,
  status public.delivery_partner_status NOT NULL DEFAULT 'pending',
  rejection_reason text, is_online boolean NOT NULL DEFAULT false,
  approved_at timestamptz, approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_partners TO authenticated;
GRANT ALL ON public.delivery_partners TO service_role;
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner reads own" ON public.delivery_partners FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "partner inserts own" ON public.delivery_partners FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "partner updates own" ON public.delivery_partners FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_delivery_partners_updated_at BEFORE UPDATE ON public.delivery_partners
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_delivery_partner_updates() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  is_admin boolean := public.has_role(auth.uid(),'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role')
                     OR current_user IN ('postgres','supabase_admin');
BEGIN
  IF is_service OR is_admin THEN RETURN NEW; END IF;
  NEW.status := OLD.status; NEW.rejection_reason := OLD.rejection_reason;
  NEW.approved_at := OLD.approved_at; NEW.approved_by := OLD.approved_by;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_guard_delivery_partner_updates BEFORE UPDATE ON public.delivery_partners
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_partner_updates();

CREATE OR REPLACE FUNCTION public.tg_delivery_partner_role_on_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.user_id, 'delivery_partner'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    NEW.approved_at := now(); NEW.approved_by := auth.uid();
    INSERT INTO public.notifications(user_id,type,title,body,link_url)
    VALUES (NEW.user_id,'order_update'::public.notification_type,
      '✅ Delivery partner application approved',
      'You can now log in and start accepting deliveries.', '/delivery');
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    INSERT INTO public.notifications(user_id,type,title,body,link_url)
    VALUES (NEW.user_id,'order_update'::public.notification_type,
      '⚠️ Delivery partner application rejected',
      COALESCE(NEW.rejection_reason,'Please review and re-apply.'), '/delivery/register');
  ELSIF NEW.status = 'suspended' AND (OLD.status IS DISTINCT FROM 'suspended') THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'delivery_partner'::public.app_role;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_delivery_partner_role_on_approval BEFORE UPDATE ON public.delivery_partners
  FOR EACH ROW EXECUTE FUNCTION public.tg_delivery_partner_role_on_approval();

CREATE TABLE IF NOT EXISTS public.delivery_partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  doc_type text NOT NULL, file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.delivery_partner_documents TO authenticated;
GRANT ALL ON public.delivery_partner_documents TO service_role;
ALTER TABLE public.delivery_partner_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs read own or admin" ON public.delivery_partner_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role)
      OR EXISTS(SELECT 1 FROM public.delivery_partners dp WHERE dp.id = partner_id AND dp.user_id = auth.uid()));
CREATE POLICY "docs insert own" ON public.delivery_partner_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM public.delivery_partners dp WHERE dp.id = partner_id AND dp.user_id = auth.uid()));
CREATE POLICY "docs delete own or admin" ON public.delivery_partner_documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role)
      OR EXISTS(SELECT 1 FROM public.delivery_partners dp WHERE dp.id = partner_id AND dp.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.delivery_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE,
  partner_id uuid NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_earnings TO authenticated;
GRANT ALL ON public.delivery_earnings TO service_role;
ALTER TABLE public.delivery_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "earnings read own or admin" ON public.delivery_earnings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role)
      OR EXISTS(SELECT 1 FROM public.delivery_partners dp WHERE dp.id = partner_id AND dp.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  status public.delivery_assignment_status NOT NULL DEFAULT 'broadcast',
  accepted_at timestamptz, picked_up_at timestamptz, delivered_at timestamptz,
  return_picked_up_at timestamptz, returned_to_store_at timestamptz, cancelled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rental_id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_da_partner_status ON public.delivery_assignments(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_da_rental ON public.delivery_assignments(rental_id);
GRANT SELECT, INSERT, UPDATE ON public.delivery_assignments TO authenticated;
GRANT ALL ON public.delivery_assignments TO service_role;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments visibility" ON public.delivery_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role)
    OR EXISTS(SELECT 1 FROM public.delivery_partners dp WHERE dp.id = partner_id AND dp.user_id = auth.uid())
    OR EXISTS(SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND r.customer_id = auth.uid())
    OR EXISTS(SELECT 1 FROM public.rentals r JOIN public.stores s ON s.id = r.store_id WHERE r.id = rental_id AND s.owner_id = auth.uid()));
CREATE POLICY "assignments partner update" ON public.delivery_assignments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role)
    OR EXISTS(SELECT 1 FROM public.delivery_partners dp WHERE dp.id = partner_id AND dp.user_id = auth.uid()));
CREATE POLICY "assignments admin insert" ON public.delivery_assignments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_da_updated_at BEFORE UPDATE ON public.delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_delivery_assignment_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_customer uuid; v_store_owner uuid; v_partner_user uuid; v_product_title text;
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE public.delivery_assignments
      SET status = 'cancelled'::public.delivery_assignment_status, cancelled_at = now()
      WHERE rental_id = NEW.rental_id AND id <> NEW.id AND status = 'broadcast';
    NEW.accepted_at := COALESCE(NEW.accepted_at, now());
    UPDATE public.rentals SET status = 'assigned'::public.rental_status, assigned_partner_id = NEW.partner_id, updated_at = now()
      WHERE id = NEW.rental_id;
  END IF;
  IF NEW.status = 'picked_up' AND (OLD.status IS DISTINCT FROM 'picked_up') THEN
    NEW.picked_up_at := COALESCE(NEW.picked_up_at, now());
    UPDATE public.rentals SET status = 'out_for_delivery'::public.rental_status, updated_at = now()
      WHERE id = NEW.rental_id;
  END IF;
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
    UPDATE public.rentals SET status = 'delivered'::public.rental_status,
      actual_delivered_at = now(), updated_at = now() WHERE id = NEW.rental_id;
    INSERT INTO public.delivery_earnings(assignment_id, partner_id, rental_id, amount, status)
      VALUES (NEW.id, NEW.partner_id, NEW.rental_id, 50, 'pending')
      ON CONFLICT (assignment_id) DO NOTHING;
  END IF;
  IF NEW.status = 'returned_to_store' AND (OLD.status IS DISTINCT FROM 'returned_to_store') THEN
    NEW.returned_to_store_at := COALESCE(NEW.returned_to_store_at, now());
    UPDATE public.rentals SET status = 'returned'::public.rental_status,
      returned_at = now(), updated_at = now() WHERE id = NEW.rental_id;
  END IF;

  SELECT dp.user_id INTO v_partner_user FROM public.delivery_partners dp WHERE dp.id = NEW.partner_id;
  SELECT r.customer_id INTO v_customer FROM public.rentals r WHERE r.id = NEW.rental_id;
  SELECT s.owner_id INTO v_store_owner FROM public.rentals r JOIN public.stores s ON s.id = r.store_id WHERE r.id = NEW.rental_id;
  SELECT p.title INTO v_product_title FROM public.rentals r JOIN public.products p ON p.id = r.product_id WHERE r.id = NEW.rental_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'broadcast' AND v_partner_user IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,type,title,body,link_url,metadata)
    VALUES (v_partner_user, 'delivery_update'::public.notification_type,
      '🛵 New delivery available',
      'A new pickup near you: ' || COALESCE(v_product_title,'order'),
      '/delivery', jsonb_build_object('rental_id',NEW.rental_id,'assignment_id',NEW.id));
  END IF;
  IF TG_OP='UPDATE' AND NEW.status='accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    IF v_store_owner IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,type,title,body,link_url)
      VALUES (v_store_owner,'delivery_update'::public.notification_type,
        '🛵 Delivery partner assigned','A partner accepted your order.','/vendor/orders');
    END IF;
    IF v_customer IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,type,title,body,link_url)
      VALUES (v_customer,'delivery_update'::public.notification_type,
        '🛵 Delivery partner assigned','A partner is on the way to pick up your order.','/my-rentals');
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND NEW.status='delivered' AND OLD.status IS DISTINCT FROM 'delivered' AND v_customer IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,type,title,body,link_url)
    VALUES (v_customer,'delivery_update'::public.notification_type,
      '✅ Order delivered','Your order has been delivered successfully.','/my-rentals');
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_delivery_assignment_change BEFORE INSERT OR UPDATE ON public.delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_delivery_assignment_change();

CREATE TABLE IF NOT EXISTS public.delivery_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  kind public.delivery_otp_kind NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_rental_kind ON public.delivery_otps(rental_id, kind);
GRANT SELECT ON public.delivery_otps TO authenticated;
GRANT ALL ON public.delivery_otps TO service_role;
ALTER TABLE public.delivery_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "otp read own or admin" ON public.delivery_otps FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role)
      OR EXISTS(SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND r.customer_id = auth.uid()));

ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS assigned_partner_id uuid REFERENCES public.delivery_partners(id) ON DELETE SET NULL;
