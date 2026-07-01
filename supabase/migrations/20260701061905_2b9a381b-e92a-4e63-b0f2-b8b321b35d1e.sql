-- 1. Extend the product_category enum with future categories (idempotent)
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'accessory';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'footwear';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'bag';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'watch';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'beauty';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'electronics';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'camera';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'musical_instrument';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'furniture';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'home_decor';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'sports';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'baby';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'toys';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'books';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'other';

-- 2. Config table (slug is text, not enum, so the config table itself doesn't
--    depend on the enum being committed and can be edited freely)
CREATE TABLE IF NOT EXISTS public.product_categories (
  slug text PRIMARY KEY,
  label text NOT NULL,
  description text,
  icon_name text NOT NULL DEFAULT 'Package',
  gradient text NOT NULL DEFAULT 'from-slate-300 via-slate-400 to-slate-500',
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT false,
  launched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active categories" ON public.product_categories;
CREATE POLICY "Anyone can view active categories"
  ON public.product_categories FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage categories" ON public.product_categories;
CREATE POLICY "Admins manage categories"
  ON public.product_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_product_categories_updated_at ON public.product_categories;
CREATE TRIGGER trg_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Seed catalog (Dresses + Jewellery active; rest hidden until admin flips them on)
INSERT INTO public.product_categories (slug, label, description, icon_name, gradient, sort_order, is_active, launched_at) VALUES
  ('dress',               'Dresses',             'Ethnic wear, gowns, sarees & lehengas',        'Shirt',        'from-rose-300 via-pink-500 to-fuchsia-500',    10,  true,  now()),
  ('jewellery',           'Jewellery',           'Necklaces, earrings, bangles & sets',           'Gem',          'from-amber-300 via-yellow-500 to-orange-500',  20,  true,  now()),
  ('accessory',           'Accessories',         'Belts, scarves, hair & fashion accessories',    'Sparkles',     'from-purple-300 via-violet-500 to-indigo-500', 30,  false, NULL),
  ('footwear',            'Footwear',            'Heels, sneakers, ethnic & formal shoes',        'Footprints',   'from-red-300 via-rose-500 to-pink-500',        40,  false, NULL),
  ('bag',                 'Bags',                'Handbags, clutches, backpacks & luggage',       'ShoppingBag',  'from-emerald-300 via-teal-500 to-cyan-500',    50,  false, NULL),
  ('watch',               'Watches',             'Analog, digital & luxury timepieces',           'Watch',        'from-slate-300 via-slate-500 to-slate-700',    60,  false, NULL),
  ('beauty',              'Beauty',              'Makeup, skincare & personal care',              'Palette',      'from-pink-300 via-rose-500 to-red-500',        70,  false, NULL),
  ('electronics',         'Electronics',         'Phones, laptops, audio & smart devices',        'Smartphone',   'from-blue-300 via-indigo-500 to-purple-500',   80,  false, NULL),
  ('camera',              'Cameras',             'DSLRs, mirrorless, action cams & lenses',       'Camera',       'from-zinc-300 via-zinc-500 to-neutral-700',    90,  false, NULL),
  ('musical_instrument',  'Musical Instruments', 'Guitars, keyboards, drums & studio gear',       'Music',        'from-amber-300 via-orange-500 to-red-500',    100,  false, NULL),
  ('furniture',           'Furniture',           'Sofas, tables, beds & event furniture',         'Sofa',         'from-yellow-300 via-amber-500 to-orange-600', 110,  false, NULL),
  ('home_decor',          'Home Decor',          'Lighting, art, rugs & decor accents',           'Lamp',         'from-orange-300 via-amber-500 to-yellow-500', 120,  false, NULL),
  ('sports',              'Sports Equipment',    'Fitness, outdoor & team sports gear',           'Dumbbell',     'from-lime-300 via-green-500 to-emerald-600',  130,  false, NULL),
  ('baby',                'Baby Products',       'Strollers, cribs, baby care & toys',            'Baby',         'from-sky-300 via-blue-400 to-indigo-500',     140,  false, NULL),
  ('toys',                'Toys & Games',        'Kids toys, board games & hobby kits',           'Gamepad2',     'from-fuchsia-300 via-pink-500 to-rose-500',   150,  false, NULL),
  ('books',               'Books',               'Fiction, academic & rare editions',             'BookOpen',     'from-teal-300 via-emerald-500 to-green-600',  160,  false, NULL),
  ('other',               'Other',               'Miscellaneous listings',                        'Package',      'from-slate-300 via-slate-400 to-slate-500',   999,  false, NULL)
ON CONFLICT (slug) DO NOTHING;

-- 4. Ensure category_commissions has a default row for every category
-- (default 10% — matches platform_settings.commission_percent default)
INSERT INTO public.category_commissions (category, commission_percent)
SELECT slug::public.product_category, 10
FROM public.product_categories
WHERE slug IN ('dress','jewellery')  -- only insert for enum values already usable in this tx
ON CONFLICT (category) DO NOTHING;

-- Helper RPC for the client — returns active categories in one round trip.
CREATE OR REPLACE FUNCTION public.get_active_categories()
RETURNS SETOF public.product_categories
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.product_categories
  WHERE is_active = true
  ORDER BY sort_order, label;
$$;

REVOKE ALL ON FUNCTION public.get_active_categories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_categories() TO anon, authenticated;