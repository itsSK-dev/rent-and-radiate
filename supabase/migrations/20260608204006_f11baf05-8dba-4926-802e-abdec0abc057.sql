
-- ============= ENUMS =============
CREATE TYPE public.notification_type AS ENUM (
  'new_product','discount','back_in_stock','order_update','rental_update','promo','admin_broadcast'
);
CREATE TYPE public.campaign_audience AS ENUM ('all','selected','city','category');
CREATE TYPE public.campaign_status AS ENUM ('draft','scheduled','sending','sent','failed');

-- ============= notification_preferences =============
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_products boolean NOT NULL DEFAULT true,
  discounts_offers boolean NOT NULL DEFAULT true,
  order_updates boolean NOT NULL DEFAULT true,
  rental_updates boolean NOT NULL DEFAULT true,
  promotional boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON public.notification_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_updated_at_prefs BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============= notifications =============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  link_url text,
  image_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, is_read, created_at DESC) WHERE is_deleted = false;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all notifications" ON public.notifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============= notification_campaigns =============
CREATE TABLE public.notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  link_url text,
  image_url text,
  type public.notification_type NOT NULL DEFAULT 'admin_broadcast',
  audience_type public.campaign_audience NOT NULL DEFAULT 'all',
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  recipient_count int NOT NULL DEFAULT 0,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_campaigns TO authenticated;
GRANT ALL ON public.notification_campaigns TO service_role;
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage campaigns" ON public.notification_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER set_updated_at_campaigns BEFORE UPDATE ON public.notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.notification_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.notification_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ncr_campaign_idx ON public.notification_campaign_recipients(campaign_id);
GRANT SELECT ON public.notification_campaign_recipients TO authenticated;
GRANT ALL ON public.notification_campaign_recipients TO service_role;
ALTER TABLE public.notification_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view recipients" ON public.notification_campaign_recipients
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));

-- ============= wishlists =============
CREATE TABLE public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX wishlists_product_idx ON public.wishlists(product_id);
GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wishlist" ON public.wishlists
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= helper: create notification (bypasses RLS via SECURITY DEFINER) =============
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid, _type public.notification_type, _title text,
  _body text DEFAULT NULL, _link_url text DEFAULT NULL,
  _image_url text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.notifications(user_id,type,title,body,link_url,image_url,metadata)
  VALUES (_user_id,_type,_title,_body,_link_url,_image_url,COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- ============= handle_new_user: also seed prefs =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer'::public.app_role);
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

-- backfill prefs for existing users
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users ON CONFLICT DO NOTHING;

-- ============= trigger: new product fan-out =============
CREATE OR REPLACE FUNCTION public.tg_notify_new_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE store_name text; img text;
BEGIN
  SELECT name INTO store_name FROM public.stores WHERE id = NEW.store_id;
  img := CASE WHEN array_length(NEW.images,1) > 0 THEN NEW.images[1] ELSE NULL END;
  INSERT INTO public.notifications(user_id,type,title,body,link_url,image_url,metadata)
  SELECT p.user_id, 'new_product'::public.notification_type,
         'New Arrival: ' || NEW.title,
         COALESCE(store_name,'A store') || ' just added a new item. Check it out!',
         '/products/' || NEW.id::text, img,
         jsonb_build_object('product_id',NEW.id,'store_id',NEW.store_id)
  FROM public.notification_preferences p
  WHERE p.new_products = true
    AND p.user_id <> (SELECT owner_id FROM public.stores WHERE id = NEW.store_id);
  RETURN NEW;
END $$;
CREATE TRIGGER notify_on_new_product AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_product();

-- ============= trigger: discount increase =============
CREATE OR REPLACE FUNCTION public.tg_notify_discount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE img text;
BEGIN
  IF NEW.discount_percent IS NULL OR NEW.discount_percent <= COALESCE(OLD.discount_percent,0) THEN
    RETURN NEW;
  END IF;
  IF NEW.discount_percent < 10 THEN RETURN NEW; END IF;
  img := CASE WHEN array_length(NEW.images,1) > 0 THEN NEW.images[1] ELSE NULL END;
  INSERT INTO public.notifications(user_id,type,title,body,link_url,image_url,metadata)
  SELECT p.user_id, 'discount'::public.notification_type,
         'Flash Sale: Get ' || NEW.discount_percent || '% off ' || NEW.title,
         'Limited time offer — grab it before it''s gone!',
         '/products/' || NEW.id::text, img,
         jsonb_build_object('product_id',NEW.id,'discount_percent',NEW.discount_percent)
  FROM public.notification_preferences p
  WHERE p.discounts_offers = true;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_on_discount AFTER UPDATE OF discount_percent ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_discount();

-- ============= trigger: back in stock (available false -> true) =============
CREATE OR REPLACE FUNCTION public.tg_notify_back_in_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE img text;
BEGIN
  IF NOT (OLD.available = false AND NEW.available = true) THEN RETURN NEW; END IF;
  img := CASE WHEN array_length(NEW.images,1) > 0 THEN NEW.images[1] ELSE NULL END;
  INSERT INTO public.notifications(user_id,type,title,body,link_url,image_url,metadata)
  SELECT w.user_id, 'back_in_stock'::public.notification_type,
         'Back in Stock: ' || NEW.title,
         'An item on your wishlist is available again.',
         '/products/' || NEW.id::text, img,
         jsonb_build_object('product_id',NEW.id)
  FROM public.wishlists w
  JOIN public.notification_preferences p ON p.user_id = w.user_id
  WHERE w.product_id = NEW.id AND p.new_products = true;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_on_back_in_stock AFTER UPDATE OF available ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_back_in_stock();

-- ============= trigger: rental status change =============
CREATE OR REPLACE FUNCTION public.tg_notify_rental_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  product_title text; img text; want_order bool; want_rental bool;
  title_txt text; body_txt text; ntype public.notification_type;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT title, CASE WHEN array_length(images,1)>0 THEN images[1] ELSE NULL END
    INTO product_title, img FROM public.products WHERE id = NEW.product_id;
  SELECT order_updates, rental_updates INTO want_order, want_rental
    FROM public.notification_preferences WHERE user_id = NEW.customer_id;

  IF NEW.kind = 'buy' THEN
    ntype := 'order_update';
    IF COALESCE(want_order, true) = false THEN RETURN NEW; END IF;
    title_txt := CASE NEW.status::text
      WHEN 'pending' THEN 'Order received'
      WHEN 'confirmed' THEN 'Order Confirmed'
      WHEN 'delivered' THEN 'Order Delivered'
      WHEN 'returned' THEN 'Order Returned'
      WHEN 'cancelled' THEN 'Order Cancelled'
      ELSE 'Order ' || NEW.status::text END;
  ELSE
    ntype := 'rental_update';
    IF COALESCE(want_rental, true) = false THEN RETURN NEW; END IF;
    title_txt := CASE NEW.status::text
      WHEN 'pending' THEN 'Rental request received'
      WHEN 'confirmed' THEN 'Rental Approved'
      WHEN 'delivered' THEN 'Pickup / delivery completed'
      WHEN 'returned' THEN 'Return Completed'
      WHEN 'cancelled' THEN 'Rental Cancelled'
      ELSE 'Rental ' || NEW.status::text END;
  END IF;
  body_txt := COALESCE(product_title,'Your order') || ' — status: ' || NEW.status::text;
  INSERT INTO public.notifications(user_id,type,title,body,link_url,image_url,metadata)
  VALUES (NEW.customer_id, ntype, title_txt, body_txt,
          '/my-rentals', img,
          jsonb_build_object('rental_id',NEW.id,'status',NEW.status));
  RETURN NEW;
END $$;
CREATE TRIGGER notify_on_rental_status AFTER INSERT OR UPDATE OF status ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_rental_status();
