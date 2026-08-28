CREATE OR REPLACE FUNCTION public.tg_delivery_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_customer uuid; v_store_owner uuid; v_partner_user uuid; v_product_title text;
  v_status text;
BEGIN
  SELECT r.status::text INTO v_status FROM public.rentals r WHERE r.id = NEW.rental_id;

  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE public.delivery_assignments
      SET status = 'cancelled'::public.delivery_assignment_status, cancelled_at = now()
      WHERE rental_id = NEW.rental_id AND id <> NEW.id AND status = 'broadcast';
    NEW.accepted_at := COALESCE(NEW.accepted_at, now());
    UPDATE public.rentals
      SET assigned_partner_id = NEW.partner_id,
          status = CASE WHEN v_status IN ('pending','confirmed','accepted','packing','ready_for_pickup')
                        THEN 'assigned'::public.rental_status ELSE status END,
          updated_at = now()
      WHERE id = NEW.rental_id;
  END IF;

  IF NEW.status = 'picked_up' AND (OLD.status IS DISTINCT FROM 'picked_up') THEN
    NEW.picked_up_at := COALESCE(NEW.picked_up_at, now());
    -- step 1: assigned -> picked_up
    UPDATE public.rentals SET status = 'picked_up'::public.rental_status, updated_at = now()
      WHERE id = NEW.rental_id AND status::text = 'assigned';
    -- step 2: picked_up/shipped -> out_for_delivery
    UPDATE public.rentals SET status = 'out_for_delivery'::public.rental_status, updated_at = now()
      WHERE id = NEW.rental_id AND status::text IN ('picked_up','shipped');
  END IF;

  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
    UPDATE public.rentals SET status = 'picked_up'::public.rental_status, updated_at = now()
      WHERE id = NEW.rental_id AND status::text = 'assigned';
    UPDATE public.rentals SET status = 'out_for_delivery'::public.rental_status, updated_at = now()
      WHERE id = NEW.rental_id AND status::text IN ('picked_up','shipped');
    UPDATE public.rentals SET status = 'delivered'::public.rental_status,
      actual_delivered_at = now(), updated_at = now()
      WHERE id = NEW.rental_id AND status::text = 'out_for_delivery';
    INSERT INTO public.delivery_earnings(assignment_id, partner_id, rental_id, amount, status)
      VALUES (NEW.id, NEW.partner_id, NEW.rental_id, 50, 'pending')
      ON CONFLICT (assignment_id) DO NOTHING;
  END IF;

  IF NEW.status = 'returned_to_store' AND (OLD.status IS DISTINCT FROM 'returned_to_store') THEN
    NEW.returned_to_store_at := COALESCE(NEW.returned_to_store_at, now());
    UPDATE public.rentals SET status = 'returned'::public.rental_status,
      returned_at = now(), updated_at = now()
      WHERE id = NEW.rental_id AND status::text IN ('return_picked_up','delivered','return_scheduled');
  END IF;

  SELECT dp.user_id INTO v_partner_user FROM public.delivery_partners dp WHERE dp.id = NEW.partner_id;
  SELECT r.customer_id INTO v_customer FROM public.rentals r WHERE r.id = NEW.rental_id;
  SELECT s.owner_id INTO v_store_owner FROM public.rentals r JOIN public.stores s ON s.id = r.store_id WHERE r.id = NEW.rental_id;
  SELECT p.title INTO v_product_title FROM public.rentals r JOIN public.products p ON p.id = r.product_id WHERE r.id = NEW.rental_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'broadcast' AND v_partner_user IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,type,title,body,link_url,metadata)
    VALUES (v_partner_user, 'delivery_update'::public.notification_type,
      '🛵 New delivery available',
      'A new pickup near you: ' || COALESCE(v_product_title,'order'),
      '/delivery', jsonb_build_object('rental_id',NEW.rental_id,'assignment_id',NEW.id));
  END IF;
  IF TG_OP='UPDATE' AND NEW.status='accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    IF v_store_owner IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,type,title,body,link_url)
      VALUES (v_store_owner,'delivery_update'::public.notification_type,
        '🛵 Delivery partner assigned','A partner accepted your order.','/vendor/orders');
    END IF;
    IF v_customer IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,type,title,body,link_url)
      VALUES (v_customer,'delivery_update'::public.notification_type,
        '🛵 Delivery partner assigned','A partner is on the way to pick up your order.','/my-rentals');
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND NEW.status='delivered' AND OLD.status IS DISTINCT FROM 'delivered' AND v_customer IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,type,title,body,link_url)
    VALUES (v_customer,'delivery_update'::public.notification_type,
      '✅ Order delivered','Your order has been delivered successfully.','/my-rentals');
  END IF;
  RETURN NEW;
END
$fn$;