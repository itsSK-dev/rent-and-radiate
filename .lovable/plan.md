# Set up email infrastructure for notify.rentandradiate.com

Your sender domain `notify.rentandradiate.com` is already verified. Next step is to provision the shared email infrastructure so the app can actually send OTP and notification emails.

## What gets set up

- **Email queue (pgmq)** with two priority queues: `auth_emails` (high) and `transactional_emails` (normal)
- **Database tables**: `email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`
- **Dispatcher edge function** `process-email-queue` that drains the queue with retry, rate-limit backoff, TTL expiry, and dead-letter routing
- **pg_cron job** running every 5 seconds to process queued emails
- **Vault secret** so the cron job can authenticate to the dispatcher
- Default throughput: ~120 emails/min (tunable later via `email_send_state`)

## After infrastructure is ready

Since your goal is the shop verification OTP flow, the natural next steps (separate plan / next message) are:

1. Scaffold transactional email sender (`send-transactional-email`) so we can send the OTP + shop details to `mishragaurav161718@gmail.com`
2. Build the OTP verification DB schema (store status enum: Pending Verification / Payment Pending / Verified / Rejected, OTP hash, expiry, attempt counter)
3. Edge functions: `generate-shop-otp` (on registration) and `verify-shop-otp`
4. Vendor-side OTP entry UI + admin approve/reject controls + product upload gating until `Verified`
5. Account-deletion flow for store owners

## Scope of this step

Only the shared email infrastructure provisioning. No app code or schema changes for the OTP flow yet — those come in the next plan once email sending is live.