# Notification System

A complete in-app notification system (real-time via Lovable Cloud / Supabase Realtime) with user preferences, an admin broadcast console, and a bell icon notification center. Web push (browser/native push) is out of scope unless you want it as a follow-up — most "push notification" needs in a Lovable web app are best served by in-app + email, both of which this plan covers.

## Scope

### 1. Database (new tables, RLS, triggers)
- `notifications` — per-user notification rows
  - user_id, type (enum), category, title, body, link_url, image_url, metadata (jsonb), is_read, read_at, is_deleted, delivered_at, clicked_at, created_at
- `notification_preferences` — one row per user
  - new_products, discounts_offers, order_updates, rental_updates, promotional (all bool, default true)
- `notification_campaigns` — admin-created broadcasts
  - title, body, link_url, image_url, audience_type (all|selected|city|category), audience_filter (jsonb), scheduled_for, sent_at, status (draft|scheduled|sending|sent|failed), created_by
- `notification_campaign_recipients` — fan-out audit (campaign_id, user_id, notification_id)
- `wishlists` — product_id, user_id (so "back in stock" can target)
- Enable Realtime on `notifications`
- Triggers:
  - On `products` INSERT → fan out "New arrival" to users with `new_products = true`
  - On `products` UPDATE where discount_percent rises → "Flash sale" to users with `discounts_offers = true`
  - On `products` UPDATE where stock goes 0 → >0 → "Back in stock" to wishlist watchers
  - On `rentals` status change → notify customer (respect `rental_updates`/`order_updates`)
  - Auto-create default `notification_preferences` row in `handle_new_user`

### 2. Edge functions
- `send-campaign` — admin-invoked; resolves audience, inserts notifications, marks campaign sent
- `process-scheduled-campaigns` — cron every 5 min; sends due scheduled campaigns

### 3. Frontend
- `NotificationBell` in `Navbar` — unread badge, dropdown list, "Mark all read", links to full page
- `/notifications` — full history page; mark read / delete / filter
- `/settings/notifications` — toggle preferences
- Admin → new "Notifications" tab in `/admin`:
  - Compose: title, body, link, image, audience picker (All / Selected users / City / Category), schedule date/time
  - Campaign list with status, recipient count, sent time
- Realtime subscription on `notifications` → live badge + toast for new items
- Wishlist heart button on `ProductCard` (minimal — needed for back-in-stock)

### 4. Out of scope (ask if needed)
- Browser Web Push / FCM device tokens (requires service worker + VAPID keys)
- SMS / WhatsApp notifications
- Email digests of notifications (transactional emails already exist for rentals)

## Technical notes
- Audience fan-out runs server-side in Postgres triggers / edge functions using `service_role`, so RLS on `notifications` can stay strict: users can only `SELECT`/`UPDATE`/`DELETE` their own rows; only `service_role` + admins insert.
- Preferences are checked at fan-out time, not at read time.
- Notification types enum: `new_product, discount, back_in_stock, order_update, rental_update, promo, admin_broadcast`.
- Realtime uses `supabase.channel().on('postgres_changes', { table: 'notifications', filter: 'user_id=eq.<uid>' })`.

## Files
- New: `supabase/migrations/<ts>_notifications.sql`, `supabase/functions/send-campaign/index.ts`, `supabase/functions/process-scheduled-campaigns/index.ts`
- New: `src/components/NotificationBell.tsx`, `src/components/AdminNotificationsPanel.tsx`, `src/pages/Notifications.tsx`, `src/pages/NotificationSettings.tsx`, `src/hooks/useNotifications.ts`
- Edited: `src/components/Navbar.tsx` (bell + settings link), `src/App.tsx` (routes), `src/pages/Admin.tsx` (new tab), `src/components/ProductCard.tsx` (wishlist heart)

Confirm and I'll build it. Tell me if you want browser Web Push (FCM) added — that requires extra setup (VAPID keys, service worker, user permission prompt).