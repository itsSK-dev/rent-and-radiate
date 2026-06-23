## Goal

Layer advanced rental management onto the existing rentals system without breaking checkout, payment, refund, or vendor flows.

## What already exists (will be reused, not rebuilt)

- `rental_images` table with `stage` (`before_delivery`, `after_return`) and an enforcement trigger that blocks `delivered`/`returned` without proof photos.
- `rental_extension_requests` table + `apply_extension_approval` trigger that updates `end_date` and `days` on approval.
- `tg_auto_create_refund_on_return` already computes a late fee (per-day rental rate × days late) and feeds it into `deposit_refunds`.
- `platform_settings` row holds GST, commission, delivery fee, rental %, deposit %.

The work below fills the gaps and exposes everything in the UI. No existing column or trigger is dropped.

## New / changed pieces

### 1. Platform settings (admin-controlled)

Add columns to `platform_settings`:
- `protection_plan_percent` (default 5 — % of rental subtotal)
- `protection_plan_min` (default 49 — floor in INR)
- `late_fee_multiplier` (default 1.5 — multiplies per-day rate for each late day)
- `late_fee_grace_hours` (default 2)
- `reminder_intervals_hours` (int[] default `{24,6,1}`)
- `rent_to_own_enabled` (bool default false — global toggle)
- `rent_to_own_credit_percent` (default 50 — % of paid rentals applied toward purchase)

Update `PlatformSettingsPanel.tsx` with new fields. Shop owners never see these.

### 2. Product-level rent-to-own opt-in

Add `products.rent_to_own_enabled` (bool default false). Shop owner can toggle per product in Vendor page. Only effective when global `rent_to_own_enabled` is true and product `purpose` is `both`.

### 3. Rentals table additions

- `protection_plan` bool, `protection_plan_fee` numeric — captured at checkout.
- `late_fee_applied` numeric — locked in when return is processed.
- `late_fee_hours` int — actual hours late at return time.
- `qr_token` uuid default `gen_random_uuid()`, unique — used for QR verification.
- `rent_to_own_credit` numeric — running credit earned by completed rentals of this product by this customer.
- `converted_to_purchase_rental_id` uuid nullable — links a buy-out order back to the rental it was converted from.

Update `compute_rental_pricing` trigger:
- Compute `protection_plan_fee = max(min, subtotal × percent/100)` when `protection_plan = true` and `kind != 'buy'`.
- Add it to `grand_total`.
- Customers cannot self-set `late_fee_applied`, `qr_token`, `rent_to_own_credit`, `converted_to_purchase_rental_id` (guard in trigger).

Update `tg_auto_create_refund_on_return`:
- Use `late_fee_multiplier` and `late_fee_grace_hours` from settings.
- Compute `hours_late` = max(0, returned_at − end_date − grace).
- `late_fee = ceil(hours_late / 24) × per_day × multiplier`.
- Store in `rentals.late_fee_applied` and pass to `deposit_refunds.late_fee` (existing column).

### 4. Reminder system

New table `rental_reminders`:
- `rental_id`, `due_at` (timestamptz), `hours_before` int, `sent_at` nullable, `status` (`pending|sent|skipped`).

Trigger on rental insert/update of `end_date`: insert one row per interval from `reminder_intervals_hours`.

New edge function `send-rental-reminders` (scheduled via `pg_cron` every 15 min):
- Selects `rental_reminders` where `sent_at IS NULL AND due_at <= now() AND status = 'pending'`.
- Creates a `notification` (existing `notifications` table) for the customer.
- Marks reminder `sent`.

### 5. Condition photos UI

Already enforced server-side. Add:
- Vendor → order detail: "Before dispatch" uploader (existing `rental_images` + `product-images` bucket reuse) — make it required before clicking "Mark delivered".
- Customer → My Rentals: "Before return" uploader, required before clicking "Mark returned".
- Both surface the full image gallery per stage on the order page so disputes have full evidence.

### 6. Rental availability calendar

New page `/product/:id/calendar` (or inline on ProductDetail):
- Reads confirmed/active rentals for that product (`status in confirmed|delivered|shipped|packing` and `kind != 'buy'`).
- Renders month grid with booked dates blocked.
- Checkout date pickers disable blocked ranges.

Implementation: small `RentalCalendar` component using shadcn `Calendar` with `disabled={blockedDates}`.

### 7. QR verification

- Vendor order detail page renders `<QRCode value={qr_token}/>` (using `qrcode.react`, already a tiny add) for handover.
- Vendor scans (or pastes) customer QR on pickup → calls edge function `verify-rental-qr` which checks token + flips `status` to `delivered` (after the photo gate).
- For Phase 1 ship the QR display + a paste-token form on `/vendor/orders/:id`; native camera scan can come later.

### 8. Rent-to-own conversion

Add edge function `convert-rental-to-purchase`:
- Inputs: `rental_id`.
- Validates: rental status in (`returned|delivered`), product + platform both have rent-to-own enabled, customer matches caller.
- Computes credit = sum of completed `rental_total` for this customer×product × `rent_to_own_credit_percent / 100`.
- Creates a new `rentals` row with `kind='buy'`, `quantity=1`, `discount_amount = credit` (capped at product price), `converted_to_purchase_rental_id = source`, status `pending`, payment `unpaid`.
- Customer then completes payment via existing Razorpay/COD flow.

Surface a "Buy this for ₹X (₹Y rental credit applied)" button on My Rentals for eligible completed rentals.

### 9. Checkout updates

`Checkout.tsx`:
- Show optional Rental Protection Plan toggle for rent orders. Live-update displayed totals using a small client mirror of the formula (server is source of truth).
- Insert with `protection_plan` and (server will compute the fee) — client only sends the flag.

### 10. Cron / scheduled work

After migrations, register cron jobs via insert tool (per knowledge file):
- `send-rental-reminders` every 15 min.
- Reuse the existing `process-scheduled-campaigns` cadence as the template.

## Technical notes

- All new policies follow the existing pattern: customer reads own rows, store owner reads store rows, admin reads all, edge functions use service role.
- New tables get explicit GRANTs (`authenticated` + `service_role`; no `anon`).
- `qrcode.react` is the only new npm dep.
- No existing column types change. New columns are nullable / have defaults so old code paths keep working.
- Pricing displayed in components.tsx already reads from `pricing.ts`; extend with `protectionPlanFee(subtotal, settings)` helper so UI and edge functions agree.

## Rollout order (one PR per step, each independently shippable)

1. Migration: platform_settings + rentals + products columns, update triggers, `rental_reminders` table & insert trigger.
2. Checkout protection-plan toggle.
3. Vendor + customer photo gates wired into status transitions.
4. Edge function + cron for reminders.
5. Availability calendar on ProductDetail + date-picker disabling.
6. QR display on vendor order page + `verify-rental-qr` edge function.
7. Rent-to-own toggle in Vendor product form + conversion button + `convert-rental-to-purchase` edge function.

Reply with which steps to ship first (or "all of it") and I'll start with the migration.