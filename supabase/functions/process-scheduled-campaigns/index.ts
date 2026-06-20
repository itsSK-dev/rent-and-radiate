import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function decodeJwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json);
    return claims?.role ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Only the service role (cron / internal scheduler) may invoke this.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const role = decodeJwtRole(token);
  if (role !== "service_role") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: due } = await admin
    .from("notification_campaigns").select("id")
    .eq("status", "scheduled").lte("scheduled_for", new Date().toISOString()).limit(20);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const c of due ?? []) {
    try {
      const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ campaign_id: c.id }),
      });
      results.push({ id: c.id, ok: resp.ok, error: resp.ok ? undefined : await resp.text() });
    } catch (e) {
      results.push({ id: c.id, ok: false, error: String(e) });
    }
  }
  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
