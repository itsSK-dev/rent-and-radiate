
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 2;

CREATE OR REPLACE FUNCTION public.tg_low_stock_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_store_name text;
  threshold int;
BEGIN
  threshold := COALESCE(NEW.low_stock_threshold, 2);
  IF NEW.quantity > threshold THEN RETURN NEW; END IF;
  IF OLD.quantity <= threshold AND OLD.quantity = NEW.quantity THEN RETURN NEW; END IF;

  SELECT owner_id, name INTO v_owner, v_store_name FROM public.stores WHERE id = NEW.store_id;
  IF v_owner IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications(user_id, type, title, body, link_url, image_url, metadata)
  VALUES (
    v_owner,
    'order_update'::public.notification_type,
    CASE WHEN NEW.quantity = 0
         THEN '⚠️ Out of stock: ' || NEW.title
         ELSE '⚠️ Low stock: ' || NEW.title || ' (' || NEW.quantity || ' left)'
    END,
    'Restock soon to keep your listing visible to customers.',
    '/vendor?tab=inventory',
    CASE WHEN array_length(NEW.images,1) > 0 THEN NEW.images[1] ELSE NULL END,
    jsonb_build_object('product_id', NEW.id, 'quantity', NEW.quantity, 'threshold', threshold)
  );
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_low_stock_alert() FROM PUBLIC;

DROP TRIGGER IF EXISTS products_low_stock_alert ON public.products;
CREATE TRIGGER products_low_stock_alert
AFTER UPDATE OF quantity, low_stock_threshold ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_low_stock_alert();
