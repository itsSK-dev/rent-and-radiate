import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

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
    const rentalId = String(body?.rentalId ?? "");
    if (!rentalId) return json({ error: "rentalId required" }, 400);

    // Load rental and verify ownership
    const { data: rental, error: rErr } = await supabase
      .from("rentals")
      .select("id, customer_id, grand_total, payment_status, razorpay_order_id")
      .eq("id", rentalId)
      .maybeSingle();
    if (rErr || !rental) return json({ error: "Rental not found" }, 404);
    if (rental.customer_id !== userId) return json({ error: "Forbidden" }, 403);
    if (rental.payment_status === "paid") return json({ error: "Already paid" }, 400);

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const amountPaise = Math.round(Number(rental.grand_total) * 100);
    const auth = btoa(`${keyId}:${keySecret}`);

    // ---- Idempotency: reuse an existing reusable order ----
    if (rental.razorpay_order_id) {
      const existingRes = await fetch(
        `https://api.razorpay.com/v1/orders/${rental.razorpay_order_id}`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
      if (existingRes.ok) {
        const existing = await existingRes.json();
        // 'created' or 'attempted' orders that match the current amount/currency
        // are still payable — reuse them instead of creating a duplicate.
        const reusable =
          (existing.status === "created" || existing.status === "attempted") &&
          Number(existing.amount) === amountPaise &&
          existing.currency === "INR";
        if (reusable) {
          return json({
            orderId: existing.id,
            amount: existing.amount,
            currency: existing.currency,
            keyId,
            reused: true,
          });
        }
        // If the existing order is already 'paid', short-circuit.
        if (existing.status === "paid") {
          return json({ error: "Already paid" }, 400);
        }
        // Otherwise (amount changed, etc.) fall through to create a fresh one.
      }
      // If the lookup failed (e.g. test/live key swap), also fall through.
    }

    // ---- Create a new order, scoped by a deterministic receipt ----
    // Razorpay treats receipt as a client-side reference; combined with
    // a short suffix this gives us traceability without forbidding retries
    // when the previous order is no longer reusable.
    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `rental_${rentalId.slice(0, 30)}`,
        notes: { rental_id: rentalId, user_id: userId },
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      console.error("Razorpay order create failed:", orderData);
      return json({ error: "Failed to create order", details: orderData }, 500);
    }

    // Persist the order id on the rental (admin client to bypass RLS update perms).
    // Conditional update: only set if still empty OR matches an obsolete order — this
    // prevents races where two concurrent invocations both write different ids.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: updated, error: updErr } = await admin
      .from("rentals")
      .update({ razorpay_order_id: orderData.id, payment_method: "razorpay" })
      .eq("id", rentalId)
      // Race guard: only overwrite if it still matches what we read at the start.
      .or(`razorpay_order_id.is.null,razorpay_order_id.eq.${rental.razorpay_order_id ?? "null"}`)
      .select("razorpay_order_id")
      .maybeSingle();

    if (updErr) console.error("rental update error:", updErr);

    // If a parallel request beat us to it, prefer the stored order id.
    if (updated && updated.razorpay_order_id && updated.razorpay_order_id !== orderData.id) {
      const winnerRes = await fetch(
        `https://api.razorpay.com/v1/orders/${updated.razorpay_order_id}`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
      if (winnerRes.ok) {
        const winner = await winnerRes.json();
        return json({
          orderId: winner.id,
          amount: winner.amount,
          currency: winner.currency,
          keyId,
          reused: true,
        });
      }
    }

    return json({
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId,
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
