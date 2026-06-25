
-- 1. payment_settings INSERT policy: restrict to authenticated admins only
DROP POLICY IF EXISTS "Admins insert payment settings" ON public.payment_settings;
CREATE POLICY "Admins insert payment settings" ON public.payment_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Revoke EXECUTE on all trigger-only SECURITY DEFINER functions from PUBLIC/anon/authenticated.
DO $$
DECLARE
  fn text;
  trigger_fns text[] := ARRAY[
    'apply_extension_approval()',
    'apply_refund_approval()',
    'compute_rental_pricing()',
    'enforce_deposit_refund_amounts()',
    'enforce_rental_proof_images()',
    'grant_store_owner_on_approval()',
    'guard_manual_payment_insert()',
    'guard_profile_moderation_fields()',
    'guard_rental_payment_status()',
    'guard_user_roles()',
    'handle_new_user()',
    'log_ad_request_status_change()',
    'log_dispute_status_change()',
    'log_rental_status_change()',
    'log_return_status_change()',
    'on_manual_payment_insert()',
    'on_manual_payment_review()',
    'tg_apply_reward_redemption()',
    'tg_audit_deposit_refund()',
    'tg_audit_dispute()',
    'tg_auto_create_refund_on_return()',
    'tg_compute_product_rental_price()',
    'tg_create_vendor_settlement()',
    'tg_debit_redeemed_points()',
    'tg_notify_back_in_stock()',
    'tg_notify_discount()',
    'tg_notify_new_product()',
    'tg_notify_refund_status()',
    'tg_notify_rental_status()',
    'tg_process_rental_rewards()',
    'tg_schedule_rental_reminders()',
    'sync_store_admin_flags()',
    'sync_store_approved()',
    'guard_store_admin_controls()',
    'tg_set_updated_at()',
    'log_admin_event(text,uuid,text,uuid,text,jsonb)',
    'log_proof_access(text,text)',
    'move_to_dlq(text,text,bigint,jsonb)',
    'enqueue_email(text,jsonb)',
    'read_email_batch(text,integer,integer)',
    'delete_email(text,bigint)',
    'promote_eligible_settlements()'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Keep RPC helpers callable by authenticated only (revoke from anon/public)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_store_owner_of_rental(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_store_owner_of_rental(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_rental_qr_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_rental_qr_token(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, public.notification_type, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, public.notification_type, text, text, text, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;

-- 3. Realtime channel authorization: restrict broadcast/presence subscriptions to user's own private channel.
-- Postgres changes events still rely on source-table RLS.
DROP POLICY IF EXISTS "Users can subscribe to own private channel" ON realtime.messages;
CREATE POLICY "Users can subscribe to own private channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    (realtime.topic() = 'user:' || auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can send to own private channel" ON realtime.messages;
CREATE POLICY "Users can send to own private channel"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (realtime.topic() = 'user:' || auth.uid()::text)
  );
