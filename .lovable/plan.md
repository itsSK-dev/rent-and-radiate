## Goal
Extend the existing `/admin` page with two new tabs — **Overview** (KPI cards) and **Analytics** (charts & reports) — without touching any existing admin panels (Shops, Refunds, Payments, Ads, Notifications, Audit, Email, Platform Settings).

## Access control
- Reuse the existing admin guard already in `src/pages/Admin.tsx` (`has_role(auth.uid(),'admin')`). No new routes — both tabs live under `/admin`, so the current guard covers them.
- All data is read via the standard supabase client; RLS on `rentals`, `products`, `stores`, `profiles`, `deposit_refunds`, `vendor_settlements`, `user_roles` already restricts non-admin reads. No schema or policy changes.

## New files
1. `src/components/admin/AdminOverviewPanel.tsx` — KPI grid.
2. `src/components/admin/AdminAnalyticsPanel.tsx` — charts + ranked tables.
3. `src/lib/adminStats.ts` — small fetch helpers (counts, sums, time-bucketed series, top-N queries) reused by both panels.

## Modified files
- `src/pages/Admin.tsx` — add two `TabsTrigger`s ("Overview", "Analytics") and matching `TabsContent`. Default tab switches to `overview`. No other panels touched.

## Overview KPIs (cards)
Each card = one count/sum query against existing tables:

| KPI | Source |
|---|---|
| Total users | `profiles` count |
| Total sellers | distinct `stores.owner_id` where `status='approved'` |
| Total products | `products` count |
| Active rentals | `rentals` where `kind!='buy'` and `status` in (`confirmed`,`packing`,`ready_for_pickup`,`shipped`,`delivered`) |
| Completed rentals | `rentals` where `kind!='buy'` and `status='returned'` |
| Total orders | `rentals` count (all kinds) |
| Pending orders | `rentals` where `status='pending'` |
| Total revenue | sum `rentals.grand_total` where `payment_status in ('paid','partial_refund','refunded')` |
| Platform commission earned | sum `vendor_settlements.platform_fee` |
| Pending refunds | `deposit_refunds` where `status='pending_admin'` |
| Completed refunds | `deposit_refunds` where `status in ('approved','processed')` |

Use parallel `Promise.all` with `head:true, count:'exact'` for counts.

## Analytics charts
Range selector: 7d / 30d / 90d / 12m / All. Bucket = day for ≤90d, week for 12m, month for All.

- **Revenue trend** — line chart, sum(`grand_total`) per bucket; toggle daily/weekly/monthly/yearly.
- **Orders over time** — bar chart, count(`rentals`) per bucket, stacked by `kind` (buy vs rent).
- **Rental trends** — line chart, count of rentals (`kind!='buy'`) created vs returned per bucket.
- **Refund trends** — line chart, count + sum(`refund_amount`) from `deposit_refunds` per bucket.
- **Commission earnings** — area chart, sum(`platform_fee`) from `vendor_settlements` per bucket.
- **Top-selling products** — table top 10 by order count + revenue (group `rentals` by `product_id`, join `products.title`).
- **Top-performing sellers** — table top 10 by revenue and orders (group `rentals` by `store_id`, join `stores.name`).

All charts use the existing `recharts` + `src/components/ui/chart.tsx` wrappers and semantic tokens (`hsl(var(--primary))`, etc.) — no hardcoded colors. CSV export buttons reuse the same lightweight pattern as `VendorAnalyticsPanel.tsx`.

## Out of scope
- No new tables, RPCs, edge functions, or migrations.
- No changes to existing admin panels or routes.
- No new role or permission logic.
