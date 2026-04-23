-- Enums
CREATE TYPE public.app_role AS ENUM ('customer','store_owner','admin');
CREATE TYPE public.product_category AS ENUM ('dress','jewellery');
CREATE TYPE public.rental_status AS ENUM ('pending','confirmed','delivered','returned','cancelled');
CREATE TYPE public.delivery_method AS ENUM ('delivery','pickup');
CREATE TYPE public.payment_status AS ENUM ('unpaid','paid','refunded','partial_refund');
CREATE TYPE public.image_stage AS ENUM ('before_delivery','at_delivery','after_return');
CREATE TYPE public.dispute_status AS ENUM ('open','reviewing','resolved','rejected');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  trust_score INT NOT NULL DEFAULT 100,
  blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Stores
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category public.product_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  price_per_day NUMERIC(10,2) NOT NULL CHECK (price_per_day >= 0),
  security_deposit NUMERIC(10,2) NOT NULL CHECK (security_deposit >= 0),
  size TEXT,
  color TEXT,
  condition_notes TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Rentals
CREATE TABLE public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INT NOT NULL,
  rental_total NUMERIC(10,2) NOT NULL,
  deposit NUMERIC(10,2) NOT NULL,
  grand_total NUMERIC(10,2) NOT NULL,
  status public.rental_status NOT NULL DEFAULT 'pending',
  delivery_method public.delivery_method NOT NULL DEFAULT 'pickup',
  address TEXT,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  refund_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

-- Rental proof images
CREATE TABLE public.rental_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  stage public.image_stage NOT NULL,
  image_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rental_images ENABLE ROW LEVEL SECURITY;

-- Ratings
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Disputes
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status public.dispute_status NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Helper: is this user the owner of the store linked to a rental
CREATE OR REPLACE FUNCTION public.is_store_owner_of_rental(_user_id UUID, _rental_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rentals r
    JOIN public.stores s ON s.id = r.store_id
    WHERE r.id = _rental_id AND s.owner_id = _user_id
  )
$$;

-- RLS: profiles
CREATE POLICY "Profiles viewable by self or admin" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS: user_roles
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users self-assign customer role" ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'customer');

-- RLS: stores
CREATE POLICY "Anyone views approved stores" ON public.stores FOR SELECT
  USING (approved = true OR owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners create their store" ON public.stores FOR INSERT
  WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(),'store_owner'));
CREATE POLICY "Owners update their store" ON public.stores FOR UPDATE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete stores" ON public.stores FOR DELETE
  USING (public.has_role(auth.uid(),'admin'));

-- RLS: products
CREATE POLICY "Anyone views products of approved stores" ON public.products FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND (s.approved OR s.owner_id = auth.uid()))
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "Store owners manage their products" ON public.products FOR ALL
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

-- RLS: rentals
CREATE POLICY "Customers see own rentals" ON public.rentals FOR SELECT
  USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "Customers create rentals" ON public.rentals FOR INSERT
  WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customer or store updates rental" ON public.rentals FOR UPDATE
  USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

-- RLS: rental_images
CREATE POLICY "Parties see rental images" ON public.rental_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND (
        r.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = r.store_id AND s.owner_id = auth.uid())
      )
    ) OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "Parties upload rental images" ON public.rental_images FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND r.customer_id = auth.uid())
      OR public.is_store_owner_of_rental(auth.uid(), rental_id)
      OR public.has_role(auth.uid(),'admin')
    )
  );

-- RLS: ratings
CREATE POLICY "Anyone views ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Users create ratings for their rentals" ON public.ratings FOR INSERT
  WITH CHECK (
    auth.uid() = rater_id AND
    EXISTS (
      SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND (
        r.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = r.store_id AND s.owner_id = auth.uid())
      )
    )
  );

-- RLS: disputes
CREATE POLICY "Parties view disputes" ON public.disputes FOR SELECT
  USING (
    opened_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND (
        r.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = r.store_id AND s.owner_id = auth.uid())
      )
    )
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "Parties open disputes" ON public.disputes FOR INSERT
  WITH CHECK (
    opened_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND (
        r.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = r.store_id AND s.owner_id = auth.uid())
      )
    )
  );
CREATE POLICY "Admins resolve disputes" ON public.disputes FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_stores BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_rentals BEFORE UPDATE ON public.rentals FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_disputes BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- New user trigger: profile + default customer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'customer'));
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('product-images','product-images',true),
  ('store-logos','store-logos',true),
  ('rental-proofs','rental-proofs',true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Owners upload product images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owners update own product images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.uid() = owner);
CREATE POLICY "Owners delete own product images" ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid() = owner);

CREATE POLICY "Public read store logos" ON storage.objects FOR SELECT USING (bucket_id = 'store-logos');
CREATE POLICY "Auth upload store logos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'store-logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owners update store logos" ON storage.objects FOR UPDATE
  USING (bucket_id = 'store-logos' AND auth.uid() = owner);

CREATE POLICY "Public read rental proofs" ON storage.objects FOR SELECT USING (bucket_id = 'rental-proofs');
CREATE POLICY "Auth upload rental proofs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'rental-proofs' AND auth.uid() IS NOT NULL);