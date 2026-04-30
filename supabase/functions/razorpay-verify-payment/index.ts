import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const {
      rentalId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      method, // optional ('card','upi','netbanking', etc.)
      failure, // optional error info if payment failed
    } = body ?? {};

    if (!rentalId) return json({ error: "rentalId required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load rental
    const { data: rental, error: rErr } = await admin
      .from("rentals")
      .select("id, customer_id, grand_total, razorpay_order_id")
      .eq("id", rentalId)
      .maybeSingle();
    if (rErr || !rental) return json({ error: "Rental not found" }, 404);
    if (rental.customer_id !== userId) return json({ error: "Forbidden" }, 403);

    // Failure path — log and return
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
      return json({ ok: false, status: "failed" });
    }

    // Verify signature: HMAC-SHA256(order_id|payment_id, key_secret)
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
      return json({ ok: false, error: "Invalid signature" }, 400);
    }

    // Success — update rental + log
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

    return json({ ok: true, status: "paid" });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
