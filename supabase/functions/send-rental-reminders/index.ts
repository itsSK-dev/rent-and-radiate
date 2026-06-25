// Schedules return reminder notifications. Triggered by pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeJwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json)?.role ?? null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Only service_role (pg_cron) may invoke. verify_jwt=true ensures the token
  // is gateway-validated; we then enforce the role claim.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (decodeJwtRole(token) !== "service_role") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: due, error } = await supabase
    .from("rental_reminders")
    .select("id, rental_id, hours_before, due_at, rental:rentals(customer_id, end_date, product:products(title, images), store:stores(name))")
    .is("sent_at", null)
    .eq("status", "pending")
    .lte("due_at", new Date().toISOString())
    .limit(200);

  if (error) {
    console.error("reminder query failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let sent = 0;
  for (const r of due ?? []) {
    const rental: any = (r as any).rental;
    if (!rental) {
      await supabase.from("rental_reminders").update({ status: "skipped", sent_at: new Date().toISOString() }).eq("id", (r as any).id);
      continue;
    }
    const img = rental.product?.images?.[0] ?? null;
    const title = rental.product?.title ?? "your rental";
    const hrs = (r as any).hours_before;
    const dueLabel = hrs >= 24 ? `${Math.round(hrs / 24)} day${hrs >= 48 ? "s" : ""}` : `${hrs} hour${hrs === 1 ? "" : "s"}`;
    await supabase.rpc("create_notification", {
      _user_id: rental.customer_id,
      _type: "rental_update",
      _title: `⏰ Return ${title} in ${dueLabel}`,
      _body: `Return is due ${rental.end_date}. Avoid late fees by returning on time.`,
      _link_url: "/my-rentals",
      _image_url: img,
      _metadata: { rental_id: (r as any).rental_id, hours_before: hrs },
    });
    await supabase.from("rental_reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", (r as any).id);
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
