// Admin-only edge function to process a Razorpay refund for a returned rental.
// Verifies the caller is an admin, calls Razorpay's refund API, and updates
// the deposit_refunds row with the refund_id / refunded_at / status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    // Verify caller is an admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const { refundId, adminNotes } = body ?? {};
    if (!refundId || typeof refundId !== "string") {
      return json({ error: "refundId required" }, 400);
    }

    // Load refund + rental
    const { data: refund, error: refErr } = await admin
      .from("deposit_refunds")
      .select("id, rental_id, refund_amount, status, razorpay_refund_id")
      .eq("id", refundId)
      .maybeSingle();
    if (refErr || !refund) return json({ error: "Refund not found" }, 404);

    if (refund.status === "completed" && refund.razorpay_refund_id) {
      return json({ ok: true, status: "completed", razorpay_refund_id: refund.razorpay_refund_id });
    }
    if (!["pending_admin", "approved", "failed"].includes(refund.status)) {
      return json({ error: `Cannot process refund in status "${refund.status}"` }, 400);
    }
    if (Number(refund.refund_amount) <= 0) {
      // Nothing to refund — just mark approved/completed
      await admin.from("deposit_refunds").update({
        status: "completed",
        reviewed_by: userData.user.id,
        reviewed_at: new Date().toISOString(),
        refunded_at: new Date().toISOString(),
        admin_notes: adminNotes ?? null,
      }).eq("id", refundId);
      return json({ ok: true, status: "completed", note: "Zero refund amount" });
    }

    const { data: rental, error: renErr } = await admin
      .from("rentals")
      .select("id, razorpay_payment_id, payment_method")
      .eq("id", refund.rental_id)
      .maybeSingle();
    if (renErr || !rental) return json({ error: "Rental not found" }, 404);

    // Mark approved + processing first so customer gets timely notifications
    await admin.from("deposit_refunds").update({
      status: "approved",
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes ?? null,
    }).eq("id", refundId);

    // If payment was COD / non-razorpay, mark completed manually
    if (!rental.razorpay_payment_id) {
      await admin.from("deposit_refunds").update({
        status: "completed",
        refunded_at: new Date().toISOString(),
        admin_notes: (adminNotes ? adminNotes + " · " : "")
          + "Manual refund (no Razorpay payment on file).",
      }).eq("id", refundId);
      return json({ ok: true, status: "completed", note: "Manual refund recorded (no Razorpay payment)." });
    }

    await admin.from("deposit_refunds").update({ status: "processing" }).eq("id", refundId);

    // Call Razorpay refund API
    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const auth = btoa(`${keyId}:${keySecret}`);
    const amountPaise = Math.round(Number(refund.refund_amount) * 100);

    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/payments/${rental.razorpay_payment_id}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          speed: "normal",
          notes: {
            rental_id: rental.id,
            refund_id: refundId,
            approved_by: userData.user.id,
          },
        }),
      },
    );

    const rzpJson = await rzpRes.json().catch(() => ({}));

    if (!rzpRes.ok) {
      const reason = rzpJson?.error?.description || rzpJson?.error?.reason || `Razorpay error ${rzpRes.status}`;
      await admin.from("deposit_refunds").update({
        status: "failed",
        refund_failure_reason: reason,
      }).eq("id", refundId);
      return json({ ok: false, error: reason }, 502);
    }

    await admin.from("deposit_refunds").update({
      status: "completed",
      razorpay_refund_id: rzpJson.id ?? null,
      refunded_at: new Date().toISOString(),
    }).eq("id", refundId);

    return json({ ok: true, status: "completed", razorpay_refund_id: rzpJson.id });
  } catch (e) {
    console.error("admin-process-refund error", e);
    return json({ error: (e as Error).message ?? "Internal error" }, 500);
  }
});
