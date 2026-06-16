# Order Notification & Fulfillment System

Your app already has the bones: `rentals` (kind = `buy` or `rent`) is the orders table, with `rental_status_history`, customer-side in-app notifications via the `tg_notify_rental_status` trigger, an email queue, and a Vendor page where shop owners see their orders. This plan fills the gaps you listed: shop-owner alerts, richer fulfillment statuses with action buttons, a dedicated order dashboard, status emails to customers, real-time updates, and badges.

## 1. Database changes (one migration)

- Extend `rental_status` enum with fulfillment stages: `accepted`, `rejected`, `packing`, `ready_for_pickup`, `shipped`. (Keep existing `pending`, `confirmed`, `delivered`, `returned`, `cancelled` — `confirmed` stays as the legacy "accepted".)
- Update the order-status trigger so that on **new order insert** it also creates an in-app notification for the **shop owner** (uses `stores.owner_id`) with customer name, product, qty, address, payment status.
- Extend the customer-side notification trigger to handle the new statuses with friendly titles ("Order accepted", "Being packed", "Ready for pickup", "Shipped", "Out for delivery", etc.).
- After status changes, enqueue a transactional email to the customer (and optionally the shop owner on new orders) via the existing `transactional_emails` queue using the current `status-update` template (extended with the new labels).
- Add an index on `rentals(store_id, status, created_at desc)` for the dashboard.

## 2. Edge function

- `notify-new-order` (server-trigger from the existing payment-verify function, or fired from a DB trigger via `pg_net`): enqueues the shop-owner email + customer order-confirmation email. Reuses the email queue, no new secrets.

## 3. Shop-owner Order Dashboard

New route `/vendor/orders` (also surfaced as a tab inside `Vendor.tsx`) with:

- Stat cards: New / In progress / Shipped / Delivered / Cancelled.
- Filters: status multi-select, kind (buy/rent), date range.
- Search box: order ID prefix or customer name (server-side `ilike`).
- Table (desktop) / stacked cards (mobile) showing: order id (short), customer, product + qty, address, payment status, total, placed-at.
- Action buttons that follow a state machine:
  - `pending` → **Accept** / **Reject**
  - `accepted` → **Mark Packing**
  - `packing` → **Mark Ready for Pickup/Shipping**
  - `ready_for_pickup` → **Mark Shipped**
  - `shipped` → **Mark Delivered**
  - Plus **Cancel** where allowed.
- Realtime subscription on `rentals` filtered by the vendor's store ids so the list and badges update live.

## 4. Customer-side tracking

- Extend `RentalStatusTimeline` with the new steps so `MyRentals` and `TrackOrder` show the full fulfillment journey.
- Subscribe to the customer's own `rentals` rows for live status updates.

## 5. Notification badges

- `NotificationBell` already exists. Add a small **"New orders"** badge in the Navbar (vendor-only) that counts `rentals` where `status = 'pending'` for the owner's stores, live-updated via realtime.
- Inside the dashboard, each status tab shows a count.

## 6. Security & responsiveness

- All RLS stays as-is (vendor sees only their store's rentals; status updates already gated by store ownership). New enum values are covered by existing policies.
- Dashboard is mobile-first: cards on `<md`, table on `≥md`. Action buttons stack vertically on small screens.

## Technical notes

- Files added: `src/pages/VendorOrders.tsx`, `src/components/vendor/OrderActions.tsx`, `src/components/vendor/OrderFilters.tsx`, `src/hooks/useNewOrderCount.ts`, `supabase/functions/notify-new-order/index.ts`.
- Files changed: `src/App.tsx` (route), `src/components/Navbar.tsx` (vendor badge), `src/pages/Vendor.tsx` (link tab), `src/components/RentalStatusTimeline.tsx` (new steps), `supabase/functions/_shared/transactional-email-templates/status-update.tsx` (labels).
- DB: one migration adding enum values, replacing the two trigger functions, adding the index. No table renames, no breaking schema changes — existing rentals keep working.

Approve and I'll ship it in one pass (migration first, then code).