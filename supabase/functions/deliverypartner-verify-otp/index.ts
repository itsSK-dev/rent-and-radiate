// Delivery partner submits the 6-digit OTP the customer received.
// Verification is the ONLY way a delivery/return handoff is completed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return j({ error: "Not authenticated" }, 401);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: ures } = await userClient.auth.getUser();
  const userId = ures?.user?.id;
  if (!userId) return j({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const rentalId = String(body?.rentalId ?? "");
  const kind = String(body?.kind ?? "delivery");
  const code = String(body?.code ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(rentalId)) return j({ error: "Invalid rental id" }, 400);
  if (!/^\d{6}$/.test(code)) return j({ error: "OTP must be 6 digits" }, 400);
  if (kind !== "delivery" && kind !== "return") return j({ error: "Invalid kind" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: dp } = await admin.from("delivery_partners").select("id, status").eq("user_id", userId).maybeSingle();
  if (!dp || dp.status !== "approved") return j({ error: "Not an approved delivery partner" }, 403);

  const { data: assignment } = await admin.from("delivery_assignments")
    .select("id, status").eq("rental_id", rentalId).eq("partner_id", dp.id).maybeSingle();
  if (!assignment) return j({ error: "You are not assigned to this order" }, 403);

  const { data: rental } = await admin.from("rentals")
    .select("id, customer_id, status").eq("id", rentalId).maybeSingle();
  if (!rental) return j({ error: "Order not found" }, 404);

  console.log(`[otp] verify rental=${rentalId} kind=${kind} partner=${dp.id} assignment=${assignment.status} rental_status=${rental.status}`);

  // Latest OTP issued for this order + kind + customer.
  const { data: otp } = await admin.from("delivery_otps")
    .select("id, code_hash, expires_at, verified_at, attempts, customer_id")
    .eq("rental_id", rentalId).eq("kind", kind)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!otp) {
    console.log(`[otp] no OTP record for rental=${rentalId} kind=${kind}`);
    return j({ error: "No OTP has been sent yet. Tap Resend OTP to send one to the customer." }, 400);
  }
  if (otp.customer_id && otp.customer_id !== rental.customer_id) {
    console.error(`[otp] customer mismatch on rental=${rentalId}`);
    return j({ error: "This OTP does not belong to this order." }, 403);
  }
  if (otp.verified_at) return j({ error: "This OTP was already used. Please resend a new OTP." }, 400);
  if (new Date(otp.expires_at).getTime() < Date.now()) return j({ error: "OTP has expired. Please resend a new OTP." }, 400);
  if ((otp.attempts ?? 0) >= MAX_ATTEMPTS) {
    return j({ error: "Too many incorrect attempts. Please resend a new OTP." }, 429);
  }

  if (otp.code_hash !== (await sha256Hex(code))) {
    const attempts = (otp.attempts ?? 0) + 1;
    await admin.from("delivery_otps").update({ attempts }).eq("id", otp.id);
    const left = MAX_ATTEMPTS - attempts;
    console.log(`[otp] incorrect code for rental=${rentalId} attempts=${attempts}`);
    return j({
      error: left > 0
        ? `Incorrect OTP. Please check the OTP sent to the customer and try again. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many incorrect attempts. Please resend a new OTP.",
    }, 400);
  }

  const now = new Date().toISOString();
  // Single-use: only the first caller to flip verified_at wins.
  const { data: claimed } = await admin.from("delivery_otps")
    .update({ verified_at: now, attempts: (otp.attempts ?? 0) + 1, verified_by_partner_id: dp.id, code_plain: null })
    .eq("id", otp.id).is("verified_at", null).select("id");
  if (!claimed || claimed.length === 0) return j({ error: "This OTP was already used. Please resend a new OTP." }, 400);

  // Stamp the verification on the order BEFORE advancing status: the delivered
  // guard accepts an OTP-verified handoff in place of a store proof photo.
  const { error: stampErr } = await admin.from("rentals").update(
    kind === "delivery"
      ? { delivery_verified_at: now, delivery_verified_by: dp.id }
      : { return_verified_at: now, return_verified_by: dp.id },
  ).eq("id", rentalId);
  if (stampErr) {
    console.error("[otp] verification stamp failed:", stampErr.message);
    await admin.from("delivery_otps").update({ verified_at: null }).eq("id", otp.id);
    return j({ error: stampErr.message }, 500);
  }

  const nextStatus = kind === "delivery" ? "delivered" : "return_picked_up";
  const { error: updErr } = await admin.from("delivery_assignments")
    .update({ status: nextStatus }).eq("id", assignment.id);
  if (updErr) {
    console.error(`[otp] assignment update failed for rental=${rentalId}:`, updErr.message);
    // Release the OTP so the partner can retry once the blocker is cleared.
    await admin.from("delivery_otps").update({ verified_at: null, verified_by_partner_id: null }).eq("id", otp.id);
    await admin.from("rentals").update(
      kind === "delivery" ? { delivery_verified_at: null, delivery_verified_by: null }
                          : { return_verified_at: null, return_verified_by: null },
    ).eq("id", rentalId);
    return j({ error: updErr.message }, 400);
  }

  const { data: after } = await admin.from("rentals").select("status").eq("id", rentalId).maybeSingle();
  console.log(`[otp] verified rental=${rentalId} kind=${kind} status ${rental.status} -> ${after?.status}`);

  return j({ ok: true, status: nextStatus, rentalStatus: after?.status, verifiedAt: now });
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
