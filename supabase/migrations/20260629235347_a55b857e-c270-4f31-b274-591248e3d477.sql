
-- ============ RENTALS: lock sensitive fields on UPDATE for non-admin/non-service ============
CREATE OR REPLACE FUNCTION public.guard_rental_sensitive_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role')
                     OR current_user IN ('postgres','supabase_admin');
  is_store_owner boolean := EXISTS (SELECT 1 FROM public.stores s WHERE s.id = NEW.store_id AND s.owner_id = auth.uid());
  is_customer boolean := (auth.uid() = NEW.customer_id);
BEGIN
  IF is_service OR is_admin THEN RETURN NEW; END IF;

  -- Always preserve financial / payment / commission / reward fields
  NEW.payment_status   := OLD.payment_status;
  NEW.payment_method   := OLD.payment_method;
  NEW.razorpay_order_id   := OLD.razorpay_order_id;
  NEW.razorpay_payment_id := OLD.razorpay_payment_id;
  NEW.razorpay_signature  := OLD.razorpay_signature;
  NEW.refund_amount    := OLD.refund_amount;
  NEW.commission_amount := OLD.commission_amount;
  NEW.late_fee_applied := OLD.late_fee_applied;
  NEW.late_fee_hours   := OLD.late_fee_hours;
  NEW.reward_points_earned := OLD.reward_points_earned;
  NEW.grand_total      := OLD.grand_total;
  NEW.subtotal         := OLD.subtotal;
  NEW.rental_total     := OLD.rental_total;
  NEW.gst_amount       := OLD.gst_amount;
  NEW.delivery_fee     := OLD.delivery_fee;
  NEW.deposit          := OLD.deposit;
  NEW.protection_fee   := COALESCE(OLD.protection_fee, NEW.protection_fee);
  NEW.qr_token         := OLD.qr_token;
  NEW.customer_id      := OLD.customer_id;
  NEW.store_id         := OLD.store_id;
  NEW.product_id       := OLD.product_id;
  NEW.kind             := OLD.kind;
  NEW.days             := OLD.days;

  -- Customers may only edit a small set of pre-fulfilment fields
  IF is_customer AND NOT is_store_owner THEN
    NEW.status := OLD.status;
    NEW.returned_at := OLD.returned_at;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_rental_sensitive_updates ON public.rentals;
CREATE TRIGGER guard_rental_sensitive_updates
BEFORE UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.guard_rental_sensitive_updates();

-- Hide qr_token column from regular roles; force access through get_rental_qr_token()
REVOKE SELECT (qr_token) ON public.rentals FROM authenticated, anon;
GRANT SELECT (qr_token) ON public.rentals TO service_role;

-- ============ PROFILES: lock moderation / trust / reward columns ============
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role')
                     OR current_user IN ('postgres','supabase_admin');
BEGIN
  IF is_service OR is_admin THEN RETURN NEW; END IF;
  NEW.blocked := OLD.blocked;
  NEW.trust_score := OLD.trust_score;
  NEW.is_suspicious := OLD.is_suspicious;
  NEW.suspicious_reason := OLD.suspicious_reason;
  NEW.flagged_at := OLD.flagged_at;
  NEW.reward_points := OLD.reward_points;
  NEW.lifetime_reward_points := OLD.lifetime_reward_points;
  NEW.referral_code := OLD.referral_code;
  NEW.referred_by := OLD.referred_by;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_profile_sensitive_updates ON public.profiles;
CREATE TRIGGER guard_profile_sensitive_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_updates();

-- ============ ADVERTISEMENT_REQUESTS: lock payment / pricing / status ============
CREATE OR REPLACE FUNCTION public.guard_ad_request_sensitive_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_setting('role', true) = 'service_role')
                     OR current_user IN ('postgres','supabase_admin');
BEGIN
  IF is_service OR is_admin THEN RETURN NEW; END IF;
  NEW.payment_status := OLD.payment_status;
  NEW.set_price := OLD.set_price;
  NEW.admin_notes := OLD.admin_notes;
  NEW.status := OLD.status;
  NEW.advertiser_id := OLD.advertiser_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_ad_request_sensitive_updates ON public.advertisement_requests;
CREATE TRIGGER guard_ad_request_sensitive_updates
BEFORE UPDATE ON public.advertisement_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_ad_request_sensitive_updates();

-- ============ MANUAL_PAYMENTS: already has guard_manual_payment_insert, ensure trigger attached ============
DROP TRIGGER IF EXISTS guard_manual_payment_insert ON public.manual_payments;
CREATE TRIGGER guard_manual_payment_insert
BEFORE INSERT ON public.manual_payments
FOR EACH ROW EXECUTE FUNCTION public.guard_manual_payment_insert();

-- ============ DEPOSIT_REFUNDS: enforce_deposit_refund_amounts already locks down ============
-- Make sure trigger is attached on UPDATE & INSERT
DROP TRIGGER IF EXISTS enforce_deposit_refund_amounts ON public.deposit_refunds;
CREATE TRIGGER enforce_deposit_refund_amounts
BEFORE INSERT OR UPDATE ON public.deposit_refunds
FOR EACH ROW EXECUTE FUNCTION public.enforce_deposit_refund_amounts();
