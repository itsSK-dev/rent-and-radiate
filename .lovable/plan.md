# Brand Collaboration & Advertising Module

Build an end-to-end advertising/partnership system for Rent & Radiate with public marketing pages, an advertiser portal, and admin management.

## Scope

### 1. Public page — `/advertise` (Brand Collaboration Hub)
- Hero with "Advertise With Us" headline, subtitle, and **Run Your Ad** CTA → `/advertise/book`
- Stats strip (app users, monthly views, engagement %, reach) — values pulled from a new `ad_platform_stats` settings row admins can edit
- Packages grid: Basic / Premium / Featured (price, duration, perks) — read from `ad_packages` table
- Current brand partners / sponsored ads carousel — read from active `advertisements` rows
- Benefits grid (targeted audience, high visibility, affordable, performance tracking)
- FAQ accordion for advertisers
- Contact block: email `partnerships@rentandradiate.com`, WhatsApp button, Contact Us button

### 2. Advertiser form — `/advertise/book`
- Auth required; redirects to `/auth?next=/advertise/book`
- Fields: company name, contact person, email, mobile, website (optional), ad type (Banner / Featured Listing / Sponsored Product / Homepage Promotion / Custom), duration (days), budget, description, package (optional), logo/image upload
- Buttons: **Submit Request** and **Save Draft** (status = `draft` vs `pending`)
- Validated with zod; uploads go to a new `advertiser-assets` storage bucket

### 3. Advertiser portal — `/my-advertisements`
- Lists the user's ad requests with: request status, payment status (unpaid/paid/refunded), campaign start/end dates, set price, package
- Per-row actions: view detail, download invoice (HTML→print PDF), contact support, edit draft
- Status timeline rendered from `ad_request_status_history`

### 4. Admin tab — `/admin` → "Ads" tab
- List all ad requests with filters by status
- Approve / Reject / Request Changes (with admin note)
- Set price manually, assign package, set start/end dates
- Upload/replace creative, mark payment received, activate ad
- Manage `ad_packages` (CRUD) and `ad_platform_stats` (edit displayed numbers)
- Manage which advertisements are visible on the public hub

### 5. Email notification
- Trigger edge function `notify-ad-request` on insert/status change → emails admin (`partnerships@…`) for every new request and emails advertiser on approve/reject/changes.

## Technical details

### New tables (all in `public`, with GRANTs + RLS)
- `ad_packages` — `name`, `tier` (basic/premium/featured), `price`, `duration_days`, `perks[]`, `is_active`, `sort_order`. Public SELECT, admin write.
- `ad_platform_stats` — single-row settings (id boolean true): `users_count`, `monthly_views`, `engagement_pct`, `reach_count`, `partners_count`. Public SELECT, admin write.
- `advertisement_requests` — `advertiser_id`, `company_name`, `contact_person`, `email`, `mobile`, `website`, `ad_type` (enum), `duration_days`, `budget`, `description`, `logo_url`, `package_id` (nullable), `status` (draft/pending/changes_requested/approved/rejected/active/completed), `admin_notes`, `set_price`, `payment_status` (unpaid/paid/refunded), `start_date`, `end_date`, `creative_url`, timestamps. RLS: advertiser sees own, admin sees all.
- `ad_request_status_history` — trigger-populated audit. Parties + admin SELECT.
- `advertisements` — published live ads shown on hub: `request_id`, `image_url`, `link_url`, `headline`, `sort_order`, `is_active`. Public SELECT where active, admin write.

### Storage
- New private bucket `advertiser-assets` for logos/creatives. RLS: advertiser can upload to their own folder; admins read all; public hub uses signed URLs via existing `proofUrl` pattern (or a new `adAssetUrl` helper).

### Frontend files (new)
- `src/pages/Advertise.tsx` — public hub
- `src/pages/AdvertiseBook.tsx` — booking form (zod + react-hook-form)
- `src/pages/MyAdvertisements.tsx` — advertiser portal + invoice print view
- `src/components/AdminAdsPanel.tsx` — admin tab content (requests + packages + stats + live ads sub-tabs)
- Routes added in `src/App.tsx`; Navbar/Footer links updated; Admin gets new "Ads" tab.

### Edge function
- `supabase/functions/notify-ad-request/index.ts` — sends transactional emails on new request + status changes via existing `send-transactional-email` infrastructure.

### Design
- Reuse existing rose/blossom design tokens, gradient-rose hero buttons, rounded-3xl cards, soft shadows — consistent with the rest of the app. Mobile-first responsive layouts throughout.

## Out of scope (for this round)
- Online payment for ads (admin marks payment received manually). Razorpay flow for ad payments can be a follow-up.
- Click/impression tracking analytics beyond admin-editable stat numbers.
