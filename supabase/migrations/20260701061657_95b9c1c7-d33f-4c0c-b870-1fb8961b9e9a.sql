CREATE INDEX IF NOT EXISTS idx_notifications_user_active_created
  ON public.notifications (user_id, created_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON public.user_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_products_store_available
  ON public.products (store_id) WHERE available = true;

CREATE INDEX IF NOT EXISTS idx_rentals_customer_created
  ON public.rentals (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rentals_store_created
  ON public.rentals (store_id, created_at DESC);