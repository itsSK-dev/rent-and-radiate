-- Fix function search_path
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;

-- Replace overly broad SELECT policies on storage.objects so listing requires being the owner
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Public read store logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read rental proofs" ON storage.objects;

-- Files are still publicly accessible via the public URL because the buckets are public.
-- These SELECT policies only control listing via the API, restricted to file owners or admins.
CREATE POLICY "Owners list own product images" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images' AND (auth.uid() = owner OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Owners list own store logos" ON storage.objects FOR SELECT
  USING (bucket_id = 'store-logos' AND (auth.uid() = owner OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Parties list rental proofs" ON storage.objects FOR SELECT
  USING (bucket_id = 'rental-proofs' AND (auth.uid() = owner OR public.has_role(auth.uid(),'admin')));

-- Seed: a couple of demo stores (owner_id null-safe via system uuid placeholder won't work — skip if no owner).
-- Instead seed with a stable demo owner using gen_random_uuid only if no stores exist.
DO $$
DECLARE demo_owner UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores) THEN
    demo_owner := '00000000-0000-0000-0000-000000000001';
    -- Insert stores without FK enforcement issues: skip if no auth.users; we use a soft demo by allowing approved listings only
    -- Use a real auth row if exists
    SELECT id INTO demo_owner FROM auth.users LIMIT 1;
    IF demo_owner IS NOT NULL THEN
      INSERT INTO public.stores (owner_id, name, description, city, address, lat, lng, rating, rating_count, approved) VALUES
        (demo_owner, 'Rosé Atelier', 'Curated couture gowns and lehengas for every celebration.', 'Mumbai', 'Bandra West, Mumbai', 19.0606, 72.8365, 4.8, 142, true),
        (demo_owner, 'Maison Aurum', 'Heirloom-quality jewellery, hand-set in 22k gold.', 'Delhi', 'Khan Market, New Delhi', 28.6005, 77.2273, 4.9, 211, true),
        (demo_owner, 'Velvet & Vine', 'Modern silhouettes meet classic Indian craft.', 'Bengaluru', 'Indiranagar, Bengaluru', 12.9784, 77.6408, 4.7, 88, true);
    END IF;
  END IF;
END $$;