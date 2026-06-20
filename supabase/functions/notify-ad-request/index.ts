import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = "partnerships@rentandradiate.com";

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { request_id, event } = await req.json();
    if (!request_id || typeof request_id !== "string") {
      return new Response(JSON.stringify({ error: "request_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Authorization: caller must be the advertiser (owner) or an admin
    const { data: isAdminData } = await supabase.rpc("has_role", {
      _user_id: userId, _role: "admin",
    });
    const isAdmin = !!isAdminData;

    const { data: r, error } = await supabase
      .from("advertisement_requests")
      .select("*")
      .eq("id", request_id)
      .maybeSingle();
    if (error || !r) {
      return new Response(JSON.stringify({ error: error?.message ?? "not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin && r.advertiser_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject =
      event === "submitted"
        ? `New advertisement request: ${esc(r.company_name)}`
        : `Advertisement update — ${esc(r.company_name)} (${esc(r.status)})`;

    const html = `
      <h2>${subject}</h2>
      <p><strong>Brand:</strong> ${esc(r.company_name)}</p>
      <p><strong>Contact:</strong> ${esc(r.contact_person)} — ${esc(r.email)} / ${esc(r.mobile)}</p>
      <p><strong>Type:</strong> ${esc(r.ad_type)}</p>
      <p><strong>Duration:</strong> ${esc(r.duration_days)} days</p>
      <p><strong>Budget:</strong> ₹${esc(Number(r.budget).toLocaleString("en-IN"))}</p>
      <p><strong>Status:</strong> ${esc(r.status)} · <strong>Payment:</strong> ${esc(r.payment_status)}</p>
      ${r.description ? `<p><strong>Description:</strong><br/>${esc(r.description)}</p>` : ""}
      ${r.admin_notes ? `<p><strong>Admin notes:</strong><br/>${esc(r.admin_notes)}</p>` : ""}
    `;

    // Notify admin partnerships inbox
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "ad-request-admin-notification",
        recipientEmail: ADMIN_EMAIL,
        idempotencyKey: `ad-${request_id}-${event}-admin`,
        templateData: { subject, html, brand: r.company_name },
      },
    }).catch(() => null);

    // Notify advertiser on status changes
    if (event !== "submitted") {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "ad-request-status-update",
          recipientEmail: r.email,
          idempotencyKey: `ad-${request_id}-${event}-advertiser`,
          templateData: {
            brand: r.company_name,
            status: r.status,
            adminNotes: r.admin_notes ?? "",
          },
        },
      }).catch(() => null);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
