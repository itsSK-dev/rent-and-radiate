
-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.ad_tier AS ENUM ('basic','premium','featured');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_type AS ENUM ('banner','featured_listing','sponsored_product','homepage_promotion','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_request_status AS ENUM ('draft','pending','changes_requested','approved','rejected','active','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_payment_status AS ENUM ('unpaid','paid','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AD PACKAGES
CREATE TABLE IF NOT EXISTS public.ad_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier public.ad_tier NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  duration_days integer NOT NULL DEFAULT 7,
  perks text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_packages TO authenticated;
GRANT ALL ON public.ad_packages TO service_role;
ALTER TABLE public.ad_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views active packages" ON public.ad_packages FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins manage packages" ON public.ad_packages FOR ALL USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_ad_packages_updated BEFORE UPDATE ON public.ad_packages FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- PLATFORM STATS (single row)
CREATE TABLE IF NOT EXISTS public.ad_platform_stats (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  users_count integer NOT NULL DEFAULT 10000,
  monthly_views integer NOT NULL DEFAULT 50000,
  engagement_pct numeric NOT NULL DEFAULT 18,
  reach_count integer NOT NULL DEFAULT 100000,
  partners_count integer NOT NULL DEFAULT 25,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_platform_stats TO anon;
GRANT SELECT, INSERT, UPDATE ON public.ad_platform_stats TO authenticated;
GRANT ALL ON public.ad_platform_stats TO service_role;
ALTER TABLE public.ad_platform_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views ad stats" ON public.ad_platform_stats FOR SELECT USING (true);
CREATE POLICY "Admins insert ad stats" ON public.ad_platform_stats FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins update ad stats" ON public.ad_platform_stats FOR UPDATE USING (public.has_role(auth.uid(),'admin'::public.app_role));
INSERT INTO public.ad_platform_stats (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ADVERTISEMENT REQUESTS
CREATE TABLE IF NOT EXISTS public.advertisement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL,
  company_name text NOT NULL,
  contact_person text NOT NULL,
  email text NOT NULL,
  mobile text NOT NULL,
  website text,
  ad_type public.ad_type NOT NULL,
  duration_days integer NOT NULL DEFAULT 7,
  budget numeric NOT NULL DEFAULT 0,
  description text,
  logo_url text,
  creative_url text,
  package_id uuid REFERENCES public.ad_packages(id) ON DELETE SET NULL,
  status public.ad_request_status NOT NULL DEFAULT 'draft',
  admin_notes text,
  set_price numeric,
  payment_status public.ad_payment_status NOT NULL DEFAULT 'unpaid',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.advertisement_requests TO authenticated;
GRANT ALL ON public.advertisement_requests TO service_role;
ALTER TABLE public.advertisement_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advertiser views own requests" ON public.advertisement_requests FOR SELECT TO authenticated
  USING (advertiser_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Advertiser creates own request" ON public.advertisement_requests FOR INSERT TO authenticated
  WITH CHECK (advertiser_id = auth.uid());
CREATE POLICY "Advertiser updates own draft" ON public.advertisement_requests FOR UPDATE TO authenticated
  USING ((advertiser_id = auth.uid() AND status IN ('draft','changes_requested')) OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK ((advertiser_id = auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_ad_req_updated BEFORE UPDATE ON public.advertisement_requests FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.ad_request_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.advertisement_requests(id) ON DELETE CASCADE,
  from_status public.ad_request_status,
  to_status public.ad_request_status NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_request_status_history TO authenticated;
GRANT ALL ON public.ad_request_status_history TO service_role;
ALTER TABLE public.ad_request_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties view ad request history" ON public.ad_request_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.advertisement_requests r WHERE r.id = ad_request_status_history.request_id AND (r.advertiser_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));

CREATE OR REPLACE FUNCTION public.log_ad_request_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ad_request_status_history (request_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, NEW.advertiser_id, 'Request created');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ad_request_status_history (request_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NEW.admin_notes);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ad_req_status AFTER INSERT OR UPDATE ON public.advertisement_requests
FOR EACH ROW EXECUTE FUNCTION public.log_ad_request_status_change();

-- LIVE ADVERTISEMENTS
CREATE TABLE IF NOT EXISTS public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.advertisement_requests(id) ON DELETE SET NULL,
  headline text NOT NULL,
  image_url text NOT NULL,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.advertisements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO service_role;
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views active advertisements" ON public.advertisements FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins manage advertisements" ON public.advertisements FOR ALL USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_advertisements_updated BEFORE UPDATE ON public.advertisements FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed default packages
INSERT INTO public.ad_packages (name, tier, price, duration_days, perks, sort_order) VALUES
  ('Basic', 'basic', 2999, 7, ARRAY['Sidebar placement','7-day campaign','Basic analytics'], 1),
  ('Premium', 'premium', 7999, 14, ARRAY['Homepage banner','14-day campaign','Priority support','Detailed analytics'], 2),
  ('Featured', 'featured', 19999, 30, ARRAY['Top-of-feed placement','30-day campaign','Social mentions','Dedicated account manager','Advanced analytics'], 3)
ON CONFLICT DO NOTHING;
