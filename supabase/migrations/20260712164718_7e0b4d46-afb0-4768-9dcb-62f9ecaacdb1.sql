
CREATE OR REPLACE FUNCTION public.delivery_proofs_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TYPE public.delivery_proof_kind AS ENUM ('delivery', 'return');
CREATE TYPE public.delivery_proof_review AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.delivery_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.delivery_assignments(id) ON DELETE CASCADE,
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  kind public.delivery_proof_kind NOT NULL,
  file_path text NOT NULL,
  notes text,
  review_status public.delivery_proof_review NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_proofs_assignment ON public.delivery_proofs(assignment_id);
CREATE INDEX idx_delivery_proofs_review_status ON public.delivery_proofs(review_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_proofs TO authenticated;
GRANT ALL ON public.delivery_proofs TO service_role;

ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner manages own proofs" ON public.delivery_proofs FOR ALL TO authenticated
USING (partner_id IN (SELECT id FROM public.delivery_partners WHERE user_id = auth.uid()))
WITH CHECK (partner_id IN (SELECT id FROM public.delivery_partners WHERE user_id = auth.uid()));

CREATE POLICY "Customer views own rental proofs" ON public.delivery_proofs FOR SELECT TO authenticated
USING (rental_id IN (SELECT id FROM public.rentals WHERE customer_id = auth.uid()));

CREATE POLICY "Store views own rental proofs" ON public.delivery_proofs FOR SELECT TO authenticated
USING (rental_id IN (SELECT r.id FROM public.rentals r JOIN public.stores s ON s.id = r.store_id WHERE s.owner_id = auth.uid()));

CREATE POLICY "Admin manages all proofs" ON public.delivery_proofs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_delivery_proofs_updated_at
BEFORE UPDATE ON public.delivery_proofs
FOR EACH ROW EXECUTE FUNCTION public.delivery_proofs_touch_updated_at();
