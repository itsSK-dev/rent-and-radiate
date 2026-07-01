
-- Ensure all 17 categories exist and are visible to everyone (inactive ones show as "Coming soon")
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

-- Allow everyone (including anon) to read the full catalog so "Coming soon" categories render for all visitors.
-- Inactive rows are informational only; write access remains admin-only.
DROP POLICY IF EXISTS "Public reads active categories" ON public.product_categories;
DROP POLICY IF EXISTS "Anyone can read categories" ON public.product_categories;
CREATE POLICY "Anyone can read categories"
  ON public.product_categories FOR SELECT
  USING (true);

GRANT SELECT ON public.product_categories TO anon, authenticated;
