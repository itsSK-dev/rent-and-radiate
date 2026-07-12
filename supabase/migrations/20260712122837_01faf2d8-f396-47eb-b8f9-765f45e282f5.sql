-- Backfill: ensure every existing profile has at least the 'customer' role
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'customer'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
)
ON CONFLICT (user_id, role) DO NOTHING;