import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface SendBody { campaign_id: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Auth: caller must be admin (or service role via cron)
    const authHeader = req.headers.get("Authorization") ?? "";
    const isService = authHeader.includes(SERVICE_KEY);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (!isService) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);
      const { data: roleRow } = await admin
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleRow) return json({ error: "forbidden" }, 403);
    }

    const { campaign_id } = (await req.json()) as SendBody;
    if (!campaign_id) return json({ error: "campaign_id required" }, 400);

    const { data: c, error: cErr } = await admin
      .from("notification_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (cErr || !c) return json({ error: cErr?.message ?? "not found" }, 404);
    if (c.status === "sent" || c.status === "sending") {
      return json({ error: `campaign already ${c.status}` }, 400);
    }

    await admin.from("notification_campaigns").update({ status: "sending" }).eq("id", campaign_id);

    // Resolve audience -> user_ids
    const filter = (c.audience_filter ?? {}) as Record<string, unknown>;
    let userIds: string[] = [];

    if (c.audience_type === "all") {
      const { data } = await admin.from("notification_preferences")
        .select("user_id").eq("promotional", true);
      userIds = (data ?? []).map((r) => r.user_id);
    } else if (c.audience_type === "selected") {
      userIds = (filter.user_ids as string[]) ?? [];
    } else if (c.audience_type === "city") {
      const city = String(filter.city ?? "").trim();
      if (city) {
        const { data } = await admin.from("rentals")
          .select("customer_id").ilike("address", `%${city}%`);
        userIds = [...new Set((data ?? []).map((r) => r.customer_id))];
      }
    } else if (c.audience_type === "category") {
      const cat = String(filter.category ?? "");
      if (cat) {
        const { data } = await admin.from("rentals")
          .select("customer_id, products!inner(category)")
          .eq("products.category", cat);
        userIds = [...new Set((data ?? []).map((r: any) => r.customer_id))];
      }
    }

    userIds = [...new Set(userIds.filter(Boolean))];

    if (userIds.length === 0) {
      await admin.from("notification_campaigns").update({
        status: "sent", sent_at: new Date().toISOString(), recipient_count: 0,
      }).eq("id", campaign_id);
      return json({ ok: true, recipient_count: 0 });
    }

    // Bulk insert notifications
    const rows = userIds.map((uid) => ({
      user_id: uid,
      type: c.type,
      title: c.title,
      body: c.body,
      link_url: c.link_url,
      image_url: c.image_url,
      metadata: { campaign_id: c.id },
    }));
    // Chunk inserts to avoid payload limits
    const chunk = 500;
    const recipientRows: { campaign_id: string; user_id: string; notification_id: string }[] = [];
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const { data: inserted, error } = await admin
        .from("notifications").insert(slice).select("id, user_id");
      if (error) throw error;
      for (const r of inserted ?? []) {
        recipientRows.push({ campaign_id: c.id, user_id: r.user_id, notification_id: r.id });
      }
    }
    if (recipientRows.length > 0) {
      for (let i = 0; i < recipientRows.length; i += chunk) {
        await admin.from("notification_campaign_recipients").insert(recipientRows.slice(i, i + chunk));
      }
    }

    await admin.from("notification_campaigns").update({
      status: "sent", sent_at: new Date().toISOString(), recipient_count: userIds.length,
    }).eq("id", campaign_id);

    return json({ ok: true, recipient_count: userIds.length });
  } catch (e) {
    console.error("send-campaign error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
