-- 1. Saved address on profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS addr_full_name text,
  ADD COLUMN IF NOT EXISTS addr_mobile text,
  ADD COLUMN IF NOT EXISTS addr_house text,
  ADD COLUMN IF NOT EXISTS addr_street text,
  ADD COLUMN IF NOT EXISTS addr_landmark text,
  ADD COLUMN IF NOT EXISTS addr_city text,
  ADD COLUMN IF NOT EXISTS addr_state text,
  ADD COLUMN IF NOT EXISTS addr_pin text,
  ADD COLUMN IF NOT EXISTS addr_instructions text;

-- 2. Address snapshot on the order
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS ship_full_name text,
  ADD COLUMN IF NOT EXISTS ship_mobile text,
  ADD COLUMN IF NOT EXISTS ship_house text,
  ADD COLUMN IF NOT EXISTS ship_street text,
  ADD COLUMN IF NOT EXISTS ship_landmark text,
  ADD COLUMN IF NOT EXISTS ship_city text,
  ADD COLUMN IF NOT EXISTS ship_state text,
  ADD COLUMN IF NOT EXISTS ship_pin text,
  ADD COLUMN IF NOT EXISTS ship_instructions text;

-- 3. Backend enforcement: home-delivery orders cannot be marked paid without a complete address
CREATE OR REPLACE FUNCTION public.enforce_rental_shipping_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_method = 'delivery'::public.delivery_method
     AND NEW.payment_status IN ('paid'::public.payment_status, 'pending_verification'::public.payment_status)
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND (
       coalesce(btrim(NEW.ship_full_name), '') = '' OR
       coalesce(btrim(NEW.ship_mobile), '') = '' OR
       coalesce(btrim(NEW.ship_house), '') = '' OR
       coalesce(btrim(NEW.ship_street), '') = '' OR
       coalesce(btrim(NEW.ship_city), '') = '' OR
       coalesce(btrim(NEW.ship_state), '') = '' OR
       coalesce(btrim(NEW.ship_pin), '') = ''
     )
  THEN
    RAISE EXCEPTION 'A complete delivery address is required before this order can be paid.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_rental_shipping_address ON public.rentals;
CREATE TRIGGER trg_enforce_rental_shipping_address
BEFORE UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.enforce_rental_shipping_address();

-- 4. Shop owner / assigned partner can read the customer profile for their own orders
CREATE OR REPLACE FUNCTION public.can_view_customer_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rentals r
    JOIN public.stores s ON s.id = r.store_id
    WHERE r.customer_id = _profile_id AND s.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.rentals r
    JOIN public.delivery_assignments da ON da.rental_id = r.id
    JOIN public.delivery_partners dp ON dp.id = da.partner_id
    WHERE r.customer_id = _profile_id AND dp.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Order counterparties view customer profile" ON public.profiles;
CREATE POLICY "Order counterparties view customer profile"
ON public.profiles FOR SELECT
TO authenticated
USING (public.can_view_customer_profile(id));

-- 5. Shop owners can list approved, online delivery partners
CREATE OR REPLACE FUNCTION public.list_available_delivery_partners()
RETURNS TABLE(
  id uuid, full_name text, mobile text, city text,
  vehicle_type public.delivery_vehicle_type, is_online boolean,
  status public.delivery_partner_status, active_assignments bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dp.id, dp.full_name, dp.mobile, dp.city, dp.vehicle_type, dp.is_online, dp.status,
         (SELECT count(*) FROM public.delivery_assignments da
           WHERE da.partner_id = dp.id
             AND da.status IN ('accepted','picked_up','out_for_delivery','return_scheduled','return_picked_up'))
  FROM public.delivery_partners dp
  WHERE dp.status = 'approved'
    AND (
      EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  ORDER BY dp.is_online DESC, dp.full_name;
$$;

-- 6. Shop owner assigns a delivery partner to their own order
CREATE OR REPLACE FUNCTION public.assign_delivery_partner(_rental_id uuid, _partner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_partner_user uuid;
  v_assignment uuid;
BEGIN
  SELECT s.owner_id INTO v_owner
    FROM public.rentals r JOIN public.stores s ON s.id = r.store_id
   WHERE r.id = _rental_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed to assign a partner to this order';
  END IF;

  SELECT dp.user_id INTO v_partner_user
    FROM public.delivery_partners dp
   WHERE dp.id = _partner_id AND dp.status = 'approved';
  IF v_partner_user IS NULL THEN
    RAISE EXCEPTION 'Delivery partner is not approved';
  END IF;

  -- Withdraw other pending broadcasts for this order so the assignment is directed
  UPDATE public.delivery_assignments
     SET status = 'cancelled', cancelled_at = now()
   WHERE rental_id = _rental_id AND partner_id <> _partner_id AND status = 'broadcast';

  INSERT INTO public.delivery_assignments(rental_id, partner_id, status)
  VALUES (_rental_id, _partner_id, 'broadcast')
  ON CONFLICT (rental_id, partner_id) DO UPDATE
    SET status = CASE WHEN public.delivery_assignments.status IN ('rejected','cancelled')
                      THEN 'broadcast'::public.delivery_assignment_status
                      ELSE public.delivery_assignments.status END,
        updated_at = now()
  RETURNING id INTO v_assignment;

  PERFORM public.create_notification(
    v_partner_user,
    'delivery_update'::public.notification_type,
    'New delivery assigned',
    'A shop has assigned you an order. Open your delivery dashboard to accept it.',
    '/delivery', NULL,
    jsonb_build_object('rental_id', _rental_id, 'assignment_id', v_assignment)
  );

  RETURN v_assignment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_available_delivery_partners() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_delivery_partner(uuid, uuid) TO authenticated;