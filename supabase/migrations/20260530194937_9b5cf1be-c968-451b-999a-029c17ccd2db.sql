
-- 1. Extend rentals with delivery tracking fields
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS delivery_stage text,
  ADD COLUMN IF NOT EXISTS delivery_partner text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS expected_delivery_date date,
  ADD COLUMN IF NOT EXISTS actual_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_initiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;

-- Stage allowed values (kept as text + check for flexibility)
ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS rentals_delivery_stage_check;
ALTER TABLE public.rentals
  ADD CONSTRAINT rentals_delivery_stage_check
  CHECK (delivery_stage IS NULL OR delivery_stage IN (
    'accepted','packed','out_for_delivery','delivered'
  ));

-- 2. Rental extension requests
CREATE TYPE public.extension_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.rental_extension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  store_id uuid NOT NULL,
  current_end_date date,
  requested_end_date date NOT NULL,
  additional_days integer NOT NULL CHECK (additional_days > 0),
  reason text,
  status public.extension_status NOT NULL DEFAULT 'pending',
  reviewer_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ext_req_rental ON public.rental_extension_requests(rental_id);
CREATE INDEX idx_ext_req_store ON public.rental_extension_requests(store_id);

GRANT SELECT, INSERT, UPDATE ON public.rental_extension_requests TO authenticated;
GRANT ALL ON public.rental_extension_requests TO service_role;

ALTER TABLE public.rental_extension_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties view extension requests"
ON public.rental_extension_requests FOR SELECT TO authenticated
USING (
  customer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Customers create own extension requests"
ON public.rental_extension_requests FOR INSERT TO authenticated
WITH CHECK (
  customer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.rentals r
    WHERE r.id = rental_id AND r.customer_id = auth.uid() AND r.store_id = rental_extension_requests.store_id
  )
);

CREATE POLICY "Store/admin update extension requests"
ON public.rental_extension_requests FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE TRIGGER trg_ext_req_updated_at
BEFORE UPDATE ON public.rental_extension_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Apply approved extension to rental end_date
CREATE OR REPLACE FUNCTION public.apply_extension_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.rentals
       SET end_date = NEW.requested_end_date,
           days = COALESCE(days,0) + NEW.additional_days,
           updated_at = now()
     WHERE id = NEW.rental_id;
    NEW.reviewed_at := now();
    NEW.reviewed_by := auth.uid();
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    NEW.reviewed_at := now();
    NEW.reviewed_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_extension_approval
BEFORE UPDATE ON public.rental_extension_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_extension_approval();

-- 3. Return requests
CREATE TYPE public.return_status AS ENUM (
  'requested','approved','rejected','pickup_scheduled','picked_up',
  'returned_to_store','refund_processed','completed'
);

CREATE TABLE public.return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL UNIQUE,
  customer_id uuid NOT NULL,
  store_id uuid NOT NULL,
  status public.return_status NOT NULL DEFAULT 'requested',
  reason text,
  customer_notes text,
  store_notes text,
  admin_notes text,
  pickup_scheduled_at timestamptz,
  pickup_address text,
  picked_up_at timestamptz,
  returned_at timestamptz,
  refund_processed_at timestamptz,
  completed_at timestamptz,
  photos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_return_req_store ON public.return_requests(store_id);
CREATE INDEX idx_return_req_customer ON public.return_requests(customer_id);

GRANT SELECT, INSERT, UPDATE ON public.return_requests TO authenticated;
GRANT ALL ON public.return_requests TO service_role;

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties view return requests"
ON public.return_requests FOR SELECT TO authenticated
USING (
  customer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Customers create own return requests"
ON public.return_requests FOR INSERT TO authenticated
WITH CHECK (
  customer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.rentals r
    WHERE r.id = rental_id AND r.customer_id = auth.uid() AND r.store_id = return_requests.store_id
  )
);

CREATE POLICY "Parties update return requests"
ON public.return_requests FOR UPDATE TO authenticated
USING (
  customer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE TRIGGER trg_return_req_updated_at
BEFORE UPDATE ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Return status history
CREATE TABLE public.return_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id uuid NOT NULL,
  from_status public.return_status,
  to_status public.return_status NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_return_history_req ON public.return_status_history(return_request_id, created_at);

GRANT SELECT ON public.return_status_history TO authenticated;
GRANT ALL ON public.return_status_history TO service_role;

ALTER TABLE public.return_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties view return history"
ON public.return_status_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.return_requests rr
    WHERE rr.id = return_status_history.return_request_id
      AND (
        rr.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = rr.store_id AND s.owner_id = auth.uid())
      )
  ) OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.log_return_status_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.return_status_history (return_request_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, NEW.customer_id, 'Return requested');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.return_status_history (return_request_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NULL);

    IF NEW.status = 'picked_up' AND NEW.picked_up_at IS NULL THEN NEW.picked_up_at := now(); END IF;
    IF NEW.status = 'returned_to_store' AND NEW.returned_at IS NULL THEN NEW.returned_at := now(); END IF;
    IF NEW.status = 'refund_processed' AND NEW.refund_processed_at IS NULL THEN NEW.refund_processed_at := now(); END IF;
    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
      UPDATE public.rentals SET status = 'returned'::rental_status, returned_at = now(), updated_at = now()
        WHERE id = NEW.rental_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_return_log_insert
AFTER INSERT ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.log_return_status_change();

CREATE TRIGGER trg_return_log_update
BEFORE UPDATE ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.log_return_status_change();

-- 5. Realtime
ALTER TABLE public.rental_extension_requests REPLICA IDENTITY FULL;
ALTER TABLE public.return_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rental_extension_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.return_requests;
