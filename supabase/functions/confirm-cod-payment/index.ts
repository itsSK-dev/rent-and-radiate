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
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const rentalId = String(body?.rentalId ?? "");
    const mode: "cod" | "pay_at_store" =
      body?.mode === "pay_at_store" ? "pay_at_store" : "cod";
    if (!rentalId) return json({ error: "rentalId required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rental, error: rErr } = await admin
      .from("rentals")
      .select("id, customer_id, payment_status, grand_total, kind")
      .eq("id", rentalId)
      .maybeSingle();
    if (rErr || !rental) return logAndJson(admin, rentalId, userId, mode, "not_found", "Rental not found", 404);
    if (rental.customer_id !== userId) return logAndJson(admin, rentalId, userId, mode, "forbidden", "Not your order", 403);
    if (!["unpaid", "verification_failed"].includes(rental.payment_status)) {
      return logAndJson(admin, rentalId, userId, mode, "failed", `Cannot switch to ${mode} from ${rental.payment_status}`, 400);
    }
    if (mode === "cod" && rental.kind !== "buy") {
      return logAndJson(admin, rentalId, userId, mode, "failed", "Cash on delivery is available for purchases only", 400);
    }

    const { error: upErr } = await admin
      .from("rentals")
      .update({
        // 'cod' is the only deferred-cash payment_status enum; the
        // payment_method column distinguishes COD vs pay-at-store for admins.
        payment_status: "cod",
        payment_method: mode,
        status: "confirmed",
      })
      .eq("id", rentalId);
    if (upErr) return logAndJson(admin, rentalId, userId, mode, "error", upErr.message, 500);

    await admin.from("payment_verification_attempts").insert({
      rental_id: rentalId,
      user_id: userId,
      provider: mode,
      outcome: "success",
      amount: rental.grand_total,
      ip: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});

async function logAndJson(admin: any, rentalId: string, userId: string, provider: string, outcome: string, reason: string, status: number) {
  await admin.from("payment_verification_attempts").insert({
    rental_id: rentalId || null,
    user_id: userId,
    provider,
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
