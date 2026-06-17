CREATE OR REPLACE FUNCTION public.tg_notify_rental_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  product_title text; img text;
  want_order bool; want_rental bool;
  title_txt text; body_txt text; ntype public.notification_type;
  store_owner uuid; store_name text;
  customer_name text;
  kind_label text;
  kind_emoji text;
  rental_window text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT title, CASE WHEN array_length(images,1)>0 THEN images[1] ELSE NULL END
    INTO product_title, img FROM public.products WHERE id = NEW.product_id;
  SELECT owner_id, name INTO store_owner, store_name FROM public.stores WHERE id = NEW.store_id;
  SELECT full_name INTO customer_name FROM public.profiles WHERE id = NEW.customer_id;
  SELECT order_updates, rental_updates INTO want_order, want_rental
    FROM public.notification_preferences WHERE user_id = NEW.customer_id;

  IF NEW.kind = 'buy' THEN
    ntype := 'order_update';
    kind_label := 'PURCHASE ORDER';
    kind_emoji := '🟢';
    title_txt := CASE NEW.status::text
      WHEN 'pending' THEN 'Order received'
      WHEN 'accepted' THEN 'Order accepted'
      WHEN 'confirmed' THEN 'Order confirmed'
      WHEN 'rejected' THEN 'Order rejected'
      WHEN 'packing' THEN 'Your order is being packed'
      WHEN 'ready_for_pickup' THEN 'Your order is ready for shipping'
      WHEN 'shipped' THEN 'Your order has been shipped'
      WHEN 'delivered' THEN 'Order delivered'
      WHEN 'returned' THEN 'Order returned'
      WHEN 'cancelled' THEN 'Order cancelled'
      ELSE 'Order ' || NEW.status::text END;
  ELSE
    ntype := 'rental_update';
    kind_label := 'RENTAL ORDER';
    kind_emoji := '🔵';
    title_txt := CASE NEW.status::text
      WHEN 'pending' THEN 'Rental request received'
      WHEN 'accepted' THEN 'Rental accepted'
      WHEN 'confirmed' THEN 'Rental approved'
      WHEN 'rejected' THEN 'Rental rejected'
      WHEN 'packing' THEN 'Your rental is being prepared'
      WHEN 'ready_for_pickup' THEN 'Ready for pickup / dispatch'
      WHEN 'shipped' THEN 'Your rental has shipped'
      WHEN 'delivered' THEN 'Pickup / delivery completed'
      WHEN 'returned' THEN 'Return completed'
      WHEN 'cancelled' THEN 'Rental cancelled'
      ELSE 'Rental ' || NEW.status::text END;
  END IF;
  body_txt := COALESCE(product_title,'Your order') || ' — status: ' || NEW.status::text;

  -- Customer notification (respect preferences)
  IF (NEW.kind = 'buy' AND COALESCE(want_order, true))
     OR (NEW.kind <> 'buy' AND COALESCE(want_rental, true)) THEN
    INSERT INTO public.notifications(user_id,type,title,body,link_url,image_url,metadata)
    VALUES (NEW.customer_id, ntype, title_txt, body_txt,
            '/my-rentals', img,
            jsonb_build_object('rental_id',NEW.id,'status',NEW.status,'kind',NEW.kind));
  END IF;

  -- Shop owner notification on new order (INSERT only)
  IF TG_OP = 'INSERT' AND store_owner IS NOT NULL AND store_owner <> NEW.customer_id THEN
    rental_window := CASE
      WHEN NEW.kind <> 'buy' AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL
        THEN E'\nRental period: ' || to_char(NEW.start_date, 'DD Mon YYYY')
             || ' → ' || to_char(NEW.end_date, 'DD Mon YYYY')
             || ' (return due ' || to_char(NEW.end_date, 'DD Mon YYYY') || ')'
      ELSE ''
    END;

    INSERT INTO public.notifications(user_id,type,title,body,link_url,image_url,metadata)
    VALUES (
      store_owner,
      ntype,
      kind_emoji || ' NEW ' || kind_label || ' · ' || COALESCE(product_title,'item'),
      kind_emoji || ' ' || kind_label
        || E'\nFrom ' || COALESCE(customer_name,'a customer')
        || ' · Qty ' || COALESCE(NEW.quantity,1)::text
        || ' · ₹' || NEW.grand_total::text
        || ' · Payment: ' || NEW.payment_status::text
        || rental_window
        || CASE WHEN NEW.address IS NOT NULL THEN E'\nDeliver to: ' || NEW.address ELSE '' END,
      '/vendor/orders',
      img,
      jsonb_build_object(
        'rental_id', NEW.id,
        'kind', NEW.kind,
        'kind_label', kind_label,
        'quantity', NEW.quantity,
        'address', NEW.address,
        'payment_status', NEW.payment_status,
        'customer_name', customer_name,
        'grand_total', NEW.grand_total,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'return_due', CASE WHEN NEW.kind <> 'buy' THEN NEW.end_date ELSE NULL END
      )
    );
  END IF;

  RETURN NEW;
END $function$;