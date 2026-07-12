
CREATE OR REPLACE FUNCTION public.tg_auto_broadcast_ready_for_pickup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE store_city text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'ready_for_pickup'::public.rental_status THEN
    SELECT city INTO store_city FROM public.stores WHERE id = NEW.store_id;
    INSERT INTO public.delivery_assignments(rental_id, partner_id, status)
    SELECT NEW.id, dp.id, 'broadcast'::public.delivery_assignment_status
      FROM public.delivery_partners dp
     WHERE dp.status = 'approved'
       AND dp.is_online = true
       AND (store_city IS NULL OR lower(dp.city) = lower(store_city))
       AND NOT EXISTS (SELECT 1 FROM public.delivery_assignments da WHERE da.rental_id = NEW.id AND da.partner_id = dp.id);
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_auto_broadcast_ready_for_pickup ON public.rentals;
CREATE TRIGGER trg_auto_broadcast_ready_for_pickup AFTER UPDATE ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_broadcast_ready_for_pickup();
