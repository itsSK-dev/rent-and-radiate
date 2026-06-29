# Seller Experience Upgrade

Build a richer seller workspace on top of the existing Vendor dashboard without breaking any current flow. Everything stays in sync with the existing Admin panels because we reuse the same tables (`stores`, `products`, `rentals`, `vendor_settlements`, `notifications`).

## 1. Seller verification with admin approval

The `stores` table already has `status`, `is_verified`, and an admin approval flow (`AdminShopsPanel`, `sync_store_admin_flags`, `grant_store_owner_on_approval`). We extend it instead of duplicating it.

- Add a "Verification" card on the Vendor dashboard:
  - Shows current status (Pending / Approved / Rejected) and a checklist (store name, logo, address, payment settings, at least 1 product).
  - "Submit for verification" button — flips the store back to `pending` if previously rejected; otherwise just reminds the user it's already submitted.
  - Read-only "Why was I rejected?" message pulled from `stores.rejection_reason` (add column if missing).
- Admin side already approves via `AdminShopsPanel` — no change needed. We only add an optional `rejection_reason TEXT` column and surface it in both panels.

## 2. Verified Seller badge

- New `<VerifiedSellerBadge />` component (shield-check icon + "Verified seller" tooltip), shown wherever a store is referenced:
  - `ProductCard` (small badge near store name)
  - `ProductDetail` store header
  - `ShopTheLook` and `Browse` listings
- Renders only when `stores.is_verified = true` and `status = 'approved'`.

## 3. Seller analytics dashboard

New tab "Analytics" inside `src/pages/Vendor.tsx` powered by a new `VendorAnalyticsPanel.tsx` that queries `rentals` and `vendor_settlements` filtered by `store_id`.

KPI cards:
- Gross sales (30d / 90d / all)
- Net payout (from `vendor_settlements.net_payout`)
- Orders count (buy vs rent split)
- Avg order value
- Repeat-customer rate
- Conversion of pending → confirmed

Charts (Recharts, already in project):
- Earnings over time (line)
- Orders by status (stacked bar)
- Buy vs Rent revenue split (donut)
- Top 5 products by revenue (bar)

## 4. Rental earnings report

Inside Analytics tab, a "Rental earnings" sub-section:
- Filter by date range and product.
- Table: product, rental period, days, gross, platform fee, net, deposit refunded, status.
- CSV export.

## 5. Sales report (buy orders)

Same Analytics tab, "Sales" sub-section:
- Filter by date range and product.
- Table: order id, product, qty, price, discount, GST, net, status, customer city.
- CSV export.

## 6. Inventory management

New "Inventory" tab in Vendor dashboard (`VendorInventoryPanel.tsx`):
- Lists all products with editable `stock_quantity`, `available` toggle, `low_stock_threshold`.
- Inline save with optimistic update.
- Bulk actions: mark unavailable, restock by +N.
- Add `low_stock_threshold INT DEFAULT 2` to `products` (migration).

## 7. Low-stock alerts

- DB trigger `tg_low_stock_alert` on `products` AFTER UPDATE of `stock_quantity`: if new value <= `low_stock_threshold` and old value > threshold (or `available` flipped off due to 0 stock), insert a notification for the store owner.
- Inventory panel highlights low-stock rows in amber and shows a count badge on the tab.

## 8. Upcoming return notifications

Already partially handled by `send-rental-reminders` (customer-facing). Add a seller-facing pass:
- Extend `send-rental-reminders` to also notify the store owner 24h and 2h before `end_date` for active rentals (`status in ('confirmed','delivered')`, `kind='rent'`).
- New "Upcoming returns" widget on Vendor dashboard listing rentals due in the next 7 days, with customer name, due date, and a quick "Mark returned" action.

## 9. Monthly earnings report

- "Monthly statements" sub-section in Analytics: list of months with gross, fees, net, orders count.
- Per-month "Download PDF/HTML" button that builds a printable invoice-style statement (reuses the HTML approach already in `VendorSettlementsPanel`).
- Optional: a scheduled job that creates a notification at the start of each month linking to the previous month's statement.

## 10. Product performance analytics

- Per-product detail (expand row in Inventory or from "Top products" chart): views (if `products.view_count` exists, else skipped), wishlist saves, orders, conversion %, revenue, average rating.
- Wishlist saves: `select count(*) from wishlists where product_id = ?` grouped.

## Admin sync

All new data lives in tables the admin already reads (`stores`, `products`, `rentals`, `vendor_settlements`, `notifications`). Admin panels keep working unchanged. We will:
- Add `rejection_reason` and `low_stock_threshold` columns to existing admin views.
- Surface low-stock products in `AdminShopsPanel` as a small badge per store (count).

## Technical details

Migration (single file):
```
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold int NOT NULL DEFAULT 2;

CREATE OR REPLACE FUNCTION public.tg_low_stock_alert() ...   -- inserts notification
CREATE TRIGGER products_low_stock AFTER UPDATE OF stock_quantity ON public.products ...
```

New files:
- `src/components/VerifiedSellerBadge.tsx`
- `src/components/vendor/VendorAnalyticsPanel.tsx`
- `src/components/vendor/VendorInventoryPanel.tsx`
- `src/components/vendor/VendorVerificationCard.tsx`
- `src/components/vendor/UpcomingReturnsWidget.tsx`

Edited files:
- `src/pages/Vendor.tsx` — add Analytics, Inventory tabs, mount Verification card and Upcoming returns widget.
- `src/components/ProductCard.tsx`, `src/pages/ProductDetail.tsx` — render `VerifiedSellerBadge`.
- `src/components/AdminShopsPanel.tsx` — expose `rejection_reason` editor.
- `supabase/functions/send-rental-reminders/index.ts` — also notify seller.

Nothing is removed; existing settlements, refund, and order flows are untouched.
