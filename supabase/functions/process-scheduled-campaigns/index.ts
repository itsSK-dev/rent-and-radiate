import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
