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
      .select("id, customer_id, grand_total, payment_status")
      .eq("id", rentalId)
      .maybeSingle();
    if (rErr || !rental) return json({ error: "Rental not found" }, 404);
    if (rental.customer_id !== userId) return json({ error: "Forbidden" }, 403);
    if (rental.payment_status === "paid") return json({ error: "Already paid" }, 400);

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const amountPaise = Math.round(Number(rental.grand_total) * 100);

    const auth = btoa(`${keyId}:${keySecret}`);
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

    // Save order id on rental
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin
      .from("rentals")
      .update({ razorpay_order_id: orderData.id, payment_method: "razorpay" })
      .eq("id", rentalId);

    return json({
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId,
    });
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
