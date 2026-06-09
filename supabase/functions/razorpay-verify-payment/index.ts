import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const ip = req.headers.get("x-forwarded-for");
  const ua = req.headers.get("user-agent");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const {
      rentalId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      method,
      failure,
    } = body ?? {};

    if (!rentalId) return json({ error: "rentalId required" }, 400);

    const { data: rental, error: rErr } = await admin
      .from("rentals")
      .select("id, customer_id, grand_total, razorpay_order_id")
      .eq("id", rentalId)
      .maybeSingle();
    if (rErr || !rental) {
      await logAttempt(admin, { rental_id: rentalId, user_id: userId, outcome: "not_found", reason: "Rental not found", ip, ua });
      return json({ error: "Rental not found" }, 404);
    }
    if (rental.customer_id !== userId) {
      await logAttempt(admin, { rental_id: rentalId, user_id: userId, outcome: "forbidden", reason: "Not order owner", ip, ua });
      return json({ error: "Forbidden" }, 403);
    }

    // Guard against payment-credential replay across rentals: the submitted
    // order ID must match the one we created on Razorpay for this rental.
    if (
      razorpay_order_id &&
      rental.razorpay_order_id &&
      rental.razorpay_order_id !== razorpay_order_id
    ) {
      await logAttempt(admin, {
        rental_id: rentalId,
        user_id: userId,
        outcome: "order_id_mismatch",
        reason: "Submitted razorpay_order_id does not match rental",
        razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id ?? null,
        amount: rental.grand_total,
        ip, ua,
      });
      return json({ error: "Order ID mismatch" }, 400);
    }

    // Failure path
    if (failure || !razorpay_payment_id || !razorpay_signature) {
      await admin.from("payments").insert({
        rental_id: rentalId,
        user_id: userId,
        provider: "razorpay",
        method: method ?? "unknown",
        razorpay_order_id: razorpay_order_id ?? rental.razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id ?? null,
        amount: rental.grand_total,
        currency: "INR",
        status: "failed",
        error_code: failure?.code ?? null,
        error_description: failure?.description ?? "Payment cancelled or failed",
        raw: failure ?? null,
      });
      await logAttempt(admin, {
        rental_id: rentalId,
        user_id: userId,
        outcome: "failed",
        reason: failure?.description ?? "Payment cancelled or failed",
        razorpay_order_id: razorpay_order_id ?? rental.razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id ?? null,
        amount: rental.grand_total,
        raw: failure ?? null,
        ip, ua,
      });
      return json({ ok: false, status: "failed" });
    }

    // HMAC verify
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const expected = createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      await admin.from("payments").insert({
        rental_id: rentalId,
        user_id: userId,
        provider: "razorpay",
        method: method ?? "unknown",
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount: rental.grand_total,
        currency: "INR",
        status: "invalid_signature",
        error_description: "Signature verification failed",
      });
      await logAttempt(admin, {
        rental_id: rentalId,
        user_id: userId,
        outcome: "invalid_signature",
        reason: "HMAC signature mismatch",
        razorpay_order_id,
        razorpay_payment_id,
        amount: rental.grand_total,
        ip, ua,
      });
      return json({ ok: false, error: "Invalid signature" }, 400);
    }

    // Success
    const { error: upErr } = await admin
      .from("rentals")
      .update({
        payment_status: "paid",
        status: "confirmed",
        razorpay_payment_id,
        razorpay_signature,
        payment_method: "razorpay",
      })
      .eq("id", rentalId);
    if (upErr) console.error("Rental update error:", upErr);

    await admin.from("payments").insert({
      rental_id: rentalId,
      user_id: userId,
      provider: "razorpay",
      method: method ?? "razorpay",
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount: rental.grand_total,
      currency: "INR",
      status: "paid",
    });

    await logAttempt(admin, {
      rental_id: rentalId,
      user_id: userId,
      outcome: "success",
      razorpay_order_id,
      razorpay_payment_id,
      amount: rental.grand_total,
      ip, ua,
    });

    return json({ ok: true, status: "paid" });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});

async function logAttempt(admin: any, opts: {
  rental_id: string;
  user_id: string;
  outcome: string;
  reason?: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  amount?: number | null;
  raw?: unknown;
  ip?: string | null;
  ua?: string | null;
}) {
  try {
    await admin.from("payment_verification_attempts").insert({
      rental_id: opts.rental_id,
      user_id: opts.user_id,
      provider: "razorpay",
      outcome: opts.outcome,
      reason: opts.reason ?? null,
      razorpay_order_id: opts.razorpay_order_id ?? null,
      razorpay_payment_id: opts.razorpay_payment_id ?? null,
      amount: opts.amount ?? null,
      raw: opts.raw ?? null,
      ip: opts.ip ?? null,
      user_agent: opts.ua ?? null,
    });
  } catch (e) {
    console.error("logAttempt error:", e);
  }
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
