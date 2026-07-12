
# Delivery Partner Module — Implementation Plan

Auto-broadcast assignment, email+password login, shop QR fully replaced by OTP.

## 1. Database (single migration)

New enum values and tables. Everything gets GRANTs + RLS.

- `app_role` — add `'delivery_partner'`.
- `rental_status` — add `'ready_for_pickup'`, `'assigned'`, `'picked_up'`, `'out_for_delivery'`, `'return_scheduled'`, `'return_picked_up'`, `'completed'` (whichever aren't already present — I'll reuse existing ones).
- `delivery_partners` — one row per partner. Personal info, addresses, vehicle info, docs (URLs to storage), bank/UPI, `status` (`pending`/`approved`/`rejected`/`suspended`), `rejection_reason`, `is_online`, `city`, `pin_code`, `user_id → auth.users`.
- `delivery_partner_documents` — normalized doc rows (aadhaar_front, aadhaar_back, pan, dl, rc, insurance, profile_photo) referencing a private Storage bucket.
- `delivery_assignments` — links a `rental_id` to a `delivery_partner_id`; states: `broadcast`, `accepted`, `rejected`, `picked_up`, `delivered`, `return_scheduled`, `return_picked_up`, `returned_to_store`, `cancelled`. Broadcast rows created for all eligible online partners in the shop's city; first-accept wins, others auto-cancel via trigger.
- `delivery_otps` — `rental_id`, `kind` (`delivery`/`return`), `code_hash`, `expires_at`, `verified_at`. 6-digit code, hashed. Generated when partner marks "arrived"; verified via edge function.
- `delivery_earnings` — per completed delivery: base fee, distance fee, total, status (`pending`/`paid`).
- `rentals` additions: `assigned_partner_id`, `pickup_otp_verified_at`, `return_otp_verified_at`.
- Triggers: notify partners on broadcast, notify customer/shop on status changes, auto-cancel sibling broadcasts on accept, create earnings row on delivered.
- Storage bucket `delivery-partner-docs` (private) with RLS: partner reads own, admin reads all.

## 2. Edge functions

- `deliverypartner-generate-otp` — customer requests OTP; stores hashed code; returns plaintext to customer only.
- `deliverypartner-verify-otp` — partner submits code; verifies + updates rental + assignment state; writes notifications.
- `deliverypartner-broadcast-assignment` — called when shop marks "ready for pickup"; inserts broadcast rows for online partners in the shop's city; sends realtime notifications.
- `deliverypartner-accept-assignment` — atomic first-accept-wins; cancels siblings.

## 3. Frontend

### Auth
- `RoleSelect` gets a third card: "Become a Delivery Partner".
- `Auth.tsx`: `intent=delivery_partner` branch; on signup redirects to `/delivery/register`.

### Registration
- `pages/DeliveryPartnerRegister.tsx` — multi-section form matching every field in the spec, with file uploads to the private bucket. Submits → `delivery_partners` row with `status='pending'`. Shows "Application submitted — awaiting verification" screen.

### Delivery Partner Dashboard (`/delivery`)
- Tabs: Available, Assigned, Active, Return Pickups, History, Earnings, Profile, Documents.
- Online/Offline toggle in header (writes `is_online`).
- Realtime subscription to `delivery_assignments` for this partner.
- Order card: pickup address, delivery address, "Call Shop", "Call Customer", "Open in Maps" (`https://maps.google.com/?q=...`), Accept/Reject, "Mark Picked Up", "Enter OTP".
- OTP entry uses `InputOTP`; verifies via edge function.

### Customer
- `MyRentals` / `TrackOrder`: shows delivery partner name + phone + live status when assigned. New "Show Delivery OTP" button that calls `generate-otp` and displays a 6-digit code with 15-minute expiry. Same for Return OTP on the return date.

### Shop Owner
- `VendorOrders`: "Mark Ready for Pickup" button (replaces current dispatch flow). On click → sets status + triggers broadcast function.
- Remove `VendorQRVerify` from vendor dashboard and its route mount. Keep the file to avoid other imports breaking — mark deprecated.
- On return: inspect + "Mark Completed" button.

### Admin
- New `AdminDeliveryPartnersPanel` under `pages/Admin.tsx` tab "Delivery Partners":
  - List pending / approved / rejected / suspended.
  - Detail drawer: personal info, all doc previews (signed URLs), contact links, Approve / Reject (+ reason) / Suspend / Reactivate buttons.
  - Approval grants `delivery_partner` role via `admin_set_user_role`.

### Notifications
- Extend `notification_type` enum with `delivery_update`.
- DB triggers on `delivery_assignments` and `rentals` insert into `notifications` for the right audiences per the spec matrix.

## 4. Removal of shop QR

- Remove `VendorQRVerify` mount from Vendor page.
- Remove `verify-rental-qr` invocations from vendor UI.
- Keep the edge function + `qr_token` column intact (no schema removal) so existing rentals don't break. Just no UI entry point.

## 5. Testing

- Manual smoke via Playwright: register partner → admin approves → shop marks ready → partner accepts → OTP delivery → OTP return → completion.
- Run `tsgo` and `bunx vitest run` after edits.
- Verify Auth, Google login, Razorpay checkout, existing rentals list, admin dashboard all still load.

## Technical notes

- OTP codes: `crypto.randomInt(100000, 1000000)`, stored as SHA-256 hash + salt in `code_hash`, 15-minute TTL.
- Broadcast eligibility: `is_online = true AND status='approved' AND city = shop.city`. If none available, shop sees "No partners online — admin will assign manually" and admin can force-assign.
- All new tables: `GRANT SELECT/INSERT/UPDATE ON ... TO authenticated; GRANT ALL TO service_role;` plus RLS scoped by `auth.uid()` or `has_role`.
- Design: reuse existing card, badge, tabs, InputOTP, and rose/cream token palette — no new colors.
- File uploads: 5MB limit per doc, image/pdf only, client-side validation.
- Estimated: 1 migration, 4 edge functions, ~12 new frontend files, ~6 edits to existing files.

Reply "approve" (or with tweaks) and I'll build it.
