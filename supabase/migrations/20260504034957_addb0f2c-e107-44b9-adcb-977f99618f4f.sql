
-- ============ PRODUCTS: new fields ============
DO $$ BEGIN
  CREATE TYPE public.product_purpose AS ENUM ('rent', 'buy', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS actual_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_flat numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS purpose public.product_purpose NOT NULL DEFAULT 'rent';

-- ============ RENTALS: support buy + price breakdown ============
DO $$ BEGIN
  CREATE TYPE public.order_kind AS ENUM ('rent', 'buy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS kind public.order_kind NOT NULL DEFAULT 'rent',
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.rentals ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE public.rentals ALTER COLUMN end_date DROP NOT NULL;
ALTER TABLE public.rentals ALTER COLUMN days DROP NOT NULL;
ALTER TABLE public.rentals ALTER COLUMN deposit SET DEFAULT 0;
ALTER TABLE public.rentals ALTER COLUMN rental_total SET DEFAULT 0;

-- ============ PLATFORM SETTINGS (singleton) ============
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  gst_percent numeric NOT NULL DEFAULT 18,
  delivery_fee numeric NOT NULL DEFAULT 50,
  commission_percent numeric NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views platform settings"
  ON public.platform_settings FOR SELECT USING (true);

CREATE POLICY "Admins insert platform settings"
  ON public.platform_settings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update platform settings"
  ON public.platform_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ CART ITEMS ============
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  kind public.order_kind NOT NULL DEFAULT 'rent',
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cart_items_user_idx ON public.cart_items(user_id);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cart"
  ON public.cart_items FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users add to own cart"
  ON public.cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own cart"
  ON public.cart_items FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own cart"
  ON public.cart_items FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
