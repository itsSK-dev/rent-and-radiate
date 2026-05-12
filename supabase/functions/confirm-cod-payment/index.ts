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

    const body = await req.json().catch(() => ({}));
    const rentalId = String(body?.rentalId ?? "");
    if (!rentalId) return json({ error: "rentalId required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rental, error: rErr } = await admin
      .from("rentals")
      .select("id, customer_id, payment_status, grand_total")
      .eq("id", rentalId)
      .maybeSingle();
    if (rErr || !rental) return logAndJson(admin, rentalId, userId, "not_found", "Rental not found", 404);
    if (rental.customer_id !== userId) return logAndJson(admin, rentalId, userId, "forbidden", "Not your order", 403);
    if (!["unpaid", "verification_failed"].includes(rental.payment_status)) {
      return logAndJson(admin, rentalId, userId, "failed", `Cannot switch to COD from ${rental.payment_status}`, 400);
    }

    const { error: upErr } = await admin
      .from("rentals")
      .update({
        payment_status: "cod",
        payment_method: "cod",
        status: "confirmed",
      })
      .eq("id", rentalId);
    if (upErr) return logAndJson(admin, rentalId, userId, "error", upErr.message, 500);

    await admin.from("payment_verification_attempts").insert({
      rental_id: rentalId,
      user_id: userId,
      provider: "cod",
      outcome: "success",
      amount: rental.grand_total,
      ip: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function logAndJson(admin: any, rentalId: string, userId: string, outcome: string, reason: string, status: number) {
  await admin.from("payment_verification_attempts").insert({
    rental_id: rentalId || null,
    user_id: userId,
    provider: "cod",
    outcome,
    reason,
  });
  return json({ error: reason }, status);
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
