CREATE OR REPLACE FUNCTION public.tg_notify_vendor_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  store_owner uuid;
  product_title text;
  img text;
  customer_name text;
  kind_label text;
BEGIN
  IF NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
    RETURN NEW;
  END IF;
  IF NEW.payment_status NOT IN ('paid'::public.payment_status, 'cod'::public.payment_status) THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO store_owner FROM public.stores WHERE id = NEW.store_id;
  SELECT title, CASE WHEN array_length(images,1) > 0 THEN images[1] ELSE NULL END
    INTO product_title, img FROM public.products WHERE id = NEW.product_id;
  SELECT full_name INTO customer_name FROM public.profiles WHERE id = NEW.customer_id;
  kind_label := CASE WHEN NEW.kind = 'buy' THEN 'PURCHASE ORDER' ELSE 'RENTAL ORDER' END;

  -- Decrement stock for confirmed purchases
  IF NEW.kind = 'buy' THEN
    UPDATE public.products
       SET quantity = GREATEST(0, quantity - COALESCE(NEW.quantity, 1))
     WHERE id = NEW.product_id;
  END IF;

  IF store_owner IS NOT NULL AND store_owner <> NEW.customer_id THEN
    INSERT INTO public.notifications(user_id, type, title, body, link_url, image_url, metadata)
    VALUES (
      store_owner,
      CASE WHEN NEW.kind = 'buy' THEN 'order_update'::public.notification_type
           ELSE 'rental_update'::public.notification_type END,
      '💰 PAYMENT CONFIRMED · ' || COALESCE(product_title, 'item'),
      kind_label || ' from ' || COALESCE(customer_name, 'a customer')
        || ' · Qty ' || COALESCE(NEW.quantity, 1)::text
        || ' · ₹' || NEW.grand_total::text
        || ' · Payment: ' || NEW.payment_status::text
        || E'\nAction needed: accept and pack this order.',
      '/vendor/orders',
      img,
      jsonb_build_object(
        'rental_id', NEW.id,
        'kind', NEW.kind,
        'payment_status', NEW.payment_status,
        'status', NEW.status,
        'grand_total', NEW.grand_total
      )
    );
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_notify_vendor_on_payment ON public.rentals;
CREATE TRIGGER trg_notify_vendor_on_payment
AFTER UPDATE OF payment_status ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_vendor_on_payment();