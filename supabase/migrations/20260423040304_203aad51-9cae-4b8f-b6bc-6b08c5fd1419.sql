DROP POLICY IF EXISTS "Users self-assign customer role" ON public.user_roles;
CREATE POLICY "Users self-assign customer or store_owner" ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role IN ('customer','store_owner'));